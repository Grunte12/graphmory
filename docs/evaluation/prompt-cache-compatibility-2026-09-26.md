# Prompt-cache compatibility audit (2026-09-26)

## Decision

Keep `recall --agent` and `recall-loop --agent` opt-in. They shorten a dynamic CLI result while leaving the host's system instructions and tool definitions alone. This protects the reusable beginning of the prompt, but smaller output **does not yet establish lower billed cost**. A shortened conversation can cross a provider's minimum cacheable length, and host-specific serialization, cache breakpoints, TTL, and routing are outside Graphmory's CLI.

## Evidence

- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) requires a matching rendered prefix; it explicitly documents a minimum-length cost trap and recommends comparing cached tokens, cache writes, latency, and total cost. Rewriting or compacting prior context can reduce reuse.
- [Claude prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) recommends static tools/instructions before changing content and reports `cache_read_input_tokens`, `cache_creation_input_tokens`, and uncached `input_tokens`. Cache writes can cost more than ordinary input before later reads repay them.
- [Gemini context caching](https://ai.google.dev/gemini-api/docs/caching) recommends a common prefix and exposes cache-hit usage; eligibility and minimum size vary by model.
- [Vercel AI Gateway caching](https://vercel.com/academy/ai-gateway/prompt-caching) distinguishes provider cache reads from Gateway configuration and recommends checking `usage.inputTokenDetails.cacheReadTokens` and actual cost on repeated requests.

## Local Codex probe

Using `codex-cli 0.146.0`, model `gpt-5.5`, a read-only session, and only the public `eval/fixtures/notes` vault, the CLI reported `cached_input_tokens` of 20,224 on the first turn, 40,064 on the next turn, and 93,056 after a 245-byte `recall --agent` result was appended as a later input. The last turn selected `Memory Patch Protocol.md`, the first returned path. This confirms cache reads were reported and continued after a compact Graphmory result in **this one Codex session**. The first requested shell command did not execute in that nested Codex run, so the compact result was generated separately and passed on stdin. The probe has no matched full-JSON arm and does not prove a net cost or quality advantage; background tool/skill context also made its input totals atypically large. No private vault notes or API keys were sent.

## Release criterion for a cost claim

Use the same frozen questions and model/provider settings in paired full-JSON and `--agent` runs. Alternate run order, keep the static prompt and tool list identical, and test both short sessions and multi-turn sessions inside cache TTL. Record cache-read tokens, cache-write tokens, uncached input, output, billed cost, retrieval/answer correctness, retries, and latency. Claim a saving only when cost per correct answer improves without a material quality regression. Byte counts from [the output-budget eval](agent-output-budget-2026-09-26.md) are transport measurements, not this criterion.
