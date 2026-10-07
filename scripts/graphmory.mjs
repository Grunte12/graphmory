#!/usr/bin/env node
// The installed `graphmory` command: the vault owner's CLI for setup, health, review, recovery and
// Git sync. Agents use graphmory-mcp; scripts/brain-sync.mjs is the full developer CLI.
globalThis.GRAPHMORY_OWNER_CLI = true
await import("./brain-sync.mjs")
