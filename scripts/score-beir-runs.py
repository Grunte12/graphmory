#!/usr/bin/env python3
"""Use the installed, unchanged BEIR evaluator on preserved original-ID runfiles."""
import argparse
import csv
import hashlib
import importlib.metadata
import inspect
import io
import json
import pathlib
import zipfile
from beir.retrieval.evaluation import EvaluateRetrieval

parser = argparse.ArgumentParser()
parser.add_argument('--zip', required=True)
parser.add_argument('--dataset', required=True)
parser.add_argument('--split', required=True)
parser.add_argument('--runs', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
directory = pathlib.Path(args.runs)
out = pathlib.Path(args.out)
if out.exists():
    raise RuntimeError('Preserve prior scoring output')
sha = lambda data: hashlib.sha256(data).hexdigest()
archive_bytes = pathlib.Path(args.zip).read_bytes()
manifest = json.loads((directory / 'manifest.json').read_text())
if sha(archive_bytes) != manifest['archiveSha256']:
    raise RuntimeError('Dataset archive drift')
with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
    file = io.TextIOWrapper(archive.open(args.dataset + '/qrels/' + args.split + '.tsv'))
    rows = csv.DictReader(file, delimiter='\t')
    qrels = {}
    for row in rows:
        qrels.setdefault(row['query-id'], {})[row['corpus-id']] = int(row['score'])
if set(qrels) != set(manifest['attempted']):
    raise RuntimeError('Missing or substituted queries')
report = dict(dataset=args.dataset, split=args.split, queryCount=len(qrels),
              evaluator='unchanged BEIR EvaluateRetrieval',
              beirVersion=importlib.metadata.version('beir'),
              pytrecEvalTerrierVersion=importlib.metadata.version('pytrec-eval-terrier'),
              evaluationSourceSha256=sha(pathlib.Path(inspect.getsourcefile(EvaluateRetrieval.evaluate)).read_bytes()),
              runManifestSha256=sha((directory / 'manifest.json').read_bytes()), arms={})
for arm in ('bm25', 'managedLexical'):
    raw = (directory / (arm + '.json')).read_bytes()
    results = json.loads(raw)
    if set(results) != set(qrels) or any(not isinstance(values, dict) for values in results.values()):
        raise RuntimeError('Incomplete runfile')
    ks = [1, 3, 5, 10, 100, 1000]
    # Preserve the official evaluator's default same-ID exclusion and record it.
    ndcg, mean_ap, recall, precision = EvaluateRetrieval.evaluate(qrels, results, ks)
    report['arms'][arm] = dict(runSha256=sha(raw), ignoreIdenticalIds=True, ndcg=ndcg, map=mean_ap, recall=recall, precision=precision,
                              mrr=EvaluateRetrieval.evaluate_custom(qrels, results, ks, metric='mrr'))
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({arm: {'NDCG@10': value['ndcg']['NDCG@10'], 'Recall@10': value['recall']['Recall@10']}
                  for arm, value in report['arms'].items()}))
