#!/usr/bin/env python3
"""Live source/pagination requests, mediated by actual Graphmory CLI; gold never loaded."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import time
import os
from curator_evidence_state import evidence_state

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--case-index', type=int, default=0)
parser.add_argument('--model', default='gpt-5.6-luna')
parser.add_argument('--lead-model')
parser.add_argument('--mode', choices=['auto', 'bundle'], default='bundle')
parser.add_argument('--max-rounds', type=int, default=3)
parser.add_argument('--max-input-bytes', type=int, default=300000)
parser.add_argument('--persistent-curator', action='store_true')
parser.add_argument('--compact-followup', action='store_true')
parser.add_argument('--structured-citations', action='store_true')
parser.add_argument('--coverage-previews', action='store_true')
parser.add_argument('--temporal-decision', action='store_true', help='Experimental conflict-resolution instruction for recall only')
parser.add_argument('--evidence-state', action='store_true', help='Experimental mechanical coverage counters; no semantic quality verdict')
parser.add_argument('--prefetch-wide-originals', action='store_true', help='Experimental full-source batching for complete wide Graphmory pages')
parser.add_argument('--compact-prefetch', action='store_true', help='Omit previews when a complete original prefetch is attached')
parser.add_argument('--basic-config', help='Isolated Basic Memory 0.23.2 hybrid index configuration')
args = parser.parse_args()
lead_model = args.lead_model or args.model
if not 1 <= args.max_rounds <= 10 or args.max_input_bytes < 1000:
    raise RuntimeError('Invalid economic/protocol budget')
if args.compact_followup and not args.persistent_curator:
    raise RuntimeError('Compact follow-up requires persistent Curator context')
if args.prefetch_wide_originals and (args.mode != 'auto' or args.basic_config):
    raise RuntimeError('Original prefetch requires Graphmory auto mode')
if args.compact_prefetch and not args.prefetch_wide_originals:
    raise RuntimeError('Compact prefetch requires original prefetch')
data = pathlib.Path(args.input).resolve()
case = json.loads(data.read_text())[args.case_index]
if set(case) != {'id', 'question', 'vault', 'sources'}:
    raise RuntimeError('Unexpected reader fields, possibly labels')
vault = pathlib.Path(case['vault']).resolve()
for name, expected in case['sources'].items():
    file = vault / name
    if file.is_symlink() or not file.resolve().is_relative_to(vault) or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Invalid source boundary/hash')
basic = None
basic_env = None
indexed_hashes = {}
if args.basic_config:
    basic = json.loads(pathlib.Path(args.basic_config).read_text())
    if set(basic) != {'exe', 'state', 'home', 'notes', 'project'} or any(not isinstance(basic[key], str) or not pathlib.Path(basic[key]).is_absolute() for key in ('exe', 'state', 'home', 'notes')) or not isinstance(basic['project'], str) or not basic['project']:
        raise RuntimeError('Invalid isolated Basic Memory configuration')
    notes = pathlib.Path(basic['notes']).resolve()
    if notes == vault or vault in notes.parents or notes in vault.parents:
        raise RuntimeError('Native index and original vault must be separate')
    for name in case['sources']:
        file = notes / name
        if file.is_symlink() or not file.resolve().is_relative_to(notes) or not file.is_file():
            raise RuntimeError('Missing or unsafe native indexed note')
        indexed_hashes[name] = hashlib.sha256(file.read_bytes()).hexdigest()
    basic_env = dict(os.environ, BASIC_MEMORY_CONFIG_DIR=basic['state'], BASIC_MEMORY_HOME=basic['notes'],
                     XDG_CONFIG_HOME=basic['home'], BASIC_MEMORY_AUTO_UPDATE='false',
                     BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED='true', BASIC_MEMORY_DEFAULT_SEARCH_TYPE='hybrid',
                     BASIC_MEMORY_RERANKER_ENABLED='false')
    version = subprocess.run([basic['exe'], '--version'], env=basic_env, capture_output=True, text=True, timeout=30)
    if version.returncode or version.stdout.strip() != 'Basic Memory version: 0.23.2':
        raise RuntimeError('Basic Memory version mismatch')
out = pathlib.Path(args.out).resolve()
if out.exists():
    raise RuntimeError('Preserve prior trials')
out.mkdir(parents=True, mode=0o700)
workspace = out / 'reader-workspace'
workspace.mkdir()
root = pathlib.Path(__file__).resolve().parents[1]
cli = root / 'scripts/brain-sync.mjs'
report = {'protocol': 'curator-paging-development-v4-tool-error-feedback', 'id': case['id'], 'question': case['question'],
          'retrieval': 'basic-memory-hybrid' if basic else 'graphmory-managed',
          'indexedSourceHashes': indexed_hashes if basic else None,
          'model': args.model, 'leadModel': lead_model, 'mode': args.mode, 'maxRounds': args.max_rounds, 'maxInputBytes': args.max_input_bytes,
          'persistentCurator': args.persistent_curator, 'compactFollowup': args.compact_followup,
          'structuredCitations': args.structured_citations,
          'coveragePreviews': args.coverage_previews,
          'temporalDecision': args.temporal_decision,
          'evidenceState': args.evidence_state, 'evidenceStateSnapshots': [],
          'prefetchWideOriginals': args.prefetch_wide_originals, 'compactPrefetch': args.compact_prefetch, 'prefetch': None,
          'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
          'inputSha256': hashlib.sha256(data.read_bytes()).hexdigest(), 'modelCalls': [], 'pages': [], 'sourceReads': [], 'sourceToolCalls': [], 'sourceRequests': [], 'sourceRequestErrors': [],
          'brief': None, 'answer': None, 'runComplete': False, 'stopReason': None,
          'limitations': ['One exposed development case; no quality acceptance or latency tail claim',
                          'No-tool boundary is checked in trace, not a proven filesystem isolation guarantee',
                          'No official answer scorer or independent calibrated semantic judge',
                          'Subscription bill allocation unknown; native token categories retained']}


def save():
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


def brief_mentions_source(brief, name):
    # Obsidian extensionless links and session headings identify the same exact
    # supplied path. Boundaries prevent note.md.bak / other-note.md false matches.
    stem = name[:-3] if name.endswith('.md') else name
    token = re.escape(stem) + (r'(?:\.md)?' if name.endswith('.md') else '')
    return re.search(r'(?<![\w/\\.-])' + token + r'(?![\w/\\-]|\.\w)', brief) is not None


def classify_source_requests(requested, available, read):
    if any(not isinstance(name, str) or name not in available for name in requested):
        raise RuntimeError('Invalid or unseen source request')
    unique = list(dict.fromkeys(requested))
    return unique, [name for name in unique if name not in read], [name for name in unique if name in read]


def command_json(command):
    started = time.monotonic()
    child = subprocess.run(command, text=True, capture_output=True, timeout=30)
    if child.returncode:
        raise RuntimeError('Graphmory CLI failed')
    return json.loads(child.stdout), len(child.stdout.encode()), round(time.monotonic() - started, 3)


def native_json(command):
    started = time.monotonic()
    child = subprocess.run([basic['exe'], *command], env=basic_env, text=True, capture_output=True, timeout=120)
    if child.returncode:
        raise RuntimeError('Basic Memory CLI failed')
    return json.loads(child.stdout), len(child.stdout.encode()), round(time.monotonic() - started, 3)


def retrieval(offset):
    if basic:
        if offset < 0 or offset % 10:
            raise RuntimeError('Invalid native page offset')
        native, output_bytes, tool_seconds = native_json(['tool', 'search-notes', case['question'], '--project', basic['project'],
            '--local', '--page-size', '10', '--page', str(offset // 10 + 1), '--json', '--hybrid'])
        if not isinstance(native, dict) or not isinstance(native.get('results'), list) or not isinstance(native.get('has_more'), bool):
            raise RuntimeError('Invalid native search response')
        paths = [row.get('file_path') for row in native['results']]
        if any(name not in case['sources'] for name in paths) or len(paths) != len(set(paths)):
            raise RuntimeError('Unmapped or duplicate native search paths')
        page = {'offset': offset, 'nextOffset': offset + 10 if native['has_more'] else None,
                'hasMore': native['has_more'], 'results': [{**row, 'path': row['file_path']} for row in native['results']]}
    else:
        page, output_bytes, tool_seconds = command_json(['node', str(cli), 'recall-managed', '--vault', str(vault), '--query', case['question'],
                                                         '--agent', '--offset', str(offset), '--' + args.mode] +
                                                        (['--coverage-previews'] if args.coverage_previews else []) +
                                                        (['--prefetch-wide-originals'] if args.prefetch_wide_originals else []) +
                                                        (['--compact-prefetch'] if args.compact_prefetch else []))
    if page.get('offset') != offset or not isinstance(page.get('results'), list):
        raise RuntimeError('Invalid retrieval page')
    report['pages'].append({'offset': offset, 'nextOffset': page['nextOffset'], 'hasMore': page['hasMore'],
                            'paths': [row['path'] for row in page['results']],
                            'toolSeconds': tool_seconds, 'toolOutputBytes': output_bytes,
                            'pageSha256': hashlib.sha256(json.dumps(page, sort_keys=True).encode()).hexdigest()})
    save()
    return page


curator_session = None


def generate(prompt, stage, schema):
    global curator_session
    stage_model = lead_model if stage == 'lead' else args.model
    if len(prompt.encode()) > args.max_input_bytes:
        raise RuntimeError('input-byte-budget')
    schema_file = workspace / 'schema.json'
    schema_file.write_text(json.dumps(schema))
    start = time.monotonic()
    resumed = stage == 'curator' and args.persistent_curator and curator_session is not None
    if resumed:
        command = ['codex', 'exec', 'resume', '--ignore-user-config', '--skip-git-repo-check',
                   '-m', stage_model, '-c', 'model_reasoning_effort="low"',
                   '--output-schema', str(schema_file), '--json', curator_session, '-']
    else:
        command = ['codex', 'exec', '--ignore-user-config', '--skip-git-repo-check',
                   '-C', str(workspace), '-s', 'read-only', '-m', stage_model,
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
    identity_failed = False
    if stage == 'curator' and args.persistent_curator:
        identity_failed = not started or (resumed and started != curator_session)
        if not identity_failed:
            curator_session = started
    texts = [event['item']['text'] for event in events if event.get('type') == 'item.completed' and event.get('item', {}).get('type') == 'agent_message']
    prohibited = [event for event in events if event.get('item', {}).get('type') not in (None, 'agent_message', 'reasoning', 'error')]
    complete = next((event for event in reversed(events) if event.get('type') == 'turn.completed'), None)
    failed = identity_failed or child.returncode != 0 or not complete or not texts or prohibited or any(event.get('type') in ('error', 'turn.failed') for event in events)
    host_errors = ' '.join(str(event.get('message', event.get('error', {}))) for event in events if event.get('type') in ('error', 'turn.failed')).lower()
    failure_kind = ('session-identity' if identity_failed else 'prohibited-tool' if prohibited else
                    'usage-limit' if 'usage limit' in host_errors else
                    'unsupported-model' if 'not supported' in host_errors and 'model' in host_errors else
                    'host-error' if failed else None)
    report['modelCalls'].append({'stage': stage, 'model': stage_model, 'sessionResumed': resumed,
                                  'elapsedSeconds': round(time.monotonic() - start, 3),
                                  'promptBytes': len(prompt.encode()), 'promptSha256': hashlib.sha256(prompt.encode()).hexdigest(),
                                  'usage': complete.get('usage') if complete else None, 'failed': bool(failed),
                                  'failureKind': failure_kind,
                                  'sessionIdentityFailed': bool(identity_failed),
                                  'warnings': [event['item'].get('message') for event in events if event.get('item', {}).get('type') == 'error']})
    save()
    if identity_failed:
        raise RuntimeError('Persistent Curator session identity missing or changed')
    if failed:
        raise RuntimeError('Host failed or used prohibited tools; preserve traces')
    return json.loads(texts[-1])


schema = {'type': 'object', 'properties': {'read_paths': {'type': 'array', 'items': {'type': 'string'}},
          'next_page': {'type': 'boolean'}, 'brief': {'type': 'string'}},
          'required': ['read_paths', 'next_page', 'brief'], 'additionalProperties': False}
instruction = ('Act as the memory curator. Use only supplied evidence; never use tools, files or shell directly. '
               'The runner executes memory-tool commands for you. Return read_paths for original notes and next_page=true if more candidates are needed. '
               'The runner determines the exact continuation offset; never calculate it. Only request paths on supplied pages. '
               'When requesting evidence, leave brief empty. When sufficient, use empty read_paths and next_page=false '
               'and return a concise source-cited brief. If hasMore=false, next_page must be false. '
               'sourceReadRequired means displayed previews omit content; previewOmitted does not mean irrelevant. '
               'Preserve speaker, scope, negation and time. Do not guess missing facts. Report uncertainty or incomplete coverage honestly.')
if args.temporal_decision:
    instruction += (' When the same user gives different values for one property, compare the source dates and scope. '
                    'For a current-state question, use the latest applicable user statement; for a previous-state question, '
                    'return the earlier state requested. Do not let a later assistant suggestion override a user statement. '
                    'Cite the relevant source paths; if ordering or scope is unclear, say so instead of guessing.')
if args.evidence_state:
    instruction += (' Evidence state reports mechanical delivery, not relevance or completeness. '
                    'For counts or exhaustive lists, distinguish a supported total from a partial count. '
                    'Check applicable evidence beyond your first match before declaring a total; use pagination or original reads when needed. '
                    'Do not read unrelated notes just to clear counters. If coverage is insufficient, state that limitation.')
save()
start = time.monotonic()
try:
    page = retrieval(0)
    available = set(row['path'] for row in page['results'])
    read = set()
    originals = []
    if args.prefetch_wide_originals:
        report['prefetch'] = page.get('prefetch')
        prefetched = page.pop('originalSources', [])
        if prefetched:
            if page.get('prefetch', {}).get('status') != 'ready' or page['hasMore'] or set(row['path'] for row in prefetched) != available or len(prefetched) != len(available):
                raise RuntimeError('Invalid prefetch delivery')
            for row in prefetched:
                if row['sha256'] != case['sources'].get(row['path']) or hashlib.sha256(row['markdown'].encode()).hexdigest() != row['sha256']:
                    raise RuntimeError('Prefetched original mutated/hash mismatch')
            originals.extend(prefetched)
            read.update(available)
            report['sourceReads'] += [{key: row[key] for key in ('path', 'sha256', 'bytes')} | {'transport': 'recall-prefetch'} for row in prefetched]
            save()
    feedback = None
    for turn in range(args.max_rounds):
        # Only the current page and verified original reads are supplied. Older previews
        # remain discoverable by path but cannot be mistaken for the current continuation.
        if turn and args.compact_followup:
            prompt = ('Continue the same Curator task using your previous context. '
                      'Use the same read_paths/next_page/brief contract. '
                      'New original sources since your last turn: ' + json.dumps(new_originals)
                      + '\nOriginal paths already supplied: ' + json.dumps(sorted(read))
                      + ('\nNew retrieval page: ' + json.dumps(page) if new_page else '')
                      + ('\nProtocol feedback: ' + feedback if feedback else ''))
        else:
            prompt = (instruction + '\nQuestion: ' + case['question']
                      + '\nAvailable paths from previous pages: ' + json.dumps(sorted(available - {row['path'] for row in page['results']}))
                      + '\nCurrent retrieval page: ' + json.dumps(page)
                      + '\nOriginal paths already supplied: ' + json.dumps(sorted(read))
                      + '\nOriginal sources already read: ' + json.dumps(originals)
                      + ('\nProtocol feedback: ' + feedback if feedback else ''))
        if args.evidence_state:
            state = evidence_state(available, read, page)
            report['evidenceStateSnapshots'].append({'turn': turn, **state})
            prompt += '\nEvidence state: ' + json.dumps(state)
        response = generate(prompt, 'curator', schema)
        if set(response) != {'read_paths', 'next_page', 'brief'} or not isinstance(response['read_paths'], list) or not isinstance(response['brief'], str) or not isinstance(response['next_page'], bool):
            raise RuntimeError('Invalid curator response')
        requested, next_page = response['read_paths'], response['next_page']
        try:
            unique_requested, unread, reused = classify_source_requests(requested, available, read)
        except RuntimeError:
            # Refuse the entire request before touching any file or page. A safe
            # relative name not yet observed is a recoverable tool error; unsafe
            # or malformed paths remain terminal boundary violations.
            if any(not isinstance(name, str) or pathlib.PurePosixPath(name).is_absolute()
                   or '\\' in name or '\x00' in name or '..' in name.split('/') for name in requested):
                raise RuntimeError('Invalid or unsafe source request')
            unseen = [name for name in dict.fromkeys(requested) if name not in available]
            report['sourceRequestErrors'].append({'turn': turn, 'code': 'UNSEEN_SOURCE_PATH',
                'unseen': unseen, 'rejectedRequest': requested, 'nextPageRequested': next_page})
            feedback = ('UNSEEN_SOURCE_PATH: no originals or next page were read for the rejected request. '
                        'Unseen paths: ' + json.dumps(unseen)
                        + ('. Request next_page=true with empty read_paths first to observe more candidates, '
                           'or choose paths already supplied.' if page['hasMore'] else
                           '. No more pages; choose supplied paths or report what is missing.')
                        + ' Do not guess filenames.')
            new_originals, new_page = [], False
            save()
            continue
        if not requested and not next_page:
            if not response['brief'].strip():
                raise RuntimeError('Empty final brief')
            report['brief'] = response['brief']
            break
        if response['brief']:
            raise RuntimeError('Brief returned while evidence request pending')
        report['sourceRequests'].append({'turn': turn, 'requested': requested, 'new': unread, 'reused': reused})
        if unread:
            if basic:
                native_sources = []
                for name in unread:
                    native, output_bytes, tool_seconds = native_json(['tool', 'read-note', name, '--project', basic['project'], '--local', '--json'])
                    if not isinstance(native, dict) or native.get('file_path') != name or not isinstance(native.get('content'), str):
                        raise RuntimeError('Invalid native note read')
                    content = native['content']
                    native_sources.append({'path': name, 'sha256': hashlib.sha256(content.encode()).hexdigest(),
                        'markdown': content, 'bytes': len(content.encode()), 'toolOutputBytes': output_bytes,
                        'toolSeconds': tool_seconds, 'originalSha256': case['sources'][name], 'indexedSha256': indexed_hashes[name]})
                    report['sourceToolCalls'].append({'paths': [name], 'toolOutputBytes': output_bytes, 'toolSeconds': tool_seconds})
                sources = {'sources': native_sources}
            else:
                sources, output_bytes, tool_seconds = command_json(['node', str(cli), 'read-notes', '--vault', str(vault), '--paths', json.dumps(unread)])
                report['sourceToolCalls'].append({'paths': unread, 'toolOutputBytes': output_bytes, 'toolSeconds': tool_seconds})
            if set(row['path'] for row in sources['sources']) != set(unread):
                raise RuntimeError('Source delivery mismatch')
            for row in sources['sources']:
                if (not basic and row['sha256'] != case['sources'][row['path']]) or hashlib.sha256(row['markdown'].encode()).hexdigest() != row['sha256']:
                    raise RuntimeError('Original source mutated/hash mismatch')
            report['sourceReads'] += [{key: row[key] for key in ('path', 'sha256', 'bytes', 'toolOutputBytes', 'toolSeconds', 'originalSha256', 'indexedSha256') if key in row} for row in sources['sources']]
            read.update(unread)
            originals.extend(sources['sources'])
        original_by_path = {row['path']: row for row in originals}
        # Full follow-ups already include every original once; compact resumed
        # follow-ups redeliver requested cached originals without disk rereads.
        new_originals = [original_by_path[name] for name in unique_requested]
        feedback_parts = (['Requested originals already supplied: ' + json.dumps(reused)
                           + '. Use those originals or report what is missing.'] if reused else [])
        new_page = False
        if next_page:
            if page['hasMore'] and isinstance(page['nextOffset'], int) and not isinstance(page['nextOffset'], bool):
                page = retrieval(page['nextOffset'])
                available.update(row['path'] for row in page['results'])
                new_page = True
            elif page['hasMore']:
                raise RuntimeError('Invalid CLI continuation contract')
            else:
                feedback_parts.append('No more pages; hasMore=false. Use already supplied evidence or report what is missing.')
        feedback = ' '.join(feedback_parts) or None
        save()
    if report['brief'] is None:
        raise RuntimeError('round-budget')
    answer_schema = {'type': 'object', 'properties': {'answer': {'type': 'string'}}, 'required': ['answer'], 'additionalProperties': False}
    if args.structured_citations:
        answer_schema['properties']['citations'] = {'type': 'array', 'items': {'type': 'string'}}
        answer_schema['required'].append('citations')
    answer = generate('Use only this curator brief. Preserve scope, time, negation and uncertainty. Do not use tools or files. '
                      'Answer concisely with exact source paths; do not invent missing facts.\nQuestion: ' + case['question']
                      + ('\nReturn citations separately: only paths supporting your answer, explicitly cited in the brief and present in verified reads. Use [] for unsupported/abstaining answers.\nVerified read paths: ' + json.dumps(sorted(read)) if args.structured_citations else '')
                      + '\nBrief: ' + report['brief'], 'lead', answer_schema)
    if set(answer) != ({'answer', 'citations'} if args.structured_citations else {'answer'}) or not isinstance(answer['answer'], str) or not answer['answer'].strip():
        raise RuntimeError('Invalid lead answer')
    report['answer'] = answer['answer']
    if args.structured_citations:
        citations = answer['citations']
        report['citations'] = citations
        if not isinstance(citations, list) or any(not isinstance(name, str) or name not in read or not brief_mentions_source(report['brief'], name) for name in citations) or len(set(citations)) != len(citations):
            raise RuntimeError('Invalid lead citation provenance')
        report['citationProvenanceValid'] = True
    for name, expected in case['sources'].items():
        if hashlib.sha256((vault / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Source mutation')
        if basic and hashlib.sha256((notes / name).read_bytes()).hexdigest() != indexed_hashes[name]:
            raise RuntimeError('Native index source mutation')
    report['runComplete'] = True
    report['stopReason'] = 'curator-finalized'
except Exception as error:
    report['stopReason'] = str(error)
    raise
finally:
    report['elapsedSeconds'] = round(time.monotonic() - start, 3)
    save()
    print(json.dumps({'complete': report['runComplete'], 'modelCalls': len(report['modelCalls']), 'readNotes': len(report['sourceReads']), 'stopReason': report['stopReason']}), flush=True)
