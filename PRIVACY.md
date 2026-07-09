# Privacy

Memory Patch Harness is local-first. The core repository does not run a hosted service, telemetry, analytics, or background network calls.

## What Stays Local

- Memory Patches, Brain Briefs, examples, schemas, and eval fixtures are plain files.
- Validation, tests, and deterministic eval scripts run on your machine.
- The default install script copies local skill files into a local agent config directory.
- The harness does not require API keys or a hosted database.

## Optional Egress

The core harness does not send data to external services. Future optional integrations may use external tools, model APIs, web research, graph services, vector databases, or MCP servers.

Any optional integration should document:

- what data is sent,
- which service receives it,
- whether it is enabled by default,
- how to disable it,
- and what local fallback exists.

## Private Notes And Agent Transcripts

Do not publish:

- private Obsidian vaults,
- raw agent transcripts,
- customer data,
- workplace data,
- secrets,
- API keys,
- credentials,
- private model outputs that you do not have permission to share.

Use anonymized fixtures when reporting bugs or publishing evals.

## Derived Data

Generated indexes, hot-context packs, reports, and eval outputs can still contain sensitive information if they were derived from private notes. Review derived artifacts before committing them.

Canonical memory remains Markdown plus provenance; derived views are rebuildable and should not be treated as privacy-safe automatically.
