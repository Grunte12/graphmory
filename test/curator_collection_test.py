"""Real CLI contract checks for the opt-in collection helper; no model calls."""

import hashlib
import importlib.util
import json
import pathlib
import os
import subprocess
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('curator_collection', ROOT / 'scripts/curator_collection.py')
collection = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collection)


class CollectionCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='graphmory-collection-test-', dir='/private/tmp')
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.vault = self.root / 'vault'
        self.vault.mkdir()

    def run_collection(self, texts, mapper, page_bytes=650, max_pages=12, max_map_calls=None,
                       max_input_bytes=10000, pack_prompts=False):
        hashes = {}
        for name, body in texts.items():
            (self.vault / name).write_text(body)
            hashes[name] = hashlib.sha256(body.encode()).hexdigest()
        return collection.collect_explicit_sources(
            cli=ROOT / 'scripts/brain-sync.mjs', vault=self.vault,
            private_dir=self.root / 'state', source_hashes=hashes,
            scope_label='fixed-fixture', question='Which fact?',
            max_page_bytes=page_bytes, max_pages=max_pages,
            max_input_bytes=max_input_bytes,
            generate=lambda prompt, stage, schema: mapper(prompt, hashes),
            max_map_calls=max_map_calls,
            pack_prompts=pack_prompts,
        )

    def test_common_source_index_expands_read_allowlist_only_when_requested(self):
        sources = {'a.md': 'hash-a', 'b.md': 'hash-b'}
        page = {'a.md'}
        self.assertEqual(collection.source_paths_for_mediator(sources, page, False), {'a.md'})
        self.assertEqual(collection.source_paths_for_mediator(sources, page, True), {'a.md', 'b.md'})

    def test_exact_original_span_is_recorded(self):
        line = 'The delivery date is 9 October.'
        def mapper(prompt, hashes):
            return {'spans': [{'path': 'fact.md', 'source_sha256': hashes['fact.md'],
                               'start_line': 1, 'end_line': 1, 'quote': line,
                               'fact': 'Delivery is 9 October.'}]}
        result = self.run_collection({'fact.md': line + '\n'}, mapper, page_bytes=2000)
        self.assertTrue(result['complete'])
        self.assertEqual(result['summary']['verifiedSpans'], 1)
        self.assertEqual(result['summary']['ledgerEntries'], 1)
        self.assertEqual(result['synthesisContext']['verifiedSpans'][0]['quote'], line)

    def test_early_span_survives_later_empty_source(self):
        line = 'Orion was founded in 2019.'
        def mapper(prompt, hashes):
            if line not in prompt:
                return {'spans': []}
            return {'spans': [{'path': 'a.md', 'source_sha256': hashes['a.md'],
                               'start_line': 1, 'end_line': 1, 'quote': line,
                               'fact': 'Founding year 2019.'}]}
        result = self.run_collection({'a.md': line + '\n', 'b.md': 'No related fact.\n'}, mapper)
        self.assertTrue(result['complete'])
        self.assertEqual(result['summary']['ledgerEntries'], 1)
        self.assertEqual(result['summary']['deliveredSources'], 2)

    def test_split_line_assembled_before_mapping(self):
        line = 'Fact: ' + 'long evidence ' * 100
        def mapper(prompt, hashes):
            if line not in prompt:
                return {'spans': []}
            return {'spans': [{'path': 'fact.md', 'source_sha256': hashes['fact.md'],
                               'start_line': 1, 'end_line': 1, 'quote': line,
                               'fact': 'The long line is evidence.'}]}
        result = self.run_collection({'fact.md': line + '\n'}, mapper, page_bytes=650, max_pages=20)
        self.assertTrue(result['complete'], result['summary'].get('incompleteReason'))
        self.assertGreater(len(result['summary']['pages']), 1)
        self.assertEqual(result['summary']['verifiedSpans'], 1)
        self.assertEqual(result['summary']['ledgerEntries'], 1)

    def test_map_call_cap_stops_large_scope_before_synthesis(self):
        body = ''.join(f'Fact row {number:02d} is deliberately separate.\n' for number in range(60))
        result = self.run_collection({'fact.md': body}, lambda *_: {'spans': []},
                                     page_bytes=650, max_pages=30, max_map_calls=2)
        self.assertFalse(result['complete'])
        self.assertEqual(result['summary']['incompleteReason'], 'collection-map-call-budget')
        self.assertEqual(result['summary']['mapCalls'], 2)
        self.assertIsNone(result['synthesisContext'])

    def test_packed_prompts_preserve_unicode_json_and_map_source_ranges_once(self):
        body = ''.join(
            f'Row {number:03d}: π🙂 has "quotes" and \\ slashes; U+2028 is here\u2028too.\n'
            for number in range(48)
        )
        prompts = []
        result = self.run_collection(
            {'unicode.md': body}, lambda prompt, _: (prompts.append(prompt) or {'spans': []}),
            page_bytes=650, max_pages=40, max_input_bytes=2400, pack_prompts=True,
        )
        self.assertTrue(result['complete'], result['summary'].get('incompleteReason'))
        self.assertGreater(len(result['summary']['pages']), 1)
        self.assertGreater(len(prompts), 1)
        self.assertEqual(result['summary']['plannedMapCalls'], len(prompts))
        self.assertTrue(all(len(prompt.encode('utf-8')) <= 2400 for prompt in prompts))
        self.assertTrue(all('Previously validated candidate facts' not in prompt for prompt in prompts))

        displayed = []
        for prompt in prompts:
            marker = '\nOriginal source page fragments (these are the only text to map now):\n'
            payload = prompt.split(marker, 1)[1].split('\nUser question:\n', 1)[0]
            displayed.extend(json.loads(payload))
        displayed.sort(key=lambda fragment: fragment['byteStart'])
        self.assertEqual(''.join(fragment['text'] for fragment in displayed), body)
        self.assertTrue(all(
            fragment['endLine'] - fragment['startLine'] == fragment['text'].count('\n')
            for fragment in displayed
        ))
        self.assertEqual(displayed[0]['byteStart'], 0)
        self.assertEqual(displayed[-1]['byteEnd'], len(body.encode('utf-8')))
        self.assertTrue(all(left['byteEnd'] == right['byteStart'] for left, right in zip(displayed, displayed[1:])))
        coverage = result['summary']['mappingCoverage']
        self.assertEqual(len(coverage), len(displayed))
        self.assertTrue(all(row['mapped'] for row in coverage))
        self.assertTrue(any(len(row['pageRefs']) > 1 for row in coverage))
        self.assertEqual(result['summary']['mappedSourceCoverage'][0]['mappedBytes'], len(body.encode('utf-8')))

    def test_packed_same_path_ranges_can_verify_exact_quotes(self):
        lines = [f'Original event {number:02d} happened in year {2000 + number}.\n' for number in range(28)]
        body = ''.join(lines)
        hashes = {'facts.md': hashlib.sha256(body.encode()).hexdigest()}
        seen = []

        def mapper(prompt, _):
            seen.append(prompt)
            first = lines[0].rstrip('\n')
            last = lines[-1].rstrip('\n')
            return {'spans': [
                {'path': 'facts.md', 'source_sha256': hashes['facts.md'], 'start_line': 1,
                 'end_line': 1, 'quote': first, 'fact': 'First event in 2000.'},
                {'path': 'facts.md', 'source_sha256': hashes['facts.md'], 'start_line': len(lines),
                 'end_line': len(lines), 'quote': last, 'fact': 'Last event in 2027.'},
            ]}

        result = self.run_collection(
            {'facts.md': body}, mapper, page_bytes=650, max_pages=40,
            max_input_bytes=10000, pack_prompts=True,
        )
        self.assertTrue(result['complete'], result['summary'].get('incompleteReason'))
        self.assertEqual(len(seen), 1)
        self.assertEqual(result['summary']['verifiedSpans'], 2)
        self.assertEqual(result['summary']['ledgerEntries'], 2)
        self.assertEqual({row['path'] for row in result['synthesisContext']['verifiedSpans']}, {'facts.md'})
        self.assertGreater(len(result['summary']['pages']), 1)
        self.assertTrue(any(len(row['pageRefs']) > 1 for row in result['summary']['mappingCoverage']))

    def test_packed_oversized_whole_line_fails_before_any_model_call(self):
        body = 'Oversized line: ' + ('界🙂' * 1400)
        calls = []
        result = self.run_collection(
            {'large.md': body}, lambda *args: (calls.append(args) or {'spans': []}),
            page_bytes=650, max_pages=100, max_input_bytes=1400, pack_prompts=True,
        )
        self.assertFalse(result['complete'])
        self.assertEqual(result['summary']['incompleteReason'], 'collection-map-input-byte-budget')
        self.assertEqual(calls, [])
        self.assertEqual(result['summary']['mapCalls'], 0)
        self.assertTrue(result['summary']['deliveryComplete'])
        self.assertFalse(result['summary']['mappingComplete'])
        self.assertEqual(result['summary']['unreadSources'], [])
        self.assertEqual(result['summary']['unmappedSources'], ['large.md'])

    def test_packed_map_call_budget_is_preflighted_before_any_model_call(self):
        body = ''.join(f'Fact row {number:04d} is separately recorded.\n' for number in range(160))
        calls = []
        result = self.run_collection(
            {'many.md': body}, lambda *args: (calls.append(args) or {'spans': []}),
            page_bytes=650, max_pages=100, max_input_bytes=1500,
            max_map_calls=2, pack_prompts=True,
        )
        self.assertFalse(result['complete'])
        self.assertEqual(result['summary']['incompleteReason'], 'collection-map-call-budget')
        self.assertGreater(result['summary']['plannedMapCalls'], 2)
        self.assertEqual(calls, [])
        self.assertEqual(result['summary']['mapCalls'], 0)
        self.assertTrue(result['summary']['deliveryComplete'])
        self.assertFalse(result['summary']['mappingComplete'])
        self.assertEqual(result['summary']['unmappedSources'], ['many.md'])

    def test_packed_rejected_quote_cannot_reach_synthesis_context(self):
        body = 'The source says the date is 9 October.\n'
        def mapper(_, hashes):
            return {'spans': [{'path': 'fact.md', 'source_sha256': hashes['fact.md'],
                               'start_line': 1, 'end_line': 1, 'quote': 'The date is 10 October.',
                               'fact': 'The date is 10 October.'}]}
        result = self.run_collection(
            {'fact.md': body}, mapper, page_bytes=650, max_pages=8,
            max_input_bytes=10000, pack_prompts=True,
        )
        self.assertFalse(result['complete'])
        self.assertEqual(result['summary']['incompleteReason'], 'collection-map-rejected-spans')
        self.assertFalse(result['summary']['mappingComplete'])
        self.assertIsNone(result['synthesisContext'])
        self.assertEqual(result['summary']['verifiedSpans'], 0)
        self.assertTrue(result['summary']['rejectedSpans'])

    def test_runner_budget_stops_before_model_or_lead(self):
        body = 'A verifiable fixture fact.\n'
        (self.vault / 'fact.md').write_text(body)
        reader = self.root / 'reader.json'
        reader.write_text(json.dumps([{
            'id': 'fixture', 'question': 'What is the fact?', 'vault': str(self.vault),
            'sources': {'fact.md': hashlib.sha256(body.encode()).hexdigest()},
        }]))
        out = self.root / 'trial'
        command = [sys.executable, str(ROOT / 'scripts/run-curator-paging-pilot.py'),
                   '--input', str(reader), '--out', str(out), '--source-index',
                   '--collection-ledger', '--max-input-bytes', '1000']
        child = subprocess.run(command, capture_output=True, timeout=30)
        self.assertNotEqual(child.returncode, 0)
        report = json.loads((out / 'report.json').read_text())
        self.assertEqual(report['modelCalls'], [])
        self.assertIsNone(report['answer'])
        self.assertEqual(report['collection']['incompleteReason'], 'collection-map-input-byte-budget')
        self.assertTrue(report['sourceIndex'])
        self.assertTrue(report['collectionLedger'])

    def test_both_graph_arms_reach_lead_with_fake_host(self):
        body = 'The delivery date is 9 October.\n'
        (self.vault / 'fact.md').write_text(body)
        digest = hashlib.sha256(body.encode()).hexdigest()
        reader = self.root / 'reader.json'
        reader.write_text(json.dumps([{
            'id': 'fixture', 'question': 'When is delivery?', 'vault': str(self.vault),
            'sources': {'fact.md': digest},
        }]))
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        fake = bin_dir / 'codex'
        fake.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
