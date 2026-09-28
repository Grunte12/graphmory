#!/usr/bin/env python3
"""Make a treatment-blind source review packet; keep mapping separate."""
import argparse
import hashlib
import json
import pathlib
import random
import shutil

p = argparse.ArgumentParser()
for name in ['prepared', 'runs', 'packet', 'mapping', 'vault-root']: p.add_argument('--' + name, required=True)
a = p.parse_args()
prepared, runs = pathlib.Path(a.prepared).resolve(), pathlib.Path(a.runs).resolve()
packet, mapping, vault_root = map(lambda x: pathlib.Path(x).resolve(), [a.packet, a.mapping, a.vault_root])
if any(path.exists() for path in [packet, mapping, vault_root]): raise RuntimeError('Preserve prior blind artifacts')
m = json.loads((prepared / 'manifest.json').read_text())
ledger = json.loads((runs / 'ledger.json').read_text())
if m['protocol'] != 'prefetch-three-arm-development-v1' or len(ledger['attempts']) != m['plannedTrials']:
    raise RuntimeError('Incomplete frozen experiment')
seed = 'graphmory-prefetch-three-blind-review-2026-09-28-v1'
rubric = pathlib.Path(__file__).resolve().parents[1] / 'eval/reader-pilot/prefetch-three-support-rubric-2026-09-28.md'
rubric_sha = hashlib.sha256(rubric.read_bytes()).hexdigest()
vault_root.mkdir(parents=True, mode=0o700)
reviews, identities = [], []
for case in m['cases']:
    index, source = case['caseIndex'], prepared / str(case['caseIndex']) / 'vault'
    destination = vault_root / ('case-' + hashlib.sha256((seed + case['id']).encode()).hexdigest()[:12])
    shutil.copytree(source, destination)
    for name, expected in case['originalHashes'].items():
        if hashlib.sha256((destination / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Blind source changed')
    reader = json.loads((prepared / str(index) / 'reader-input.json').read_text())[0]
    label = json.loads((prepared / str(index) / 'labels.json').read_text())[0]
    answers = []
    for trial_index, trial in enumerate(m['executionOrder']):
        if trial['caseIndex'] != index: continue
        attempt = ledger['attempts'][trial_index]
        if attempt['index'] != trial_index or attempt['exitCode'] != 0 or not attempt['report']:
            raise RuntimeError('Blind packet requires complete actual workflow')
        report = json.loads((runs / attempt['report']).read_text())
        identity = hashlib.sha256((seed + ':answer:' + str(trial_index)).encode()).hexdigest()[:12]
        answers.append({'blindId': identity, 'answer': report['answer'], 'citations': report['citations']})
        identities.append({'blindId': identity, 'id': case['id'], 'tool': trial['tool'], 'trialIndex': trial_index})
    random.Random(seed + case['id']).shuffle(answers)
    reviews.append({'caseId': case['id'], 'question': reader['question'], 'reference': label['answer'],
                    'goldTurnIds': label['goldTurnIds'], 'goldPaths': label['goldPaths'],
                    'sourceVault': str(destination), 'answers': answers})
packet.write_text(json.dumps({'protocol': 'three-arm-blind-support-v1', 'rubricSha256': rubric_sha,
                              'cases': reviews, 'instructions': 'Use only this packet, the linked copied sourceVault Markdown and frozen rubric. Do not open experiment results, traces, ledgers, mapping, or other repo reports. Return verdicts by blindId.'}, indent=2) + '\n')
mapping.write_text(json.dumps({'protocol': 'prefetch-three-arm-blind-map-v1', 'packetSha256': hashlib.sha256(packet.read_bytes()).hexdigest(), 'identities': identities}, indent=2) + '\n')
print(json.dumps({'cases': len(reviews), 'blindAnswers': len(identities), 'rubricSha256': rubric_sha,
                  'packetSha256': hashlib.sha256(packet.read_bytes()).hexdigest()}))
