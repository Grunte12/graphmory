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

    def run_collection(self, texts, mapper, page_bytes=650, max_pages=12, max_map_calls=None):
        hashes = {}
        for name, body in texts.items():
            (self.vault / name).write_text(body)
            hashes[name] = hashlib.sha256(body.encode()).hexdigest()
        return collection.collect_explicit_sources(
            cli=ROOT / 'scripts/brain-sync.mjs', vault=self.vault,
            private_dir=self.root / 'state', source_hashes=hashes,
            scope_label='fixed-fixture', question='Which fact?',
            max_page_bytes=page_bytes, max_pages=max_pages,
            max_input_bytes=10000,
            generate=lambda prompt, stage, schema: mapper(prompt, hashes),
            max_map_calls=max_map_calls,
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
                if name == 'collection':
                    self.assertEqual(report['collection']['ledgerEntries'], 1)
                    self.assertEqual(report['collection']['verifiedSpans'], 1)


if __name__ == '__main__':
    unittest.main()
