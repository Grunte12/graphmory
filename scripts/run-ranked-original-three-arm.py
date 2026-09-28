#!/usr/bin/env python3
"""Run one frozen, label-free six-workflow development screen."""

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import time


ROOT = pathlib.Path(__file__).resolve().parents[1]
PROTOCOL = 'ranked-original-three-arm-development-v1'
REQUIRED_CODE_HASHES = (
    'scripts/run-ranked-original-three-arm.py',
    'scripts/run-curator-paging-pilot.py',
    'scripts/brain-sync.mjs',
    'src/memory-recall.mjs',
    'src/decision-recall.mjs',
)
ORDER = [
    ('gpt4_d84a3211', 'graph'), ('gpt4_d84a3211', 'ranked'),
    ('gpt4_d84a3211', 'basic'), ('67e0d0f2', 'basic'),
    ('67e0d0f2', 'ranked'), ('67e0d0f2', 'graph'),
]


def digest(file):
    return hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest()


def verify(manifest):
    if (manifest.get('protocol') != PROTOCOL or manifest.get('frozenBeforeGeneration') is not True
        or manifest.get('order') != [{'id': case, 'arm': arm} for case, arm in ORDER]
        or manifest.get('configuration', {}).get('maxRounds') != 3
        or manifest['configuration'].get('maxInputBytes') != 300000
        or manifest['configuration'].get('structuredCitations') is not True
        or not all(isinstance(manifest['configuration'].get(key), str) and manifest['configuration'][key]
                   for key in ('curator', 'lead'))):
        raise RuntimeError('Unknown or unfrozen development protocol')
    if digest(ROOT / 'tmp/datasets/longmemeval_s_cleaned.json') != manifest.get('datasetSha256'):
        raise RuntimeError('Pinned dataset drift')
    for name, expected in manifest.get('codeHashes', {}).items():
        file = (ROOT / name).resolve()
        if not file.is_relative_to(ROOT) or digest(file) != expected:
            raise RuntimeError('Frozen code drift: ' + name)
    if not all(name in manifest.get('codeHashes', {}) for name in REQUIRED_CODE_HASHES):
        raise RuntimeError('Frozen core code hashes missing')
    cases = manifest.get('cases')
    if not isinstance(cases, list) or [row.get('id') for row in cases] != ['gpt4_d84a3211', '67e0d0f2']:
        raise RuntimeError('Unexpected case book')
    for entry in cases:
        for key in ('readerInput', 'readerSha256', 'basicConfig', 'basicConfigSha256',
                    'basicIndexReport', 'basicIndexReportSha256'):
            if not isinstance(entry.get(key), str) or not entry[key]:
                raise RuntimeError('Missing frozen case field: ' + key)
        reader = pathlib.Path(entry['readerInput']).resolve()
        config = pathlib.Path(entry['basicConfig']).resolve()
        index_report = pathlib.Path(entry['basicIndexReport']).resolve()
        for file, expected in ((reader, entry['readerSha256']), (config, entry['basicConfigSha256']),
                               (index_report, entry['basicIndexReportSha256'])):
            if digest(file) != expected:
                raise RuntimeError('Frozen input or Basic index drift')
        case_list = json.loads(reader.read_text())
        if (not isinstance(case_list, list) or len(case_list) != 1
            or set(case_list[0]) != {'id', 'question', 'vault', 'sources'}
            or case_list[0]['id'] != entry['id']):
            raise RuntimeError('Unexpected reader input or exposed labels')
        source = case_list[0]
        vault = pathlib.Path(source['vault']).resolve()
        if not isinstance(source['sources'], dict) or not source['sources']:
            raise RuntimeError('Empty original source scope')
        native = json.loads(index_report.read_text())
        native_config = json.loads(config.read_text())
        if (native.get('id') != entry['id'] or native.get('embeddingErrors') != 0
            or native.get('indexed') != len(source['sources'])
            or native.get('embedded') != len(source['sources'])
            or native.get('originalSourceHashes') != source['sources']):
            raise RuntimeError('Incomplete or unmatched native Basic index')
        notes = pathlib.Path(native_config['notes']).resolve()
        for name, expected in source['sources'].items():
            original = vault / name
            indexed = notes / name
            if (original.is_symlink() or indexed.is_symlink()
                or not original.resolve().is_relative_to(vault)
                or not indexed.resolve().is_relative_to(notes)
                or digest(original) != expected
                or digest(indexed) != native['indexedSourceHashes'][name]):
                raise RuntimeError('Original or indexed source drift')
    return {item['id']: item for item in cases}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    manifest_path = pathlib.Path(args.manifest).resolve()
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    cases = verify(manifest)
    out = pathlib.Path(args.out).resolve()
    if out.exists():
        raise RuntimeError('Preserve prior trial output; choose a new directory')
    out.mkdir(parents=True, mode=0o700)
    ledger = {
        'protocol': PROTOCOL, 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
        'attempts': [dict(item, status='planned') for item in manifest['order']],
        'stopped': None,
    }

    def save():
        (out / 'ledger.json').write_text(json.dumps(ledger, indent=2) + '\n')

    save()
    settings = manifest['configuration']
    failed = False
    for index, (case_id, arm) in enumerate(ORDER):
        entry = cases[case_id]
        trial = out / ('trial-' + str(index))
        command = [sys.executable, str(ROOT / 'scripts/run-curator-paging-pilot.py'),
                   '--input', entry['readerInput'], '--out', str(trial),
                   '--model', settings['curator'], '--lead-model', settings['lead'],
                   '--mode', 'auto', '--max-rounds', '3', '--max-input-bytes', '300000',
                   '--structured-citations', '--source-index']
        if arm == 'ranked':
            command.append('--ranked-originals')
        elif arm == 'basic':
            command += ['--basic-config', entry['basicConfig']]
        started = time.monotonic()
        timed_out = False
        try:
            child = subprocess.run(command, capture_output=True, text=True, timeout=900)
            exit_code, stdout, stderr = child.returncode, child.stdout, child.stderr
        except subprocess.TimeoutExpired as error:
            timed_out = True
            exit_code = None
            stdout = error.stdout.decode(errors='replace') if isinstance(error.stdout, bytes) else (error.stdout or '')
            stderr = error.stderr.decode(errors='replace') if isinstance(error.stderr, bytes) else (error.stderr or '')
        (out / f'trial-{index}.stdout').write_text(stdout)
        (out / f'trial-{index}.stderr').write_text(stderr)
        report_path = trial / 'report.json'
        report = json.loads(report_path.read_text()) if report_path.exists() else None
        row = ledger['attempts'][index]
        row.update(status='complete' if exit_code == 0 and report and report.get('runComplete') else 'failed',
                   exitCode=exit_code, elapsedSeconds=round(time.monotonic() - started, 3),
                   report=str(report_path.relative_to(out)) if report else None,
                   stopReason='runner-timeout' if timed_out else report.get('stopReason') if report else 'runner-failed-before-report',
                   modelCalls=len(report['modelCalls']) if report else 0)
        save()
        print(json.dumps({'trial': index, 'id': case_id, 'arm': arm,
                          'status': row['status'], 'stopReason': row['stopReason']}), flush=True)
        if row['status'] != 'complete':
            failed = True
            ledger['stopped'] = row['stopReason']
            for remaining in ledger['attempts'][index + 1:]:
                remaining.update(status='unattempted', stopReason='prior-trial-failed')
            save()
            break
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
