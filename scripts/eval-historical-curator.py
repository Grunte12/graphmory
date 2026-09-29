#!/usr/bin/env python3
"""Synthetic no-tool Curator routing and evidence-delivery diagnostic."""
import argparse
import hashlib
import json
import pathlib
import shutil
import subprocess
import tempfile
import time

p = argparse.ArgumentParser()
p.add_argument('--out', required=True)
p.add_argument('--model', default='gpt-5.6-luna')
a = p.parse_args()
out = pathlib.Path(a.out).resolve()
if out.exists():
    raise RuntimeError('Preserve prior reports')
root = pathlib.Path(__file__).resolve().parents[1]
scratch = pathlib.Path(tempfile.mkdtemp(prefix='graphmory-history-curator-'))
workspace = scratch / 'host'
workspace.mkdir()
digest = lambda value: hashlib.sha256(value).hexdigest()
def note(status, date, content):
    return f'---\nstatus: {status}\n---\n# Cedar storage policy\nDate: {date}\n\n{content}\n'
base = {'current.md': note('active', '2025-03-01', 'Cedar storage policy now uses PostgreSQL.'),
        'prior.md': note('superseded', '2025-01-01', 'Cedar storage policy used SQLite.'),
        'raw.md': note('raw', '2025-04-01', 'Cedar storage policy could use UnapprovedDB.')}
cases = [
    ('current', 'What database does Cedar storage policy currently use?', base),
    ('prior', 'What database did Cedar storage policy use in January, before the March change?', base),
    ('scope', 'What database does the Cedar production storage policy currently use?', {
        'production.md': note('active', '2025-03-01', 'Cedar production storage policy uses PostgreSQL.'),
        'staging.md': note('active', '2025-03-01', 'Cedar staging storage policy uses SQLite.'),
        'prior.md': note('superseded', '2025-01-01', 'Cedar production storage policy previously used MySQL.')}),
    ('missing', 'What database did Cedar storage policy use in January, before March?', {
        'current.md': base['current.md'],
        'prior.md': note('superseded', '2025-01-01', 'The previous Cedar storage policy database was not recorded.')}),
    ('conflict', 'What database did Cedar storage policy use in January, before March?', {
        'current.md': base['current.md'],
        'prior-a.md': note('superseded', '2025-01-01', 'Cedar storage policy uses SQLite. No resolution recorded.'),
        'prior-b.md': note('superseded', '2025-01-01', 'Cedar storage policy uses MySQL. No resolution recorded.')}),
    ('attribution', 'What database did the user say Cedar storage policy used in January, before March?', {
        'current.md': base['current.md'],
        'prior.md': note('superseded', '2025-01-01', '## user\nCedar storage policy uses SQLite.\n## assistant\nI recommend considering MongoDB instead.')}),
]
report = {'protocol': 'synthetic-curator-history-choice-v1', 'model': a.model, 'reasoning': 'low',
          'runnerSha256': digest(pathlib.Path(__file__).read_bytes()), 'plannedCases': 6,
          'plannedCalls': 18, 'calls': [], 'rows': [], 'runComplete': False,
          'limitations': ['Synthetic development; six questions from five source families',
              'Shared route decision precedes paired answer calls; not independent routing per arm',
              'Evaluator reads every delivered candidate original; autonomous source selection unmeasured',
              'No Lead agent, official answer scorer or independently calibrated semantic judge',
              'Fresh sessions do not guarantee cold cache; billing unknown']}
def save():
    out.write_text(json.dumps(report, indent=2) + '\n')
def generate(prompt, schema, key):
    schema_path = workspace / 'schema.json'
    schema_path.write_text(json.dumps(schema))
    start = time.monotonic()
    try:
        child = subprocess.run(['codex', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
            '-C', str(workspace), '-s', 'read-only', '-m', a.model, '-c', 'model_reasoning_effort="low"',
            '--output-schema', str(schema_path), '--json', '-'], input=prompt, capture_output=True, text=True, timeout=120)
        events = [json.loads(line) for line in child.stdout.splitlines() if line.startswith('{')]
        completed = next((e for e in reversed(events) if e.get('type') == 'turn.completed'), None)
        texts = [e['item']['text'] for e in events if e.get('type') == 'item.completed' and e.get('item', {}).get('type') == 'agent_message']
        forbidden = any(e.get('item', {}).get('type') not in (None, 'agent_message', 'reasoning', 'error') for e in events)
        failed = child.returncode != 0 or not completed or not texts or forbidden or any(e.get('type') in ('error', 'turn.failed') for e in events)
        row = {'id': key, 'elapsedSeconds': time.monotonic() - start, 'promptBytes': len(prompt.encode()),
               'promptSha256': digest(prompt.encode()), 'usage': completed.get('usage') if completed else None,
               'forbiddenTool': forbidden, 'failed': bool(failed)}
        if failed:
            row['error'] = 'Host failure or prohibited tool use'
            row['hostErrors'] = [e.get('error', e.get('message')) for e in events if e.get('type') in ('error', 'turn.failed')]
        else:
            row['response'] = json.loads(texts[-1])
    except (subprocess.TimeoutExpired, ValueError) as error:
        row = {'id': key, 'elapsedSeconds': time.monotonic() - start, 'promptSha256': digest(prompt.encode()),
               'usage': None, 'failed': True, 'error': type(error).__name__}
    report['calls'].append(row)
    save()
    return None if row['failed'] else row['response']

