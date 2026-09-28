import contextlib
import io
import json
import pathlib
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNNER_PATH = ROOT / 'scripts/run-ranked-original-three-arm.py'
RUNNER = {'__name__': 'ranked_original_three_arm_under_test', '__file__': str(RUNNER_PATH)}
exec(compile(RUNNER_PATH.read_text(), str(RUNNER_PATH), 'exec'), RUNNER)


def make_manifest(authorized=False):
    return {
        'protocol': RUNNER['PROTOCOL'],
        'frozenBeforeGeneration': True,
        'order': [{'id': case, 'arm': arm} for case, arm in RUNNER['ORDER']],
        'configuration': {
            'curator': 'gpt-5.6-luna', 'lead': 'gpt-5.6-sol',
            'maxRounds': 3, 'maxInputBytes': 300000, 'structuredCitations': True,
        },
        'codeHashes': {'scripts/run-curator-paging-pilot.py': 'runner-hash'},
        'cases': [
            {'id': case, 'readerInput': case + '.json', 'readerSha256': case + '-reader-hash',
             'basicConfig': case + '-basic.json'}
            for case in ('gpt4_d84a3211', '67e0d0f2')
        ],
        **({'continueResourceFailures': True} if authorized else {}),
    }


def resource_report(case_id, arm, entry):
    return {
        'id': case_id,
        'runnerSha256': 'runner-hash',
        'inputSha256': entry['readerSha256'],
        'model': 'gpt-5.6-luna',
        'leadModel': 'gpt-5.6-sol',
        'mode': 'auto',
        'maxRounds': 3,
        'maxInputBytes': 300000,
        'structuredCitations': True,
        'sourceIndex': True,
        'rankedOriginals': arm == 'ranked',
        'retrieval': 'basic-memory-hybrid' if arm == 'basic' else 'graphmory-managed',
        'sourceRequestErrors': [],
        'modelCalls': [
            {'stage': 'curator', 'model': 'gpt-5.6-luna', 'failed': False,
             'failureKind': None, 'sessionIdentityFailed': False},
        ],
        'runComplete': False,
        'stopReason': 'input-byte-budget',
    }


