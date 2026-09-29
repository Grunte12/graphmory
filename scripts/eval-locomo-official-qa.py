#!/usr/bin/env python3
"""Run unchanged pinned LoCoMo QA function bodies without its unused BERTScore import."""
import argparse
import ast
from collections import Counter
import hashlib
import json
import pathlib
import string

import numpy as np
import regex
from nltk.stem import PorterStemmer

SOURCE_SHA256 = '8e3be5d57ff2ff9ec5cd05939592f468c5f3f1fd95d13e431932bdf6bf0fd6fd'
NAMES = {'normalize_answer', 'f1_score', 'f1', 'eval_question_answering'}

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--predictions', required=True)
parser.add_argument('--labels', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
source = pathlib.Path(args.source).read_bytes()
if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
    raise RuntimeError('Pinned upstream scorer mismatch')
predictions = json.loads(pathlib.Path(args.predictions).read_text())
labels = json.loads(pathlib.Path(args.labels).read_text())
if len(predictions) == 0 or len({row['id'] for row in predictions}) != len(predictions):
    raise RuntimeError('Predictions missing or duplicated')
gold = {row['id']: row for row in labels}
if len(gold) != len(labels) or {row['id'] for row in predictions} != set(gold):
    raise RuntimeError('Prediction/label ID coverage mismatch')
nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in NAMES]
if {node.name for node in nodes} != NAMES:
    raise RuntimeError('Expected official scorer function set not found')
namespace = {'np': np, 'regex': regex, 'string': string, 'Counter': Counter, 'ps': PorterStemmer()}
exec(compile(ast.Module(body=nodes, type_ignores=[]), args.source, 'exec'), namespace)
qas = []
for row in predictions:
    if set(row) != {'id', 'prediction'} or not isinstance(row['prediction'], str):
        raise RuntimeError('Raw prediction schema invalid')
    label = gold[row['id']]
    qas.append({'prediction': row['prediction'], 'answer': label['answer'], 'category': label['category']})
values, _, _ = namespace['eval_question_answering'](qas)
out = pathlib.Path(args.out)
if out.exists():
    raise RuntimeError('Preserve existing score artifact')
report = {'protocol': 'locomo-pinned-function-bodies-raw-qa-v1',
          'source': 'https://github.com/snap-research/locomo/blob/3eb6f2c585f5e1699204e3c3bdf7adc5c28cb376/task_eval/evaluation.py',
          'sourceSha256': SOURCE_SHA256, 'sourceLicense': 'CC BY-NC 4.0 (upstream LICENSE.txt)',
          'extractedUnmodifiedFunctions': sorted(NAMES),
          'environmentAdaptation': 'Only the four unchanged QA function bodies are compiled from pinned source; explicit dependency bindings replace importing the full module, which imports unused BERTScore. This is not a full official CLI run.',
          'rawPredictionsUnchanged': True, 'scores': [{'id': row['id'], 'rawQaF1': float(score)} for row, score in zip(predictions, values)],
          'meanRawQaF1': float(np.mean(values)),
          'limitations': ['Category-specific token scoring, not semantic support/temporal correctness',
                          'Citations remain in raw predictions and can reduce F1',
                          'Selected development cases only; not a published full-split score']}
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'cases': len(values), 'meanRawQaF1': report['meanRawQaF1']}))
