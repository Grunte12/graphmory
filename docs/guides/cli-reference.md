# CLI reference and manual setup

The MCP tools cover day-to-day use. This guide keeps the command-line path: manual install for Codex, project setup, evaluation, Portable Brain Sync and recall diagnostics. For the shortest path, start from the [README](../../README.md#quick-start).

For the guarded local Curator release candidate, follow [the trial workflow](trial-mvp.md). It adds full saved-field verification and discoverable write recovery; readiness depends on actual installed/native acceptance.

## Install and verify

Requirements: Node.js 20 or newer and Git. The npm package is not published yet, so install from this GitHub checkout. You do not need to fork it to use it.

For the easiest setup, ask your coding agent: **“Install Graphmory from this repository. Follow `adapters/generic-agent/INSTALL.md`. Ask me for missing choices using your question UI, including where and how to organize my Obsidian vault. Then verify CLI, vault, skill discovery, and curator dispatch.”** The agent can adapt the files to its own host and machine. See the [minimal vault architecture](vault-setup.md); GitHub sync is optional.

The commands below are a manual path for Codex. `graphmory-setup` is a helper for known hosts, not a requirement for agent-guided setup. Coding agents should read [AGENTS.md](../../AGENTS.md) and the install guide first.

```sh
git clone https://github.com/Grunte12/graphmory.git
cd graphmory
npm install -g .
graphmory doctor --json
graphmory-setup --host codex
graphmory-setup --host codex --apply
```

Keep the checkout after `npm install -g .`: npm may link a local folder rather than copy it. The first `graphmory-setup` call previews the agent path, skill path, and model; `--apply` installs them. Use `--host claude` for Claude Code. For Cursor, use `--host cursor --model <supported-small-model-id>`. The recommended curator workflow uses the CLI, skill, and named agent together; copying `SKILL.md` alone does not install the CLI. Follow the [host setup guide](agent-hosts.md) to select a vault and add the short lead-agent instruction. The installer will not overwrite existing agent or skill files.

OpenCode uses its [separate adapter](install.md#opencode-adapter). Contributors who edit or evaluate Graphmory should keep a checkout; ordinary users do not need a fork. When an npm release is published, `npm install -g graphmory` can replace the clone and local install steps. Do not use that registry command before a release exists.

The package name, GitHub repository, and primary CLI command are `graphmory`. The older `memory-patch-harness` and `mph` commands were removed. Existing vault metadata under `.memory-patch-harness/` remains readable without migration.

Initialize a project memory area:

```powershell
node scripts/init-project.mjs `
  --vault "C:\path\to\your\ObsidianVault" `
  --project "my-project"
```

Validate a patch:

```powershell
node scripts/validate.mjs examples/memory-patch.json
node scripts/validate.mjs examples/derived-index.json
node scripts/validate.mjs examples/hot-context-pack.json
node scripts/validate.mjs examples/learning-packet.json
node scripts/render-hot-context.mjs --pack examples/hot-context-pack.json --out tmp/hot-context.md
```

Run the retrieval and memory benchmarks:

```powershell
npm run eval
npm run release:gate
node scripts/eval-retrieval.mjs --dataset eval/fixtures --k 3 --json tmp/report.json
node scripts/eval-curator.mjs --candidate eval/curator/candidate.memory-patch.json
npm run eval:curator:compare
npm run eval:lifecycle
npm run eval:conflict
npm run eval:learning-loop
npm run eval:future-task
npm run eval:report
node scripts/eval-agent-run.mjs --curator-output eval/curator/candidates/C-memory-patch.json --patches eval/patch-quality/candidates
```

The retrieval benchmark compares dependency-free lexical and BM25 baselines using Hit@k, Recall@k, MRR, nDCG, and retrieved context size. The curator benchmark checks Brain Brief and Memory Patch behavior: bounded recall, provenance retention, conflict surfacing, noise rejection, and derived-artifact boundaries. The lifecycle and conflict evals test stale-memory detection and shared-brain sync decisions separately from retrieval. The comparison script scores proxy baselines for direct writing, curator inference, and Memory Patch handoff. The learning-loop eval adds token/cost proxies and a future-task utility check. `npm run eval:report` writes a generated summary to `tmp/eval-report.md`; `npm run release:gate` runs the full local release gate plus npm pack dry-run. These are evaluation surfaces, not production retrievers.

Optional portable memory sync:

```powershell
node scripts/brain-sync.mjs bootstrap `
  --vault "C:\path\to\your\BrainVault" `
  --repo "your-github-user/your-brain" `
  --create-remote

node scripts/brain-sync.mjs pull --vault "C:\path\to\your\BrainVault"
node scripts/brain-sync.mjs status --vault "C:\path\to\your\BrainVault"
node scripts/brain-sync.mjs health --vault "C:\path\to\your\BrainVault" --json
node scripts/brain-sync.mjs lifecycle-audit --vault "C:\path\to\your\BrainVault" --json
node scripts/brain-sync.mjs recall --vault "C:\path\to\your\BrainVault" --query "what did we decide about sync?" --scope "02 Projects/example" --json
node scripts/brain-sync.mjs recall-loop --vault "C:\path\to\your\BrainVault" --query "what did we decide about sync?" --scope "02 Projects/example" --json
node scripts/brain-sync.mjs curation-recommend --report tmp/private-vault-report.json --queries tmp/private-vault-gold.json --method governed-bm25f-sections --json
node scripts/brain-sync.mjs sync-plan --vault "C:\path\to\your\BrainVault" --patches 3 --json
node scripts/brain-sync.mjs push --vault "C:\path\to\your\BrainVault" --message "memory: update lessons"
```

Portable Brain Sync stores curated memory in a separate private GitHub repo so agents can continue across accounts and machines. The brain repo contains memory only; Graphmory repo remains the tool. Sync is autonomy-first but gate-governed: agents should keep running through reversible detect-act-verify-repair loops, while setup, adoption, restructure, conflict resolution, visibility, and meaning-changing lifecycle choices require user approval.

`recall` performs bounded lifecycle-aware retrieval with dependency-free, field-weighted BM25 section ranking by default: path, title, frontmatter, headings, and body remain separate signals, while raw inbox paths and stale/superseded notes stay out. Optional `--scope` keeps search inside a known project/domain, and low-confidence results tell the lead agent to reformulate or follow MOC/backlink context. `recall-loop` is a diagnostic fallback that fuses field-weighted and ordinary section BM25; keep `recall` as the normal low-token path unless measured misses require comparison. `sync-plan` turns batching policy into a read-only decision report; it never pushes automatically.

If a frozen eval shows repeated paraphrase misses after curation, enable the optional semantic lane:

```powershell
npm install @huggingface/transformers
node scripts/brain-sync.mjs recall-semantic --vault "C:\path\to\your\BrainVault" --query "what did we decide about sync?" --scope "02 Projects/example" --json
```

`recall-managed` in new Curator setups combines keyword, local BGE embeddings and authored graph paths. Model download/indexing happens on first use; reusable vectors stay outside the Markdown vault. `recall-semantic` remains a diagnostic command. Missing embedding support produces an explicit BLOCKED result. Legacy configs retain lexical behavior until migrated. See [hybrid retrieval and reusable summaries](hybrid-summary.md).

When a frozen retrieval eval misses, generate a bounded curation plan instead of manually rereading the vault:

```powershell
node scripts/brain-sync.mjs curation-recommend --report tmp/private-vault-report.json --queries tmp/private-vault-gold.json --method governed-bm25f-sections --json > tmp/curation-recommendations.json
```

The recommender classifies misses such as buried gold, missing scope, no candidates, and vocabulary/gold ambiguity, then suggests aliases/frontmatter, scope fixes, MOC links, and human-reviewed grouped-gold candidates. Agents may apply small reversible metadata/link fixes when the evidence is explicit. They should ask before grouped-gold changes, note moves, deletion, conflict resolution, or any rewrite that changes meaning.

For Hermes, OpenCode, or other agents sharing one brain, use separate local clones and run event-driven `auto-pull` at session start/before shared recall. Sync is fast-forward-only; push never auto-rebases competing memory.

Do not push every remembered item. Push at healthy thresholds: session end, account/machine handoff, 3-7 small verified patches, one high-value/risky patch, or before restructure/conflict work. Keep raw inbox noise and unresolved facts local until curated.

Run `health` after conflict resolution, restructure, large intake triage, and before publishing durable memory. It gives agents a deterministic health report instead of making them manually rediscover unresolved links, duplicate titles, missing provenance, stale notes, inbox backlog, and secret-like values.

Run `lifecycle-audit` when memory may have changed over time: after a vendor/API/policy change, before relying on old operational notes, before conflict resolution, or during periodic brain hygiene. It flags expired `valid_until`, due `revalidate_when`, active notes that contain stale language, superseded notes without replacement markers, and tension notes without decision paths. It is read-only: it creates a review/action plan, not automatic rewrites.

If sync reports `diverged` or `REMOTE_CHANGED`, run read-only conflict assistance instead of merging blindly:

```bash
node scripts/brain-sync.mjs conflict-assist --vault "C:\path\to\your\BrainVault" --json
```

The command explains local-vs-remote memory changes, highlights same-note semantic conflicts, and returns structured `decisionOptions` such as `merge-compatible`, `prefer-local`, `prefer-remote`, `supersede-local`, `supersede-remote`, `create-tension`, and `blocked-needs-evidence`. Resolution still needs a human-approved lifecycle decision before any merge or rewrite.

Existing Obsidian/custom memory is never restructured silently. The reviewed flow is `detect -> adoption-plan -> restructure-plan -> user approval -> dry-run -> apply -> verify`, with a clean-Git gate, local backup branch, exact migration record, and rollback support.

## Retrieval notes

New Curator configs use local BGE hybrid retrieval; an unavailable backend returns `SEMANTIC_UNAVAILABLE`. Models load lazily and remain resident; vectors and model files stay outside the vault. Legacy lexical configs retain their behavior. Candidate PPR, MMR, margin rerank, context ordering and abstention are opt-in experiments, with no new defaults promoted in this synthetic-only run. [Implementation and evaluation status](../evaluation/mcp-implementation-2026-10-04.md).
