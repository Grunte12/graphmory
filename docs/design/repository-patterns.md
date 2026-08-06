# Repository Patterns

This project should be easy to understand, install, evaluate, and fork. The shape below is based on patterns from successful agent-tool and agent-skill repositories, but the core harness stays dependency-light.

## Repositories Studied

| Project | Pattern worth copying | Pattern to avoid or keep optional |
|---|---|---|
| claude-obsidian | Strong open-source presentation: demo-first README, privacy policy, CODEOWNERS, command map, seeded vault, skills split, audits, and methodology modes. | Do not copy its assets, prose, vault content, or full plugin scope. This repo should stay a small harness with contracts and evals. |
| Graphify | Clear one-command usage, multi-agent platform matrix, project-scoped installs, generated artifacts that are easy to inspect. | Do not make knowledge-graph generation a core dependency. Keep it as a future optional derived-index adapter. |
| Headroom | Strong value proposition, proof-oriented compression claims, multiple integration surfaces: library, proxy, wrapper, MCP. | Do not add token-compression middleware until this harness measures a repeated context-size problem. |
| Anthropic Skills | Self-contained skill folders with `SKILL.md`, metadata, examples, and progressive disclosure. | Do not put broad project knowledge inside global skills. Skills should explain workflow and load references only on demand. |
| 12-factor Agents | Own prompts, own context window, keep agents as software with explicit control flow rather than vague loops. | Do not turn the harness into a giant framework. The useful unit is a small contract plus tests. |
| Addy Osmani agent/loop writing | Plan, execute, verify, repair loops; evaluation before claims. | Do not add ceremonial process for tiny memory updates. |
| Karpathy LLM Wiki | Compiled Markdown knowledge layer that is easier for agents to read than raw source piles. | Do not copy the wiki strategy wholesale; preserve this project's Memory Patch boundary and lifecycle gates. |

## Packaging Rules For This Repo

### 0. Community health files are part of the product

GitHub's public community profile checks for files such as README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates, and support guidance. For a developer harness, these files also communicate safety boundaries: do not commit secrets, private vault dumps, or unsupported benchmark claims.

### 1. README sells the idea fast

The top-level README should answer:

- what problem this solves,
- why a Memory Patch exists,
- how it differs from RAG, CAG, and normal note-taking,
- how to install,
- how to run checks and evals,
- what is original and what is borrowed.

### 2. Docs explain decisions, not runtime-critical instructions

Runtime-critical behavior belongs in:

- `skills/memory-curator/SKILL.md`,
- adapter prompts under `adapters/`,
- schemas under `schemas/`,
- scripts and tests.

Docs can explain architecture, research, evaluation, and tradeoffs. A coding agent should not need to read every doc to use the harness correctly.

### 3. Contracts are product surface

The durable public interfaces are:

- `Memory Patch`,
- `Brain Brief`,
- `Derived Index`,
- `Hot Context Pack`,
- `APPLIED/TENSION/BLOCKED`.

These contracts should stay small, schema-validated, and model/provider-neutral.

### 4. Adapters are optional

Agent platforms differ. Keep integration files under `adapters/<platform>/` and avoid hardcoding one user's global OpenCode setup.

Good adapter content:

- example prompts,
- installation snippets,
- role boundaries,
- expected input/output shapes.

Bad adapter content:

- private vault paths,
- app-specific policies,
- provider-specific secrets,
- assumptions about one user's model stack.

### 5. Tool integrations are derived lanes

Graph tools, compression tools, MCP servers, local search, embeddings, and HTML reports should be treated as optional lanes:

```text
canonical Markdown notes -> source of operational memory
Memory Patch -> only durable write path
Derived Index / graph / search -> retrieval hints
Hot Context Pack -> cacheable prompt view
HTML reports -> review surface
```

This keeps the harness useful without forcing users to install a database, vector store, graph engine, or proxy.

## Current Project Shape

| Directory | Purpose | Public expectation |
|---|---|---|
| `skills/` | Installable on-demand skill | Small `SKILL.md`, references only when needed |
| `adapters/` | Agent-platform integration examples | Copy/adapt, not magic |
| `schemas/` | Stable contracts | Validate before writing memory |
| `examples/` | Minimal valid examples | Copy, run, edit |
| `scripts/` | Local install, validation, eval | No hosted service required |
| `eval/` | Synthetic and live-model evaluation fixtures | Prove behavior before claiming superiority |
| `docs/` | Architecture, research, tradeoffs | Human/audit layer |
| `.github/` | CI, issue templates, PR template | Community workflow |

## Open Source Readiness Files

| File | Why it exists |
|---|---|
| `LICENSE` | GitHub license detection and legal reuse terms |
| `CONTRIBUTING.md` | Contribution and architecture-change rules |
| `CODE_OF_CONDUCT.md` | Community behavior expectations |
| `SECURITY.md` | Private vulnerability reporting and memory-safety boundaries |
| `SUPPORT.md` | Where to ask for help and what data not to share |
| `CHANGELOG.md` | User-visible release history |
| `CITATION.cff` | Citation metadata for research/writeups |
| `.github/ISSUE_TEMPLATE/*` | Structured reports for bugs, features, and eval results |
| `.github/PULL_REQUEST_TEMPLATE.md` | Evidence and memory-safety checklist |

## Release Checklist

Before presenting this as a public harness:

- `npm run check` passes.
- README quick start works on a clean checkout.
- Every public contract has an example and schema.
- At least one live-model run is documented separately from synthetic proxy results.
- Known limitations are visible before any superiority claim.
- Optional tools are described as optional, not bundled into the core.
- No private project names, secrets, or local-only paths appear in public examples.

## Source Links

- Graphify: https://github.com/safishamsi/graphify
- Headroom: https://github.com/chopratejas/headroom
- claude-obsidian: https://github.com/AgriciDaniel/claude-obsidian
- Anthropic Skills: https://github.com/anthropics/skills
- 12-factor Agents: https://github.com/humanlayer/12-factor-agents
- Addy Osmani Loop Engineering: https://addyosmani.com/blog/loop-engineering/
- Karpathy LLM Wiki: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- GitHub community profile docs: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories
- GitHub community health files docs: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
