#!/usr/bin/env python3
"""Build a disposable, hash-checked Basic Memory hybrid index for a reader case."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True, help='One-case reader-input.json')
parser.add_argument('--out', required=True, help='New disposable index directory')
args = parser.parse_args()
source = pathlib.Path(args.input).resolve()
case_list = json.loads(source.read_text())
if not isinstance(case_list, list) or len(case_list) != 1 or set(case_list[0]) != {'id', 'question', 'vault', 'sources'}:
    raise RuntimeError('Expected one label-free reader case')
case = case_list[0]
vault = pathlib.Path(case['vault']).resolve()
for name, expected in case['sources'].items():
    file = vault / name
    if file.is_symlink() or not file.resolve().is_relative_to(vault) or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Invalid original source boundary or hash')
out = pathlib.Path(args.out).resolve()
if out.exists():
    raise RuntimeError('Preserve prior native index; choose a new output')
out.mkdir(parents=True, mode=0o700)
repo = pathlib.Path(__file__).resolve().parents[1]
exe = repo / 'tmp/competitors/basic-memory/venv/bin/bm'
notes, state, home = out / 'notes', out / 'state', out / 'home'
cache = repo / 'tmp/competitors/basic-memory/huggingface-cache'
try:
    notes.mkdir()
    state.mkdir()
    home.mkdir()
    for name in case['sources']:
        destination = notes / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(vault / name, destination)
    env = dict(os.environ, BASIC_MEMORY_CONFIG_DIR=str(state), BASIC_MEMORY_HOME=str(notes),
               XDG_CONFIG_HOME=str(home), HF_HOME=str(cache), HF_XET_CACHE=str(cache / 'xet'),
               BASIC_MEMORY_AUTO_UPDATE='false', BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED='true',
               BASIC_MEMORY_DEFAULT_SEARCH_TYPE='hybrid', BASIC_MEMORY_RERANKER_ENABLED='false')

    def run(arguments):
        child = subprocess.run([str(exe), *arguments], env=env, cwd=repo, text=True, capture_output=True, timeout=120)
        if child.returncode:
            raise RuntimeError('Basic Memory command failed: ' + str(arguments[:2]) + '\n' + child.stderr[-500:])
        return child.stdout

    if run(['--version']).strip() != 'Basic Memory version: 0.23.2':
        raise RuntimeError('Basic Memory version mismatch')
    started = time.monotonic()
    run(['project', 'add', 'pilot', str(notes), '--local', '--default'])
    indexed = run(['reindex', '--search', '--embeddings', '--project', 'pilot'])
    elapsed = round(time.monotonic() - started, 3)
    count = re.search(r'project index: (\d+) observed, (\d+) indexed', indexed)
    vector = re.search(r'Embeddings complete \(index=([^,]+),\s*model=([^)]*)\):\s*(\d+) entities embedded,\s*(\d+)\s*skipped,\s*(\d+) errors', indexed)
    if not count or int(count[1]) != len(case['sources']) or int(count[2]) != len(case['sources']) or not vector or int(vector[3]) < 1 or int(vector[5]) != 0:
        raise RuntimeError('Incomplete native FTS or embedding index')
    config = {'exe': str(exe), 'state': str(state), 'home': str(home), 'notes': str(notes), 'project': 'pilot'}
    (out / 'basic-config.json').write_text(json.dumps(config, indent=2) + '\n')
    indexed_hashes = {name: hashlib.sha256((notes / name).read_bytes()).hexdigest() for name in case['sources']}
    result = {'protocol': 'basic-memory-live-index-v1', 'id': case['id'], 'inputSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'builderSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
              'version': '0.23.2', 'observed': int(count[1]), 'indexed': int(count[2]),
              'embedded': int(vector[3]), 'skipped': int(vector[4]), 'embeddingErrors': int(vector[5]),
              'embeddingModel': vector[2], 'indexSeconds': elapsed,
              'originalSourceHashes': case['sources'], 'indexedSourceHashes': indexed_hashes,
              'normalizedFiles': sum(indexed_hashes[name] != expected for name, expected in case['sources'].items())}
    (out / 'index-report.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'id': case['id'], 'indexed': result['indexed'], 'embedded': result['embedded'],
                      'errors': result['embeddingErrors'], 'seconds': elapsed}))
except Exception:
    # Retain any partial index for diagnosis; never silently relabel it as complete.
    raise
