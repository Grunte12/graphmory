# Basic Memory comparison pilot — 2026-09-26

## Reproduce

Use the pinned LongMemEval download in `../longmemeval/README.md`. Install only in the ignored experiment directory:

```sh
uv venv tmp/competitors/basic-memory/venv --python 3.12
uv pip install --python tmp/competitors/basic-memory/venv/bin/python --cache-dir tmp/competitors/uv-cache --prerelease=allow 'basic-memory==0.23.2'
node scripts/eval-basic-memory.mjs --out eval/competitor-pilot/native-results.json
node scripts/eval-basic-memory.mjs --question-only --out eval/competitor-pilot/question-only-results.json
node scripts/eval-longmemeval.mjs --input tmp/datasets/longmemeval_s_cleaned.json --revision 98d7416c24c778c2fee6e6f3006e7a073259d48f --arms bm25,baseline --per-category 2 --question-only --out eval/competitor-pilot/graphmory-question-only.json
```

Basic Memory commands per isolated case: `bm project add pilot <notes> --local --default`, `bm reindex --search --project pilot`, and `bm tool search-notes <query> --project pilot --local --page-size 12 --json`. Environment disables semantic search and reranker, sets default search type text, isolates BASIC_MEMORY_CONFIG_DIR and XDG_CONFIG_HOME. This tests text search, not the default hybrid system. Official references: https://docs.basicmemory.com/local/cli-basics and https://docs.basicmemory.com/reference/mcp-tools-reference . Installed package version was verified with `bm --version`.

Native ingestion changes frontmatter/formatting; original inputs are identical across systems, resulting file hashes and changed file counts are recorded. Every case confirmed indexed note count and passed a known-item search. Results map only exact file_path fields; no unmapped rows or execution failures occurred. Twelve raw rows were requested; duplicates would be deduplicated without extra pages. Three searches per case were recorded. State was removed after each case.

## Audited results

Development pilot: 14 identical IDs, 12 answerable plus 2 unanswerable. Parent verified identical dataset hash and selected IDs, and independently compared paired outcomes. Query-only diagnostic was selected after inspecting question-plus-date failures; therefore this is exploratory, not a preregistered superiority claim.

| Question-only query | Complete evidence@3 | Complete evidence@12 | Mean recall@3 |
| --- | ---: | ---: | ---: |
| Basic Memory 0.23.2 native text | 8/12 | 12/12 | 79.2% |
| Graphmory BM25 | 10/12 | 12/12 | 89.6% |
| Graphmory existing fusion | 10/12 | 12/12 | 91.7% |

For each Graphmory arm versus Basic Memory: 2 wins, 0 losses, 10 ties on complete@3. This sample is too small and too restricted to establish general product superiority. All systems returned candidates on both unanswerable cases; no answer generation or abstention judgment was measured.

Appending `As of: <date>` made Basic Memory return zero candidates on all 14 queries despite passing known-item checks. Its installed SQLite query preparation treats some punctuation/special-character combinations as phrases. This is query-format sensitivity, not a fair headline score for the product. Both raw and diagnostic results are retained. Question-only must retain the reference date separately for future reader/temporal reasoning tasks.

Basic Memory question-only observations: median ingestion 4.83 seconds, warm CLI search 2.01 seconds, stdout 53,749 bytes. CLI startup is included; these are not comparable to Graphmory in-process timing. The first run overlapped regression tests. Output bytes are not billed tokens. No memory/RAM or end-to-end cost advantage is established.

## One optimization investigated

Removing benchmark-appended dates improved development BM25 complete@3 from 8/12 to 10/12. On the frozen unseen 14-case sample, BM25 stayed 11/12 in both formats. Fusion complete@3 stayed 10/12; complete@12 improved 11/12 to 12/12. Thus no production algorithm change is justified. Production already does not append the benchmark date. Added evaluator options `--question-only` and `--ids-manifest` make the input-contract test reproducible; the latter was used with holdout-manifest.json, both with and without question-only.

Do not overwrite original reports or reuse the now-observed holdout as unseen evidence. The initial full regression check passed 238 tests; focused evaluator tests passed after the CLI additions. No personal vault contents were used. No API costs were incurred. Research/install were delegated to Luna; quota exhaustion interrupted it and the primary agent finished runs/audit. Only one competitor was installed; Mem0/Graphiti and Basic Memory hybrid remain untested.
