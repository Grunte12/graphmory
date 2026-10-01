# Final cache-safety and real-embedding repeat — 2026-10-02

Before embedding/model initialization, the cache location is now checked against the vault, including resolved ancestor paths. This prevents a first model download from writing into canonical Markdown storage. The legacy vector helper has the same constraint. Focused cache tests passed, including an injected embedder that must never start when its cache is inside the vault.

Ran `node scripts/eval-hybrid-summary.mjs --out ../graphmory-hybrid-summary-20261002/real-bge-05 --model-cache ../work/transformers-cache` after this safety change, using the same six synthetic questions/19 notes, actual fp32 BGE, local existing weights and no downloads. Runtime/source hashes are recorded at start. Lexical Recall@5 0.4167, MRR@10 0.5000; hybrid Recall@5 1.0000, MRR@10 0.9167. Subsequent hybrid requests median 7.0 ms in this small same-process screen. Both methods exclude superseded notes.

This repeats a development fixture to check a concrete remaining safety regression, not independent validation or a competitor comparison. Broad candidates and tokenizer/window limitations remain. Raw report and fixture: `outputs/graphmory-hybrid-summary-20261002/real-bge-05/`. Earlier reports are preserved.