class RankedOriginalRunnerTest(unittest.TestCase):
    def setup_run(self, temp, authorized=False):
        root = pathlib.Path(temp)
        manifest_path = root / 'manifest.json'
        manifest_path.write_text(json.dumps(make_manifest(authorized)))
        output = root / 'output'
        cases = {
            case: {'readerInput': case + '.json', 'readerSha256': case + '-reader-hash',
                   'basicConfig': case + '-basic.json'}
            for case in ('gpt4_d84a3211', '67e0d0f2')
        }
        RUNNER['ROOT'] = root
        return manifest_path, output, cases

    def fake_child(self, report_for_index, after_run=None):
        calls = []

        def run(command, **kwargs):
            index = len(calls)
            calls.append(command)
            trial = pathlib.Path(command[command.index('--out') + 1])
            trial.mkdir(parents=True)
            case_id, arm = RUNNER['ORDER'][index]
            entry = {
                'readerSha256': case_id + '-reader-hash',
            }
            report, exit_code = report_for_index(index, case_id, arm, entry)
            (trial / 'report.json').write_text(json.dumps(report))
            if after_run:
                after_run(index)
            return SimpleNamespace(returncode=exit_code, stdout='', stderr='')

        return calls, run

    def invoke(self, manifest_path, output, allow=False):
        argv = ['runner', '--manifest', str(manifest_path), '--out', str(output)]
        if allow:
            argv.append('--continue-resource-failures')
        stdout = io.StringIO()
        with patch('sys.argv', argv), contextlib.redirect_stdout(stdout):
            status = RUNNER['main']()
        return status, stdout.getvalue()

    def test_default_stops_at_first_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, cases = self.setup_run(temp)
            calls, child = self.fake_child(
                lambda _i, case, arm, entry: (resource_report(case, arm, entry), 1))
            verifier = Mock(return_value=cases)
            with patch.dict(RUNNER, {'verify': verifier}), patch.object(RUNNER['subprocess'], 'run', side_effect=child):
                status, _ = self.invoke(manifest, output)
            ledger = json.loads((output / 'ledger.json').read_text())
            self.assertEqual(status, 1)
            self.assertEqual(len(calls), 1)
            self.assertEqual(ledger['attempts'][0]['status'], 'failed')
            self.assertTrue(all(row['status'] == 'unattempted' for row in ledger['attempts'][1:]))
            self.assertFalse(ledger['continueResourceFailures'])

    def test_option_requires_manifest_authorization(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, _cases = self.setup_run(temp, authorized=False)
            verifier = Mock()
            with patch.dict(RUNNER, {'verify': verifier}), patch('sys.argv', [
                'runner', '--manifest', str(manifest), '--out', str(output), '--continue-resource-failures'
            ]):
                with self.assertRaisesRegex(RuntimeError, 'does not authorize'):
                    RUNNER['main']()
            verifier.assert_not_called()
            self.assertFalse(output.exists())

    def test_authorized_resource_failure_continues_but_batch_exits_nonzero(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, cases = self.setup_run(temp, authorized=True)

            def report_for_index(index, case, arm, entry):
                if index == 0:
                    return resource_report(case, arm, entry), 1
                return ({'runComplete': True, 'stopReason': 'curator-finalized', 'modelCalls': [{}]}, 0)

            calls, child = self.fake_child(report_for_index)
            verifier = Mock(return_value=cases)
            with patch.dict(RUNNER, {'verify': verifier}), patch.object(RUNNER['subprocess'], 'run', side_effect=child):
                status, _ = self.invoke(manifest, output, allow=True)
            ledger = json.loads((output / 'ledger.json').read_text())
            self.assertEqual(status, 1)
            self.assertEqual(len(calls), 6)
            self.assertEqual([row['status'] for row in ledger['attempts']], ['failed'] + ['complete'] * 5)
            self.assertEqual(ledger['continuedAfterResourceFailures'], [
                {'trial': 0, 'id': 'gpt4_d84a3211', 'arm': 'graph', 'stopReason': 'input-byte-budget'}
            ])
            self.assertEqual(ledger['continuationRevalidations'], 5)
            self.assertEqual(verifier.call_count, 6)

    def test_host_failure_is_hard_stop_even_with_authorization(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, cases = self.setup_run(temp, authorized=True)

            def report_for_index(_index, case, arm, entry):
                report = resource_report(case, arm, entry)
                report.update(stopReason='Host failed or used prohibited tools; preserve traces',
                              modelCalls=[{'stage': 'curator', 'model': 'gpt-5.6-luna', 'failed': True,
                                           'failureKind': 'unsupported-model', 'sessionIdentityFailed': False}])
                return report, 1

            calls, child = self.fake_child(report_for_index)
            verifier = Mock(return_value=cases)
            with patch.dict(RUNNER, {'verify': verifier}), patch.object(RUNNER['subprocess'], 'run', side_effect=child):
                status, _ = self.invoke(manifest, output, allow=True)
            ledger = json.loads((output / 'ledger.json').read_text())
            self.assertEqual(status, 1)
            self.assertEqual(len(calls), 1)
            self.assertEqual(ledger['stopped'], 'Host failed or used prohibited tools; preserve traces')
            self.assertEqual(ledger['continuationRevalidations'], 0)

    def test_resource_classifier_requires_clean_explicit_host_calls(self):
        manifest = make_manifest(authorized=True)
        settings = manifest['configuration']
        case = 'gpt4_d84a3211'
        entry = {'readerSha256': case + '-reader-hash'}
        report = resource_report(case, 'graph', entry)
        classify = RUNNER['recoverable_resource_failure']
        self.assertTrue(classify(report, 1, False, case, 'graph', entry, settings, manifest))
        for mutate in (
            lambda row: row['modelCalls'][0].pop('failed'),
            lambda row: row.update(modelCalls=[]),
            lambda row: row['modelCalls'][0].update(failed=True),
            lambda row: row.update(sourceRequestErrors=[{'code': 'UNSEEN_SOURCE_PATH'}]),
            lambda row: row.update(runComplete=True),
            lambda row: row.update(stopReason='Host failed'),
        ):
            candidate = json.loads(json.dumps(report))
            mutate(candidate)
            self.assertFalse(classify(candidate, 1, False, case, 'graph', entry, settings, manifest))
        self.assertFalse(classify(report, 0, False, case, 'graph', entry, settings, manifest))
        self.assertFalse(classify(report, 1, True, case, 'graph', entry, settings, manifest))

    def test_source_reverification_failure_stops_before_next_slot(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, cases = self.setup_run(temp, authorized=True)
            calls, child = self.fake_child(
                lambda _i, case, arm, entry: (resource_report(case, arm, entry), 1))
            verifier = Mock(side_effect=[cases, RuntimeError('Frozen source drift')])
            with patch.dict(RUNNER, {'verify': verifier}), patch.object(RUNNER['subprocess'], 'run', side_effect=child):
                status, _ = self.invoke(manifest, output, allow=True)
            ledger = json.loads((output / 'ledger.json').read_text())
            self.assertEqual(status, 1)
            self.assertEqual(len(calls), 1)
            self.assertEqual(verifier.call_count, 2)
            self.assertEqual(ledger['stopped'], 'pre-continuation-integrity-reverification-failed')
            self.assertEqual(ledger['reverificationError'], 'Frozen source drift')
            self.assertTrue(all(row['status'] == 'unattempted' for row in ledger['attempts'][1:]))

    def test_manifest_change_stops_before_source_reverification_or_next_slot(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest, output, cases = self.setup_run(temp, authorized=True)
            calls, child = self.fake_child(
                lambda _i, case, arm, entry: (resource_report(case, arm, entry), 1),
                after_run=lambda index: manifest.write_text(manifest.read_text() + ' ')
                if index == 0 else None)
            verifier = Mock(return_value=cases)
            with patch.dict(RUNNER, {'verify': verifier}), patch.object(RUNNER['subprocess'], 'run', side_effect=child):
                status, _ = self.invoke(manifest, output, allow=True)
            ledger = json.loads((output / 'ledger.json').read_text())
            self.assertEqual(status, 1)
            self.assertEqual(len(calls), 1)
            verifier.assert_called_once()
            self.assertIn('manifest changed', ledger['reverificationError'])
            self.assertTrue(all(row['status'] == 'unattempted' for row in ledger['attempts'][1:]))


if __name__ == '__main__':
    unittest.main()
