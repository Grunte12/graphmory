#!/usr/bin/env python3
"""No-model, source-free accounting for legacy versus packed collection."""
import argparse
import hashlib
import json
import pathlib
import tempfile
import time

from curator_collection import collect_explicit_sources

ROOT = pathlib.Path(__file__).resolve().parents[1]
CODE = ['scripts/preflight-collection-packing.py', 'scripts/curator_collection.py',
        'scripts/brain-sync.mjs', 'src/source-read.mjs']


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--case-index', type=int, default=0)
    args = parser.parse_args()
    target = pathlib.Path(args.out).resolve()
    if target.exists():
        raise RuntimeError('Preserve existing preflight records')
    reader = pathlib.Path(args.input).resolve()
    case = json.loads(reader.read_text())[args.case_index]
    if set(case) != {'id', 'question', 'vault', 'sources'} or not case['sources']:
        raise RuntimeError('Reader must be label-free with an explicit original scope')
    vault = pathlib.Path(case['vault']).resolve()
    originals = {}
    for name, expected in sorted(case['sources'].items()):
        file = vault / name
        if file.is_symlink() or not file.resolve().is_relative_to(vault):
            raise RuntimeError('Unsafe source boundary')
        raw = file.read_bytes()
        if sha(raw) != expected:
            raise RuntimeError('Original hash mismatch')
        raw.decode('utf-8')
        originals[name] = raw
    code_hashes = {name: sha((ROOT / name).read_bytes()) for name in CODE}
    result = {'protocol': 'collection-packing-transport-preflight-v1', 'id': case['id'],
              'readerSha256': sha(reader.read_bytes()), 'codeHashes': code_hashes,
              'configuration': {'maxPageBytes': 150000, 'maxPages': 32,
                                'maxMapCalls': 2, 'maxInputBytes': 300000},
              'sources': [{'path': name, 'sha256': case['sources'][name], 'bytes': len(raw)}
                          for name, raw in originals.items()], 'arms': [],
              'limitations': ['Empty span callbacks; no model inference or answer scoring',
                              'Mapped bytes do not prove semantic extraction completeness',
                              'No actual synthesis prompt or ledger/output budget validation',
                              'CLI timing excludes inference, billing and host context']}
    for packed in (False, True):
        callbacks, ranges = [], {name: [] for name in originals}

        def generate(prompt, stage, schema):
            encoded = prompt.encode('utf-8')
            if len(encoded) > 300000 or len(callbacks) >= 2:
                raise RuntimeError('Callback exceeded frozen economic ceiling')
            marker = 'Original source page fragments (these are the only text to map now):\n'
            fragments, _ = json.JSONDecoder().raw_decode(prompt.split(marker, 1)[1])
            metadata = []
            for fragment in fragments:
                name = fragment['path']
                if name not in originals or fragment['sourceSha256'] != case['sources'][name]:
                    raise RuntimeError('Mapped source identity mismatch')
                start, end = fragment['byteStart'], fragment['byteEnd']
                raw = originals[name]
                if (not 0 <= start <= end <= len(raw)
                    or raw[start:end] != fragment['text'].encode('utf-8')
                    or fragment['startsMidLine'] or fragment['endsMidLine']
                    or (start and raw[start - 1:start] != b'\n')
                    or (end < len(raw) and raw[end - 1:end] != b'\n')
                    or fragment['startLine'] != raw[:start].count(b'\n') + 1
                    or fragment['endLine'] != raw[:end].count(b'\n') + 1):
                    raise RuntimeError('Mapped bytes or line boundary mismatch')
                ranges[name].append((start, end))
                metadata.append({key: fragment[key] for key in ('path', 'sourceSha256',
                    'byteStart', 'byteEnd', 'startLine', 'endLine')})
            callbacks.append({'promptBytes': len(encoded), 'promptSha256': sha(encoded),
                              'stage': stage, 'fragments': metadata})
            return {'spans': []}

        with tempfile.TemporaryDirectory(prefix='graphmory-pack-preflight-') as private:
            started = time.monotonic()
            collected = collect_explicit_sources(cli=ROOT / 'scripts/brain-sync.mjs',
                vault=vault, private_dir=pathlib.Path(private) / 'state',
                source_hashes=case['sources'], scope_label='exposed-history-transport',
                question=case['question'], max_page_bytes=150000, max_pages=32,
                max_input_bytes=300000, max_map_calls=2, generate=generate,
                **({'pack_prompts': True} if packed else {}))
            elapsed = time.monotonic() - started
            summary = collected['summary']
            coverage = []
            for name, raw in originals.items():
                cursor, valid = 0, True
                for start, end in sorted(ranges[name]):
                    valid = valid and start == cursor and end >= start
                    cursor = end
                coverage.append({'path': name, 'mappedBytes': sum(b - a for a, b in ranges[name]),
                                 'sourceBytes': len(raw),
                                 'exactComplete': valid and cursor == len(raw)})
            keys = ['deliveryComplete', 'semanticCompleteness', 'incompleteReason',
                    'sourceCount', 'deliveredSources', 'mapCalls', 'candidateSpans',
                    'verifiedSpans', 'ledgerEntries', 'unreadSources', 'pages',
                    'attemptedPromptBytes', 'plannedMapCalls', 'mappingComplete',
                    'unmappedSources', 'mappingCoverage', 'mapBatches']
            result['arms'].append({'arm': 'packed' if packed else 'legacy',
                'complete': collected['complete'],
                'summary': {key: summary[key] for key in keys if key in summary},
                'callbacks': callbacks, 'coverage': coverage,
                'preflightSeconds': round(elapsed, 3),
                'transportGate': collected['complete'] and all(x['exactComplete'] for x in coverage),
                'toolOutputBytes': sum(x['toolOutputBytes'] for x in collected['toolCalls']),
                'toolSeconds': round(sum(x['toolSeconds'] for x in collected['toolCalls']), 3)})
        if any(sha((vault / name).read_bytes()) != case['sources'][name] for name in originals):
            raise RuntimeError('Source drift during preflight')
        if any(sha((ROOT / name).read_bytes()) != expected for name, expected in code_hashes.items()):
            raise RuntimeError('Code drift during preflight')
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x') as file:
        file.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'id': case['id'], 'arms': [
        {'arm': a['arm'], 'transportGate': a['transportGate'],
         'mapCalls': len(a['callbacks']), 'promptBytes': [c['promptBytes'] for c in a['callbacks']],
         'stop': a['summary'].get('incompleteReason')} for a in result['arms']]}))


if __name__ == '__main__':
    main()