route_schema = {'type': 'object', 'properties': {'include_superseded': {'type': 'boolean'}},
                'required': ['include_superseded'], 'additionalProperties': False}
answer_schema = {'type': 'object', 'properties': {'answer': {'type': 'string'}, 'citations': {'type': 'array', 'items': {'type': 'string'}}},
                 'required': ['answer', 'citations'], 'additionalProperties': False}
try:
    save()
    for index, (qid, query, notes) in enumerate(cases):
        vault = scratch / qid
        vault.mkdir()
        for name, text in notes.items(): (vault / name).write_text(text)
        config = vault / 'runtime.json'
        config.write_text(json.dumps({'version': 1, 'workflow': 'curator', 'curator': {'provider': 'openai', 'model': a.model},
            'decision': {'model': 'jev-latest', 'endpoint': 'https://api.typesafe.ai/v1/systemone', 'apiKeyEnv': 'TYPESAFE_API_KEY',
                         'allowRemoteVaultContent': False, 'relevanceThreshold': 0.6, 'maxCandidates': 8}}))
        route = generate('Act as the Graphmory memory curator. Never use tools, files or shell. Choose the retrieval option for this question. '
            'Default retrieval excludes superseded notes. include_superseded=true admits prior canonical notes. '
            'Use it for an explicit previous-state question; leave it false for current-state questions. '
            'This option does not resolve conflicting facts.\nQuestion: ' + query, route_schema, qid + ':route')
        for arm in (['existing', 'history-capable'] if index % 2 == 0 else ['history-capable', 'existing']):
            row = {'id': qid, 'arm': arm, 'question': query, 'route': route, 'runComplete': False}
            report['rows'].append(row)
            if route is None:
                row['stopReason'] = 'route-failed'
                save()
                continue
            use_history = arm == 'history-capable' and route['include_superseded']
            start = time.monotonic()
            command = ['node', str(root / 'scripts/brain-sync.mjs'), 'recall-managed', '--vault', str(vault),
                '--query', query, '--config', str(config), '--auto', '--agent'] + (['--include-superseded'] if use_history else [])
            result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=True)
            page = json.loads(result.stdout)
            if page['hasMore']: raise RuntimeError('Unexpected incomplete synthetic delivery')
            paths = [r['path'] for r in page['results']]
            sources = {'sources': []}
            if paths:
                read = subprocess.run(['node', str(root / 'scripts/brain-sync.mjs'), 'read-notes', '--vault', str(vault), '--paths', json.dumps(paths)],
                                      capture_output=True, text=True, timeout=30, check=True)
                sources = json.loads(read.stdout)
            row.update({'historicalApplied': use_history, 'retrieval': page, 'sourcePaths': paths,
                'sourceHashes': {r['path']: r['sha256'] for r in sources['sources']}, 'toolSeconds': time.monotonic() - start,
                'toolStdoutBytes': len(result.stdout.encode()) + (len(read.stdout.encode()) if paths else 0)})
            answer = generate('Act as the memory curator. Never use tools, files or shell. Answer using only supplied original sources. '
                'Preserve scope, speaker, negation and requested time. If the historical value is missing or unresolved, say so. '
                'Cite exact supplied source paths; do not invent a missing value.\nQuestion: ' + query + '\nOriginal sources: ' + json.dumps(sources),
                answer_schema, qid + ':' + arm)
            row['response'] = answer
            row['runComplete'] = answer is not None
            row['stopReason'] = 'completed' if answer is not None else 'answer-host-failed'
            row['citationIdentityValid'] = answer is not None and all(name in paths for name in answer['citations'])
            row['sourcesUnchanged'] = all((vault / name).read_text() == text for name, text in notes.items())
            save()
            print(qid, arm, row['runComplete'], flush=True)
    report['runComplete'] = len(report['calls']) == 18 and all(row['runComplete'] for row in report['rows'])
    save()
finally:
    shutil.rmtree(scratch)
