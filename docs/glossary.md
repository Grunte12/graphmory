# Glossary

Names that appear in the guides and in the evaluation reports.

| Term | Meaning |
|---|---|
| **Main agent** | The coding agent you chat with in your host (other docs call it the lead or parent agent). It dispatches the Curator sub-agent, decides what is worth remembering and owns the meaning of any new memory. |
| **Curator** | A small, cheap model running as a sub-agent in your host. It reads original notes, verifies evidence and returns a short cited Brain Brief. |
| **Brain Brief** | The Curator's compact answer to the main agent: relevant notes with path and hash, plus `outcome` (`answered`, `partial`, `no-evidence`), `stop_reason` and `pages_read`. See [memory contracts](guides/memory-contracts.md). |
| **Memory Patch** | A structured proposal for one memory: claim, why it matters, scope, provenance, confidence, type and lifecycle. `remember` checks it before anything is saved. |
| **Receipt** | The hash-based proof that a write happened exactly as approved. |
| **TENSION / BLOCKED / APPLIED** | The three results of `remember`: an overlap needs a decision, a check failed so nothing was written, or the note was saved. See [guarded writes](guides/mcp-remember.md). |
| **Vault** | The folder of Markdown notes, usually opened in Obsidian. |
| **Private state** | Checkpoints and the owner review queue, stored outside the vault so they are never recalled. |
| **Hosted Jev** | An optional hosted decision model from TypeSafe that judges retrieved candidates. It needs separate API access and an explicit opt-in. See [managed retrieval](guides/managed-retrieval.md). |
| **System One** | The HTTP request and response shape of that decision service. A local server that implements it is the "local decision" workflow. |
| **Luna** | `gpt-6-luna`, the default small Curator model that setup picks for Codex. Haiku is the default for Claude Code. |
| **Astra** | The name of a reviewer agent whose findings are recorded in some evaluation reports. |
| **I-MEM** | Another memory repository that one research report compares with Graphmory. |
| **Hermes** | Another agent runtime, named as an example of several agents sharing one brain repository. |
| **Basic Memory** | A third-party Markdown memory tool used as a comparison in some pilots. |