schema = json.loads(pathlib.Path(args[args.index('--output-schema') + 1]).read_text())
prompt = sys.stdin.read()
fields = set(schema['properties'])
if 'spans' in fields:
    result = {'spans': [{'path': 'fact.md', 'source_sha256': os.environ['TEST_SOURCE_SHA'],
        'start_line': 1, 'end_line': 1, 'quote': 'The delivery date is 9 October.',
        'fact': 'Delivery is 9 October.'}]}
elif 'read_paths' in fields:
    result = {'read_paths': ['fact.md'], 'next_page': False, 'brief': ''} if 'Original sources already read: []' in prompt else {'read_paths': [], 'next_page': False, 'brief': 'Delivery is 9 October (fact.md).'}
elif 'brief' in fields:
    result = {'brief': 'Delivery is 9 October (fact.md).'}
else:
    result = {'answer': '9 October'}
    if 'citations' in fields: result['citations'] = ['fact.md']
print(json.dumps({'type': 'item.completed', 'item': {'type': 'agent_message', 'text': json.dumps(result)}}))
print(json.dumps({'type': 'turn.completed', 'usage': {'input_tokens': 10, 'output_tokens': 5}}))
''')
        fake.chmod(0o700)
        basic_exe = bin_dir / 'basic-memory-fixture'
        basic_exe.write_text('''#!/usr/bin/env python3
