# Privacy

Graphmory is local-first. The core repository does not run a hosted service, telemetry, analytics, or background network calls.

## What Stays Local

- Memory Patches, Brain Briefs, examples, schemas, and eval fixtures are plain files.
- Validation, tests, and deterministic eval scripts run on your machine.
- The default install script copies local skill files into a local agent config directory.
- The harness does not require API keys or a hosted database.

## Optional Egress

The core harness does not send data to external services. Optional integrations may use external tools, model APIs, web research, graph services or vector databases.

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

## MCP transports

MCP stdio runs locally and uses the configured vault through the same in-process engine as the CLI. It does not send vault content to a hosted Graphmory service. Host agents may transmit returned evidence to their own model providers; review the host's privacy settings.

Streamable HTTP exposes the configured vault to whoever holds its bearer token, including original Markdown and guarded write requests. It binds loopback by default, requires a token even locally, and refuses a non-loopback bind without the explicit remote flag. Use HTTPS (for example behind Tailscale), restrict network access, and share tokens only with trusted agents. A token is broad vault access, not per-note or read-only authorization. Review assertions in remember are host responsibility, not independent semantic authorization.

Tokens come from an environment variable or a private file; they are not command-line values and are never logged. Tool errors omit local absolute paths and stack traces. The vault path is startup configuration, never a tool argument. Model and vector caches and checkpoint preimages remain outside the vault and can still contain sensitive derived content. Local BGE may download model weights on first use when not already cached; it embeds notes locally. MCP does not invoke hosted Jev or another decision API. Resources provide static protocol guidance without exposing vault bodies.
