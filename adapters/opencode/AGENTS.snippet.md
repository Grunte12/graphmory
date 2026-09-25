## Durable Memory

- Write new canonical vault notes in concise English. Keep exact technical identifiers and provenance intact. Do not duplicate notes by language or translate existing notes solely for consistency. Answer the user in their chosen language, including Thai. Keep routine replies short while preserving decisions, evidence, uncertainty, and next actions.

- At session start and before current shared memory is required, ask the lead agent to run `brain-sync auto-pull --json`. Memory Curator should not run Git sync itself.
- The lead agent owns the meaning of new memory.
- Before non-trivial work where prior decisions could change the plan, inspect the selected `mph config` workflow. In curator mode, ask the memory curator for a compact Brain Brief. In hosted Jev or local decision mode, run `brain-sync recall-managed --query "<specific question>" --scope "<known project/domain>" --agent` directly; the lead agent reads its selected paths and uses the EvidencePacket. Do not dispatch a curator or silently fall back to one in decision modes.
- After verified work, save only knowledge that can change future work.
- New durable knowledge must be sent as a Memory Patch containing `claim`, `why_it_matters`, `scope`, `provenance`, `confidence`, and `suggested_type`.
- In curator mode, the curator may retrieve, deduplicate, merge, link, normalize minimally, and lint. It must not invent facts, causes, rationale, policy, or confidence. In Jev/local decision modes, Jev or the local engine judges retrieved evidence; the lead owns prose and Memory Patch authorship.
- A conflict returns `TENSION`. Missing meaning or evidence returns `BLOCKED`. Otherwise return `APPLIED`.
- Raw evidence is the evidentiary source of truth and must not be rewritten. Markdown notes are canonical operational memory and must stay traceable to evidence. Search, vector, and graph indexes are rebuildable derived views.
- Do not save secrets, raw transcripts, routine summaries, or low-confidence speculation.
- If auto-pull reports dirty, offline, restructure-active, or diverged state, preserve local memory and surface the status; never auto-merge or retry-loop.
- If sync reports `diverged` or push reports `REMOTE_CHANGED`, the lead agent runs `brain-sync conflict-assist --json`, explains the local/remote memory difference, and asks the user for a lifecycle decision before resolving.
- After conflict resolution, restructure, large intake triage, and before publishing durable memory, the lead agent runs `brain-sync health --json`; critical findings block push decisions and warnings become curator cleanup work.
- Before relying on old time-sensitive memory or after vendor/API/policy changes, the lead agent or Memory Curator runs `brain-sync lifecycle-audit --json`; it is read-only and returns revalidation/replacement/tension actions.
- In curator mode, Memory Curator runs `brain-sync recall --query "<specific question>" --scope "<known project/domain>" --json` first and reads only returned canonical paths. If confidence is low, it may run `brain-sync recall-loop` once as a diagnostic sparse-fusion fallback, then returns the expansion signal to Orchestrator instead of scanning the full vault.
- If the user selected a workflow with `mph config`, call `brain-sync recall-managed --query "<specific question>" --scope "<known project/domain>" --agent` and read only the returned paths. An EvidencePacket `abstain` or empty result means no accepted evidence; report it instead of dumping the vault or repeatedly retrying. Command errors are distinct from abstention.
- For repeated eval misses, generate a curation recommendation report before broad vault search. Use recommendations to propose aliases, MOC links, scope fixes, or human-reviewed grouped-gold candidates; do not auto-edit memory from recommendations.
- Before publishing a memory batch, Orchestrator runs `brain-sync sync-plan --json`. A `push-ready` result still requires explicit user approval; it is never automatic authorization.
