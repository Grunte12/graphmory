#!/usr/bin/env python3
"""Mediated, no-tool reader/curator pilot; preserve failed trials, never retry silently."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import time
import os

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--model', default='gpt-5.6-luna')
parser.add_argument('--cases', type=int, default=1, choices=[1, 2])
args = parser.parse_args()

def command_prefix(variable, fallback):
    raw = os.environ.get(variable)
    if raw is None:
        return fallback
    value = json.loads(raw)
    if not isinstance(value, list) or not value or any(not isinstance(item, str) or not item for item in value):
        raise RuntimeError(f'{variable} must be a JSON array of non-empty strings')
    return value

codex_prefix = command_prefix('GRAPHMORY_TEST_CODEX_COMMAND', ['codex'])
source = pathlib.Path(args.input).resolve()
out = pathlib.Path(args.out).resolve()
if out.exists():
    raise RuntimeError('Existing run must be preserved')
out.mkdir(parents=True, mode=0o700)
workspace = out / 'reader-workspace'
workspace.mkdir()
cases = json.loads(source.read_text())[:args.cases]
if len(cases) != args.cases or len({case['id'] for case in cases}) != len(cases):
    raise RuntimeError('Missing or duplicated expected cases')
for case in cases:
    if set(case) != {'id', 'question', 'oracle', 'predicted'}:
        raise RuntimeError('Reader case contains unexpected fields, possibly labels')
    for arm in ['oracle', 'predicted']:
        for note in case[arm]:
            if set(note) != {'path', 'sha256', 'markdown'} or hashlib.sha256(note['markdown'].encode()).hexdigest() != note['sha256']:
                raise RuntimeError('Evidence schema/hash mismatch')
schema = {'type': 'object', 'properties': {'answer': {'type': 'string'}},
          'required': ['answer'], 'additionalProperties': False}
(workspace / 'schema.json').write_text(json.dumps(schema))
prefix = ('Use only the supplied evidence. Do not call tools, read files, or use shell. '
          'Preserve scope, speaker, negation, dates and uncertainty. Cite exact source paths. '
          'If evidence is insufficient, say what is missing; never invent a relation or constraint. ')
report = {'protocol': 'reader-attribution-development-v1', 'model': args.model,
          'inputSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'rows': [],
          'expectedTrials': [{'id': case['id'], 'arm': arm} for case in cases
                             for arm in ['oracle', 'predicted', 'curator', 'brief-reader']],
          'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'limitations': ['No-tool policy is trace-checked, not a filesystem access-control guarantee',
                          'All arms share a reader model; curator uses the same cheap model',
                          'No official answer score or automatic semantic correctness verdict',
                          'Host-reported usage is not billed cost; tiny sample cannot estimate p95'],
          'runComplete': False}


def save():
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


def call(qid, arm, prompt):
    start = time.monotonic()
    command = [*codex_prefix, 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check',
               '-C', str(workspace), '-s', 'read-only', '-m', args.model,
               '-c', 'model_reasoning_effort="low"', '--output-schema', str(workspace / 'schema.json'), '--json', '-']
    try:
        child = subprocess.run(command, input=prompt, text=True, capture_output=True, timeout=120)
    except subprocess.TimeoutExpired:
        report['rows'].append({'id': qid, 'arm': arm, 'error': 'timeout', 'answer': None})
        save()
        raise
    (out / f'{qid.replace(":", "-")}-{arm}.jsonl').write_text(child.stdout)
    (out / f'{qid.replace(":", "-")}-{arm}.stderr').write_text(child.stderr)
    events = []
    try:
        events = [json.loads(line) for line in child.stdout.splitlines() if line.startswith('{')]
        # Completed turns may contain advisory error items (e.g. skill descriptions shortened).
        # Treat them as warnings, not evidence of a tool call; top-level failures remain fatal.
        tools = [e for e in events if e.get('item', {}).get('type') not in (None, 'agent_message', 'reasoning', 'error')]
        texts = [e['item']['text'] for e in events if e.get('type') == 'item.completed' and e.get('item', {}).get('type') == 'agent_message']
        completed = [e for e in events if e.get('type') == 'turn.completed']
        if child.returncode or tools or not texts or not completed or any(e.get('type') in ('error', 'turn.failed') for e in events):
            raise ValueError('Host failed, made a prohibited tool call, or did not complete')
        value = json.loads(texts[-1])
        if set(value) != {'answer'} or not isinstance(value['answer'], str) or not value['answer'].strip():
            raise ValueError('Missing/schema-invalid answer')
        error = None
    except (ValueError, KeyError, TypeError) as exc:
        value = {'answer': None}
        error = str(exc)
    row = {'id': qid, 'arm': arm, 'elapsedSeconds': round(time.monotonic() - start, 3),
           'promptSha256': hashlib.sha256(prompt.encode()).hexdigest(), 'promptBytes': len(prompt.encode()),
           'usage': next((e.get('usage') for e in reversed(events) if e.get('type') == 'turn.completed'), None),
           'warnings': [e['item'].get('message') for e in events if e.get('item', {}).get('type') == 'error'],
           'answer': value['answer'], 'error': error}
    report['rows'].append(row)
    save()
    print(qid, arm, 'failed' if error else 'completed', flush=True)
    if error:
        raise RuntimeError('Preserve failed run; inspect traces before any retry')
    return value['answer']


save()
for index, case in enumerate(cases):
    qid = case['id']
    # Counterbalance the two direct arms; every call uses a fresh host session.
    for arm in (['oracle', 'predicted'] if index % 2 == 0 else ['predicted', 'oracle']):
        call(qid, arm, prefix + '\nQuestion: ' + case['question'] + '\nEvidence: ' + json.dumps(case[arm]))
    brief = call(qid, 'curator', prefix + 'Summarize only evidence needed by a lead agent to answer the question. '
                 'Retain exact attribution and source paths, including missing evidence.\nQuestion: ' + case['question']
                 + '\nEvidence: ' + json.dumps(case['predicted']))
    call(qid, 'brief-reader', prefix + '\nQuestion: ' + case['question'] + '\nCurator brief: ' + brief)
report['runComplete'] = True
save()
