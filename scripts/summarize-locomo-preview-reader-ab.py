#!/usr/bin/env python3
"""Score all planned A/B trials, retaining failures and native host accounting."""
import argparse
import hashlib
import json
import pathlib
import statistics
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--prepared', required=True)
parser.add_argument('--runs', required=True)
parser.add_argument('--scorer-source', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
prepared, runs, out = map(lambda p: pathlib.Path(p).resolve(), (args.prepared, args.runs, args.out))
if out.exists():
    raise RuntimeError('Preserve previous summaries')
manifest_bytes = (prepared / 'manifest.json').read_bytes()
manifest = json.loads(manifest_bytes)
ledger = json.loads((runs / 'ledger.json').read_text())
if hashlib.sha256(manifest_bytes).hexdigest() != ledger['manifestSha256']:
    raise RuntimeError('Manifest changed')
label_bytes = (prepared / 'labels.json').read_bytes()
if hashlib.sha256(label_bytes).hexdigest() != manifest['labelsSha256']:
    raise RuntimeError('Labels changed')
labels = json.loads(label_bytes)
by_id = {label['id']: label for label in labels}
if len(by_id) != len(labels):
    raise RuntimeError('Duplicate labels')
attempts = {row['attemptIndex']: row for row in ledger['attempts']}
if len(attempts) < len(manifest['executionOrder']) and not ledger['stopped']:
    raise RuntimeError('Batch is incomplete and has no terminal stop record; do not score pending trials')
if len(attempts) != len(ledger['attempts']):
    raise RuntimeError('Duplicate attempts')
if any(index < 0 or index >= len(manifest['executionOrder']) for index in attempts):
    raise RuntimeError('Unknown attempt')
out.mkdir(parents=True)
rows = []
for index, trial in enumerate(manifest['executionOrder']):
    attempt = attempts.get(index)
    report = None
    if attempt:
        if any(attempt[key] != trial[key] for key in ('id', 'caseIndex', 'arm')):
            raise RuntimeError('Mismatched trial')
        if attempt['report']:
            file = (runs / attempt['report']).resolve()
            if not file.is_relative_to(runs):
                raise RuntimeError('Invalid report boundary')
            report = json.loads(file.read_text())
            if report['id'] != trial['id'] or report['inputSha256'] != manifest['readerInputSha256']:
                raise RuntimeError('Mismatched report input')
            if report['runnerSha256'] != manifest['sourceHashes']['scripts/run-curator-paging-pilot.py']:
                raise RuntimeError('Runner drift')
            if report['coveragePreviews'] != (trial['arm'] == 'coverage'):
                raise RuntimeError('Treatment drift')
    complete = bool(report and report['runComplete'] and attempt['exitCode'] == 0)
    calls = report['modelCalls'] if report else []
    usage = {key: sum((call.get('usage') or {}).get(key, 0) for call in calls)
             for key in ('input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens')}
    paths = {source['path'] for source in report['sourceReads']} if report else set()
    gold = by_id[trial['id']]['goldPaths']
    rows.append(dict(trial, attemptIndex=index, attempted=attempt is not None, complete=complete,
                     stopReason=report['stopReason'] if report else 'unattempted-or-no-report',
                     answer=report['answer'] if report else None, brief=report['brief'] if report else None,
                     citations=report.get('citations') if report else None,
                     citationProvenanceValid=report.get('citationProvenanceValid') if report else None,
                     sourceReads=report['sourceReads'] if report else [], sourceRequests=report.get('sourceRequests', []) if report else [], pages=report['pages'] if report else [],
                     modelCalls=calls, usage=usage, elapsedSeconds=report['elapsedSeconds'] if report else None,
                     goldNotesRead=len(paths.intersection(gold)), goldNotes=len(gold),
                     completeGoldNoteReads=bool(gold) and set(gold).issubset(paths), category=by_id[trial['id']]['category']))
root = pathlib.Path(__file__).resolve().parents[1]
for arm in ('current', 'coverage'):
    selected = [row for row in rows if row['arm'] == arm]
    # Preserve emitted raw answers even when the operational provenance gate failed.
    predictions = [{'id': row['id'], 'prediction': row['answer'] or ''} for row in selected]
    p = out / (arm + '-predictions.json'); p.write_text(json.dumps(predictions) + '\n')
    l = out / (arm + '-labels.json'); l.write_text(json.dumps([by_id[row['id']] for row in selected]) + '\n')
    score_path = out / (arm + '-official-score.json')
    subprocess.run([sys.executable, str(root / 'scripts/eval-locomo-official-qa.py'), '--source', args.scorer_source,
                    '--predictions', str(p), '--labels', str(l), '--out', str(score_path)], check=True)
    scores = {row['id']: row['rawQaF1'] for row in json.loads(score_path.read_text())['scores']}
    for row in selected:
        row['rawQaF1'] = scores[row['id']]
        row['operationalAdjustedQaF1'] = row['rawQaF1'] if row['complete'] else 0.0
def aggregate(selected):
    finished = [row for row in selected if row['complete']]
    return {'planned': len(selected), 'attempted': sum(row['attempted'] for row in selected),
            'operationallyComplete': len(finished), 'meanRawQaF1AllPlanned': statistics.mean(row['rawQaF1'] for row in selected),
            'meanOperationalAdjustedQaF1AllPlanned': statistics.mean(row['operationalAdjustedQaF1'] for row in selected),
            'meanRawQaF1CompletedOnly': statistics.mean(row['rawQaF1'] for row in finished) if finished else None,
            'medianCompletedSeconds': statistics.median(row['elapsedSeconds'] for row in finished) if finished else None,
            'allAttemptInputTokens': sum(row['usage']['input_tokens'] for row in selected),
            'allAttemptCachedInputTokens': sum(row['usage']['cached_input_tokens'] for row in selected)}

summary, paired = {}, []
if manifest['protocol'] == 'locomo-idempotent-targeted-development-v1':
    # Different questions/arms are targeted retries, never a paired A/B comparison.
    summary['targeted'] = aggregate(rows)
elif manifest['protocol'] == 'locomo-preview-reader-development-ab-v1':
    summary = {arm: aggregate([row for row in rows if row['arm'] == arm]) for arm in ('current', 'coverage')}
    for case_id in manifest['selectedIds']:
        pair = {row['arm']: row for row in rows if row['id'] == case_id}
        a, b = pair['current'], pair['coverage']
        paired.append({'id': case_id, 'category': a['category'], 'bothComplete': a['complete'] and b['complete'],
                       'rawQaF1DeltaCoverageMinusCurrent': b['rawQaF1'] - a['rawQaF1']})
else:
    raise RuntimeError('Unknown analysis protocol')
result = {'protocol': manifest['protocol'], 'manifestSha256': ledger['manifestSha256'],
          'summary': summary, 'paired': paired, 'rows': rows, 'independentSemanticReview': 'not performed',
          'limitations': manifest['limitations'] + ['Gold-note reads do not establish semantic support or complete answers',
             'Native usage can omit failed-call tokens when the host does not report them',
             'Official raw scores preserve generated answers even after an operational failure; unattempted/no-answer use empty strings. Operational-adjusted scores separately assign zero to failures as predeclared.',
             'Not a full official benchmark run or competitor comparison']}
(out / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(summary, indent=2))
