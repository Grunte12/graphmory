# Streamable HTTP and remote access

The default MCP transport is stdio. Use HTTP only when the client cannot start a local process.

For Streamable HTTP, set the token in `GRAPHMORY_MCP_TOKEN` (or use `--token-env <name>` or `--token-file <private-file>`), then run:

```sh
graphmory-mcp --vault "/path/to/vault" --http --port 3000
```

HTTP always requires a bearer token of at least 16 non-whitespace characters; use a randomly generated token. Connect to `http://127.0.0.1:3000/mcp` with `Authorization: Bearer <token>`. Tokens are never accepted as command-line values or logged. By default the server binds `127.0.0.1`; any other address (except `::1`) requires `--bind <address> --allow-remote` and the token. Every request is authenticated; there is no anonymous remote access. HTTP uses stateless POST with JSON responses. Browser origins and cross-origin discovery are disabled.

For another machine, run behind Tailscale with an HTTPS reverse proxy to the loopback listener (for example, Tailscale Serve), preserve the Authorization header, restrict tailnet access, and provision the token separately to each trusted client. Tailscale does not replace bearer authentication. A token holder can read and request guarded writes to the configured vault. Never put a token in a URL, vault note, committed host config or shared log. Keep the same checkpoint state root across CLI and MCP processes; do not switch roots to bypass a pending write. See [privacy](../../PRIVACY.md).
