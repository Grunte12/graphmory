#!/usr/bin/env python3
"""Render a pinned BEIR zip as a private Markdown vault and query set."""

import argparse
import csv
import hashlib
import io
import json
import pathlib
import re
import zipfile


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def jsonl(archive, name):
    return [json.loads(line) for line in archive.read(name).splitlines() if line]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--zip', required=True)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--dataset', required=True)
    parser.add_argument('--split', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    source = pathlib.Path(args.zip).resolve()
    output = pathlib.Path(args.out).resolve()
    data = source.read_bytes()
    if sha256(data) != args.expected_sha256:
        raise RuntimeError('BEIR archive digest mismatch')
    if output.exists():
        raise RuntimeError('Preserve prior rendering; choose a new output directory')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members = archive.namelist()
        if any(name.startswith('/') or '..' in pathlib.PurePosixPath(name).parts for name in members):
            raise RuntimeError('Unsafe archive path')
        prefix = args.dataset + '/'
        corpus = jsonl(archive, prefix + 'corpus.jsonl')
        queries = jsonl(archive, prefix + 'queries.jsonl')
        qrels_file = io.TextIOWrapper(archive.open(prefix + 'qrels/' + args.split + '.tsv'), encoding='utf-8')
        qrels = {}
        rows = csv.reader(qrels_file, delimiter='\t')
        if next(rows) != ['query-id', 'corpus-id', 'score']:
            raise RuntimeError('Unexpected BEIR qrels header')
        for query_id, document_id, score in rows:
            if int(score) > 0:
                qrels.setdefault(query_id, {})[document_id] = int(score)
    if len({row['_id'] for row in corpus}) != len(corpus) or len({row['_id'] for row in queries}) != len(queries):
        raise RuntimeError('Duplicate BEIR IDs')
    documents = {row['_id']: row for row in corpus}
    questions = {row['_id']: row for row in queries}
    if any(query_id not in questions or any(doc_id not in documents for doc_id in scores)
           for query_id, scores in qrels.items()):
        raise RuntimeError('Qrels reference unknown query or document')
    output.mkdir(parents=True, mode=0o700)
    vault = output / 'vault'
    vault.mkdir()
    source_hashes = {}
    mapping = {}
    for doc_id, row in sorted(documents.items()):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', doc_id):
            raise RuntimeError('Unsafe BEIR document ID')
        relative = 'docs/' + doc_id + '.md'
        title = str(row.get('title') or '').replace('\r', ' ').replace('\n', ' ').strip()
        body = str(row.get('text') or '')
        markdown = ('# ' + title + '\n\n' if title else '') + body + '\n'
        target = vault / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(markdown, encoding='utf-8')
        source_hashes[relative] = sha256(markdown.encode())
        mapping[doc_id] = relative
    cases = [dict(id=query_id, category=args.dataset + '-' + args.split,
                  query=questions[query_id]['text'],
                  relevant=[mapping[doc_id] for doc_id in sorted(scores)])
             for query_id, scores in sorted(qrels.items())]
    (output / 'queries.json').write_text(json.dumps(cases, ensure_ascii=False, indent=2) + '\n')
    (output / 'mapping.json').write_text(json.dumps(mapping, sort_keys=True) + '\n')
    manifest = dict(dataset=args.dataset, split=args.split, archiveSha256=args.expected_sha256,
                    corpusCount=len(corpus), evaluatedQueries=len(cases),
                    vaultSourceHashes=source_hashes, querySetSha256=sha256((output / 'queries.json').read_bytes()))
    (output / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    print(json.dumps({key: manifest[key] for key in ('dataset', 'split', 'archiveSha256',
                                                      'corpusCount', 'evaluatedQueries', 'querySetSha256')}))


if __name__ == '__main__':
    main()
