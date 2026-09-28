# Native file search baseline implementation

This note documents a standalone, read-only ordinary-file comparator helper. It is an implementation contract for a later matched-host reader run, not a benchmark result. It consumes only the supplied corpus and query; it never opens answer keys, gold annotations, benchmark labels, or model services.

## Search and read contract

`scripts/native_file_baseline.py` exposes two Python functions and matching CLI operations:

```text
python3 scripts/native_file_baseline.py search --corpus CORPUS --query QUESTION --offset 0 --page-size 10
python3 scripts/native_file_baseline.py read --corpus CORPUS --path relative/note.md [--expected-sha256 HEX]
```

Search resolves the actual installed `rg` executable, calls it with an argv list and `shell=False`, and records the first line of `rg --version`. Query text is tokenized with Python Unicode `\\w+` runs after `casefold`; duplicate tokens are removed while keeping their first-seen order. There are no stopwords. Ripgrep searches for a case-insensitive fixed-string word match for each token; its multiple `-e` patterns form an OR. A file is a candidate when any token matches. This does not use BM25, semantic similarity, token frequency, phrase matching, or query-order scoring.

Search includes hidden and ignored files (`--hidden --no-ignore`) and restricts candidates to lowercase `.md` paths. Ripgrep's default symlink behavior is retained; candidate paths are checked again for corpus containment, symlink components, Markdown suffix, and regular-file status. Candidate paths are sorted by POSIX relative path in ascending Python Unicode code-point order. The policy is returned in every page so tokenization, matching, stopword, and ordering assumptions travel with the data.

Pages use absolute integer offsets. `nextOffset` is the number of candidates delivered so far, so every non-final page advances by its actual result count. A `snapshotId` binds the original query, normalized token list, sorted candidate path list, policy version, and ripgrep version. It does not hash Markdown bodies. The caller must pass that ID as `expected_snapshot` (or `--expected-snapshot`) on later pages. A changed candidate set fails with `snapshot-changed`; the caller restarts at offset zero. There is no candidate-count cutoff. An offset past the candidate count, a negative offset, a non-positive page size, or an invalid timeout is rejected. A later comparison must separately freeze and verify a path-to-SHA-256 manifest for the shared corpus; `read` hashes each delivered original but does not freeze unread files.

The default per-process timeout is 30 seconds and callers may lower it up to a hard maximum of 120 seconds. The search response records ripgrep argv, exit status, per-call duration and byte counts, plus aggregate `nativeSeconds` and `nativeOutputBytes` (ripgrep stdout plus stderr, including its version query). `--capture-native-stdout` adds base64-encoded exact stdout/stderr bytes for instrumentation; the default response stays smaller. Calls use structured argv, never shell interpolation.

`read` accepts only a relative POSIX `.md` path. It opens each directory and file with no-follow semantics, requires a regular file under the canonical corpus root, reads the complete byte stream once, and hashes those exact bytes with SHA-256. It detects metadata changes during the open-file read, preserves CRLF and other UTF-8 bytes in the returned text, and optionally checks the caller's expected hash. It is read-only. Invalid UTF-8, traversal, symlinks, non-Markdown paths, and hash mismatches fail closed.

## Proposed runner integration

When the root agent approves integration, add a comparator branch to the existing reader retrieval adapter with this mapping:

1. For the initial call, invoke `search(corpus, query, offset=0, page_size=10)` and store `snapshotId` with the run's retrieval state.
2. Map `offset`, `nextOffset`, `hasMore`, and `results` directly into the runner's current page shape; preserve each result's relative `path`. The runner should measure helper-process wall time and JSON stdout bytes using its existing `toolSeconds` and `toolOutputBytes` fields; keep `nativeSeconds`, `nativeOutputBytes`, and `nativeCalls` as separate ripgrep instrumentation.
3. For every continuation, pass the next absolute offset and the saved `snapshotId` as `expected_snapshot`. Keep every path observed on prior pages in the existing available-candidate set.
4. For requested originals, call `read_original(corpus, path)` and deliver the returned full `content`. Save the returned `sha256`; verify it against the original corpus at run completion using the existing source-integrity accounting.
5. Do not use the search snapshot as a content hash: the snapshot binds the candidate path set. Original-read SHA-256 values bind the delivered bodies.

The existing runner has native Basic Memory and Graphmory retrieval branches and expects the fields above, but it should not be edited until the comparator treatment and corpus/host matching are reviewed. Each helper search call re-runs ripgrep across the corpus, including on continuation pages; that work belongs in measured native and helper-call timing. This helper does not change any default backend.

## Fairness and limitations

This is an intentionally simple literal-token file-search/read treatment: it exposes candidate paths in deterministic path order and lets the same matched-host reader decide what to read and when to stop. It does not claim relevance ranking quality comparable to Graphmory's BM25 or Basic Memory's text/hybrid rankers. A question with common words can yield many candidates; wording absent from a source yields no candidate even when the meaning is equivalent. Ripgrep's version, corpus, exact helper revision, query, pages, and original hashes must be recorded in any eventual comparison.

The helper establishes neither answer quality nor superiority. Its future role is to supply a clearly named ordinary file-search comparator under a shared reader protocol. Results must be reported separately from ranked hybrid comparators, and this lexical lane cannot support a claim about Basic Memory hybrid capability or the complete memory product.

## Accidental implementation smoke exposure

Before the synthetic regression fixture was added, an implementation smoke command accidentally searched the repository's `eval/` tree. The exact shell command was:

```text
python3 scripts/native_file_baseline.py search --corpus eval --query 'test'; echo cli_status:$?
```

It resolved `/opt/homebrew/Cellar/ripgrep/15.2.0/bin/rg` (`ripgrep 15.2.0`) and ran this search argv, with the repository's absolute `eval` path as the last argument:

```text
rg --files-with-matches --null --fixed-strings --ignore-case --word-regexp --glob '*.md' --hidden --no-ignore -e test -- <absolute-repository-eval-path>
```

Ripgrep scanned Markdown bodies for the literal token `test`; the harness returned candidate paths only and did not display body text or snippets. The seven paths were:

```text
competitor-pilot/README.md
graph-hard/README.md
live-agent/run-template.md
longmemeval/README.md
memory-management-ab/README.md
memory-management-ab/vault/projects/meridian.md
real-vault/vault/03 Reference/Papers/hu2025memoryagentbench.md
```

This accidental broad development-tree query is excluded from all comparison evidence. It was not a source-read request or a model call; no gold or answer content was intentionally inspected.
