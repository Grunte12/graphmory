#!/usr/bin/env python3
"""Live source/pagination requests, mediated by actual Graphmory CLI; gold never loaded."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--case-index', type=int, default=0)
parser.add_argument('--model', default='gpt-5.6-luna')
parser.add_argument('--mode', choices=['auto', 'bundle'], default='bundle')
parser.add_argument('--max-rounds', type=int, default=3)
parser.add_argument('--max-input-bytes', type=int, default=300000)
parser.add_argument('--persistent-curator', action='store_true')
parser.add_argument('--compact-followup', action='store_true')
args = parser.parse_args()
if not 1 <= args.max_rounds <= 10 or args.max_input_bytes < 1000:
    raise RuntimeError('Invalid economic/protocol budget')
if args.compact_followup and not args.persistent_curator:
    raise RuntimeError('Compact follow-up requires persistent Curator context')
data = pathlib.Path(args.input).resolve()
case = json.loads(data.read_text())[args.case_index]
if set(case) != {'id', 'question', 'vault', 'sources'}:
    raise RuntimeError('Unexpected reader fields, possibly labels')
vault = pathlib.Path(case['vault']).resolve()
for name, expected in case['sources'].items():
    file = vault / name
    if file.is_symlink() or not file.resolve().is_relative_to(vault) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Invalid source boundary/hash')
out = pathlib.Path(args.out).resolve()
if out.exists():
    raise RuntimeError('Preserve prior trials')
out.mkdir(parents=True, mode=0o700)
workspace = out / 'reader-workspace'
workspace.mkdir()
root = pathlib.Path(__file__).resolve().parents[1]
cli = root / 'scripts/brain-sync.mjs'
report = {'protocol': 'curator-paging-development-v2-boolean-continuation', 'id': case['id'], 'question': case['question'],
          'model': args.model, 'mode': args.mode, 'maxRounds': args.max_rounds, 'maxInputBytes': args.max_input_bytes,
          'persistentCurator': args.persistent_curator, 'compactFollowup': args.compact_followup,
          'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'inputSha256': hashlib.sha256(data.read_bytes()).hexdigest(), 'modelCalls': [], 'pages': [], 'sourceReads': [],
          'brief': None, 'answer': None, 'runComplete': False, 'stopReason': None,
          'limitations': ['One exposed development case; no quality acceptance or latency tail claim',
                          'No-tool boundary is checked in trace, not a proven filesystem isolation guarantee',
                          'No official answer scorer or independent calibrated semantic judge',
                          'Subscription bill allocation unknown; native token categories retained']}


def save():
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


def command_json(command):
    child = subprocess.run(command, text=True, capture_output=True, timeout=30)
    if child.returncode:
        raise RuntimeError('Graphmory CLI failed')
    return json.loads(child.stdout)


def retrieval(offset):
    page = command_json(['node', str(cli), 'recall-managed', '--vault', str(vault), '--query', case['question'],
                         '--agent', '--offset', str(offset), '--' + args.mode])
    if page.get('offset') != offset or not isinstance(page.get('results'), list):
        raise RuntimeError('Invalid retrieval page')
    report['pages'].append({'offset': offset, 'nextOffset': page['nextOffset'], 'hasMore': page['hasMore'],
                            'paths': [row['path'] for row in page['results']],
                            'pageSha256': hashlib.sha256(json.dumps(page, sort_keys=True).encode()).hexdigest()})
    save()
    return page


curator_session = None


def generate(prompt, stage, schema):
    global curator_session
    if len(prompt.encode()) > args.max_input_bytes:
        raise RuntimeError('input-byte-budget')
    schema_file = workspace / 'schema.json'
    schema_file.write_text(json.dumps(schema))
    start = time.monotonic()
    resumed = stage == 'curator' and args.persistent_curator and curator_session is not None
    if resumed:
        command = ['codex', 'exec', 'resume', '--ignore-user-config', '--skip-git-repo-check',
                   '-m', args.model, '-c', 'model_reasoning_effort="low"',
                   '--output-schema', str(schema_file), '--json', curator_session, '-']
    else:
        command = ['codex', 'exec', '--ignore-user-config', '--skip-git-repo-check',
                   '-C', str(workspace), '-s', 'read-only', '-m', args.model,
                   '-c', 'model_reasoning_effort="low"', '--output-schema', str(schema_file), '--json', '-']
        if stage != 'curator' or not args.persistent_curator:
            command.insert(3, '--ephemeral')
    child = subprocess.run(command,
                           input=prompt, text=True, capture_output=True, timeout=120)
    trace = str(len(report['modelCalls'])) + '-' + stage
    (out / (trace + '.jsonl')).write_text(child.stdout)
    (out / (trace + '.stderr')).write_text(child.stderr)
    events = [json.loads(line) for line in child.stdout.splitlines() if line.startswith('{')]
    started = next((event.get('thread_id') for event in events if event.get('type') == 'thread.started'), None)
    if stage == 'curator' and args.persistent_curator:
        if not started or (resumed and started != curator_session):
            raise RuntimeError('Persistent Curator session identity missing or changed')
        curator_session = started
    texts = [event['item']['text'] for event in events if event.get('type') == 'item.completed' and event.get('item', {}).get('type') == 'agent_message']
    prohibited = [event for event in events if event.get('item', {}).get('type') not in (None, 'agent_message', 'reasoning', 'error')]
    complete = next((event for event in reversed(events) if event.get('type') == 'turn.completed'), None)
    failed = child.returncode != 0 or not complete or not texts or prohibited or any(event.get('type') in ('error', 'turn.failed') for event in events)
    report['modelCalls'].append({'stage': stage, 'sessionResumed': resumed,
                                  'elapsedSeconds': round(time.monotonic() - start, 3),
                                  'promptBytes': len(prompt.encode()), 'promptSha256': hashlib.sha256(prompt.encode()).hexdigest(),
                                  'usage': complete.get('usage') if complete else None, 'failed': bool(failed),
                                  'warnings': [event['item'].get('message') for event in events if event.get('item', {}).get('type') == 'error']})
    save()
    if failed:
        raise RuntimeError('Host failed or used prohibited tools; preserve traces')
    return json.loads(texts[-1])


schema = {'type': 'object', 'properties': {'read_paths': {'type': 'array', 'items': {'type': 'string'}},
          'next_page': {'type': 'boolean'}, 'brief': {'type': 'string'}},
          'required': ['read_paths', 'next_page', 'brief'], 'additionalProperties': False}
instruction = ('Act as the memory curator. Use only supplied evidence; never use tools, files or shell directly. '
               'The runner executes Graphmory commands for you. Return read_paths for original notes and next_page=true if more candidates are needed. '
               'The runner determines the exact continuation offset; never calculate it. Only request paths on supplied pages. '
               'When requesting evidence, leave brief empty. When sufficient, use empty read_paths and next_page=false '
               'and return a concise source-cited brief. If hasMore=false, next_page must be false. '
               'sourceReadRequired means displayed previews omit content; previewOmitted does not mean irrelevant. '
               'Preserve speaker, scope, negation and time. Do not guess missing facts. Report uncertainty or incomplete coverage honestly.')
save()
start = time.monotonic()
try:
    page = retrieval(0)
    available = set(row['path'] for row in page['results'])
    read = set()
    originals = []
    feedback = None
    for turn in range(args.max_rounds):
        # Only the current page and verified original reads are supplied. Older previews
        # remain discoverable by path but cannot be mistaken for the current continuation.
        if turn and args.compact_followup:
            prompt = ('Continue the same Curator task using your previous context. '
                      'Use the same read_paths/next_page/brief contract. '
                      'New original sources since your last turn: ' + json.dumps(new_originals)
                      + ('\nNew retrieval page: ' + json.dumps(page) if new_page else '')
                      + ('\nProtocol feedback: ' + feedback if feedback else ''))
        else:
            prompt = (instruction + '\nQuestion: ' + case['question']
                      + '\nAvailable paths from previous pages: ' + json.dumps(sorted(available - {row['path'] for row in page['results']}))
                      + '\nCurrent retrieval page: ' + json.dumps(page)
                      + '\nOriginal sources already read: ' + json.dumps(originals)
                      + ('\nProtocol feedback: ' + feedback if feedback else ''))
        response = generate(prompt, 'curator', schema)
        if set(response) != {'read_paths', 'next_page', 'brief'} or not isinstance(response['read_paths'], list) or not isinstance(response['brief'], str) or not isinstance(response['next_page'], bool):
            raise RuntimeError('Invalid curator response')
        requested, next_page = response['read_paths'], response['next_page']
        if any(not isinstance(name, str) or name not in available or name in read for name in requested) or len(set(requested)) != len(requested):
            raise RuntimeError('Invalid, unseen or repeated source request')
        if not requested and not next_page:
            if not response['brief'].strip():
                raise RuntimeError('Empty final brief')
            report['brief'] = response['brief']
            break
        if response['brief']:
            raise RuntimeError('Brief returned while evidence request pending')
        new_originals = []
        if requested:
            sources = command_json(['node', str(cli), 'read-notes', '--vault', str(vault), '--paths', json.dumps(requested)])
            if set(row['path'] for row in sources['sources']) != set(requested):
                raise RuntimeError('Source delivery mismatch')
            for row in sources['sources']:
                if row['sha256'] != case['sources'][row['path']] or hashlib.sha256(row['markdown'].encode()).hexdigest() != row['sha256']:
                    raise RuntimeError('Original source mutated/hash mismatch')
            report['sourceReads'] += [{'path': row['path'], 'sha256': row['sha256'], 'bytes': row['bytes']} for row in sources['sources']]
            read.update(requested)
            originals.extend(sources['sources'])
            new_originals = sources['sources']
        feedback = None
        new_page = False
        if next_page:
            if page['hasMore'] and isinstance(page['nextOffset'], int) and not isinstance(page['nextOffset'], bool):
                page = retrieval(page['nextOffset'])
                available.update(row['path'] for row in page['results'])
                new_page = True
            elif page['hasMore']:
                raise RuntimeError('Invalid CLI continuation contract')
            else:
                feedback = 'No more pages; hasMore=false. Use already supplied evidence or report what is missing.'
        save()
    if report['brief'] is None:
        raise RuntimeError('round-budget')
    answer_schema = {'type': 'object', 'properties': {'answer': {'type': 'string'}}, 'required': ['answer'], 'additionalProperties': False}
    answer = generate('Use only this curator brief. Preserve scope, time, negation and uncertainty. Do not use tools or files. '
                      'Answer concisely with exact source paths; do not invent missing facts.\nQuestion: ' + case['question']
                      + '\nBrief: ' + report['brief'], 'lead', answer_schema)
    if set(answer) != {'answer'} or not isinstance(answer['answer'], str) or not answer['answer'].strip():
        raise RuntimeError('Invalid lead answer')
    report['answer'] = answer['answer']
    for name, expected in case['sources'].items():
        if hashlib.sha256((vault / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Source mutation')
    report['runComplete'] = True
    report['stopReason'] = 'curator-finalized'
except Exception as error:
    report['stopReason'] = str(error)
    raise
finally:
    report['elapsedSeconds'] = round(time.monotonic() - start, 3)
    save()
    print(json.dumps({'complete': report['runComplete'], 'modelCalls': len(report['modelCalls']), 'readNotes': len(report['sourceReads']), 'stopReason': report['stopReason']}), flush=True)