import json, sys
if '--version' in sys.argv:
    print('Basic Memory version: 0.23.2')
else:
    print(json.dumps({'results': [{'file_path': 'fact.md'}], 'has_more': False}))
''')
        basic_exe.chmod(0o700)
        indexed = self.root / 'indexed'
        indexed.mkdir()
        (indexed / 'fact.md').write_text(body)
        for name in ('state', 'home'):
            (self.root / name).mkdir()
        config = self.root / 'basic-config.json'
        config.write_text(json.dumps({
            'exe': str(basic_exe), 'state': str(self.root / 'state'),
            'home': str(self.root / 'home'), 'notes': str(indexed), 'project': 'fixture',
        }))
        env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'],
                   TEST_SOURCE_SHA=digest, PYTHONDONTWRITEBYTECODE='1')
        for name, flags in [('control', []), ('collection', ['--collection-ledger']),
                            ('packed-collection', ['--collection-ledger', '--collection-pack-prompts']),
                            ('ranked', ['--ranked-originals']),
                            ('basic', ['--basic-config', str(config)])]:
            with self.subTest(name=name):
                out = self.root / name
                child = subprocess.run([sys.executable, str(ROOT / 'scripts/run-curator-paging-pilot.py'),
                    '--input', str(reader), '--out', str(out), '--source-index',
                    '--structured-citations', '--mode', 'auto', '--max-rounds', '3',
                    '--max-input-bytes', '10000', *flags],
                    env=env, capture_output=True, timeout=30)
                self.assertEqual(child.returncode, 0, child.stderr.decode(errors='replace')[-500:])
                report = json.loads((out / 'report.json').read_text())
                self.assertTrue(report['runComplete'])
                self.assertEqual(report['answer'], '9 October')
                self.assertEqual(report['citations'], ['fact.md'])
                self.assertEqual(report['sourceReads'][0]['path'], 'fact.md')
                if name in ('collection', 'packed-collection'):
                    self.assertEqual(report['collection']['ledgerEntries'], 1)
                    self.assertEqual(report['collection']['verifiedSpans'], 1)
                if name == 'packed-collection':
                    self.assertTrue(report['collectionPackPrompts'])
                    self.assertTrue(report['collection']['mappingComplete'])
                    self.assertEqual(report['collection']['plannedMapCalls'], 1)
                if name == 'ranked':
                    self.assertEqual(report['rankedOriginalsDelivery']['selectedCount'], 1)
                    self.assertEqual(report['sourceReads'][0]['transport'], 'ranked-originals')


if __name__ == '__main__':
    unittest.main()
