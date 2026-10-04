#!/usr/bin/env node
import fs from "node:fs"
import { startStdioServer, startHttpServer } from "../src/mcp-server.mjs"
import { publicError } from "../src/mcp-engine.mjs"

const args = process.argv.slice(2)
const values = new Map()
const flags = new Set()
try {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (["--http", "--allow-remote", "--help"].includes(arg)) flags.add(arg)
    else if (["--vault", "--port", "--bind", "--token-env", "--token-file"].includes(arg) && args[i + 1] && !args[i + 1].startsWith("--")) {
      if (values.has(arg)) throw Error("INVALID_ARGUMENT: duplicate startup option")
      values.set(arg, args[++i])
    } else throw Error("INVALID_ARGUMENT: unknown or incomplete startup option")
  }
  if (flags.has("--help")) {
    process.stdout.write("graphmory-mcp [--vault <path>] [--http --port <n> --bind <address> --allow-remote --token-env <name> | --token-file <path>]\nVault fallback: GRAPHMORY_VAULT or OBSIDIAN_VAULT. Default transport: stdio. HTTP token fallback: GRAPHMORY_MCP_TOKEN.\n")
  } else {
    const vault = values.get("--vault") || process.env.GRAPHMORY_VAULT || process.env.OBSIDIAN_VAULT
    if (!vault) throw Error("VAULT_REQUIRED: configure the vault at startup")
    let server
    if (flags.has("--http")) {
      if (values.has("--token-env") && values.has("--token-file")) throw Error("INVALID_ARGUMENT: choose one token source")
      const token = values.has("--token-file") ? fs.readFileSync(values.get("--token-file"), "utf8").trim()
        : process.env[values.get("--token-env") || "GRAPHMORY_MCP_TOKEN"]
      server = await startHttpServer({ vault, port: Number(values.get("--port") ?? 3000), host: values.get("--bind") || "127.0.0.1", allowRemote: flags.has("--allow-remote"), token })
      process.stderr.write(JSON.stringify({ status: "listening", transport: "streamable-http", port: server.address.port }) + "\n")
    } else {
      if (values.has("--bind") || values.has("--port") || values.has("--token-file") || values.has("--token-env") || flags.has("--allow-remote")) throw Error("INVALID_ARGUMENT: HTTP options require --http")
      server = await startStdioServer({ vault })
    }
    const close = () => { void server.close().then(() => process.exit(0)).catch(() => process.exit(1)) }
    process.once("SIGINT", close)
    process.once("SIGTERM", close)
  }
} catch (error) {
  process.stderr.write(JSON.stringify(publicError(error)) + "\n")
  process.exitCode = 1
}
