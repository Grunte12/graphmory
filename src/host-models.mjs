import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

// Which models a coding host can give the Curator sub-agent.
// Graphmory lists what the host reports; it never picks a model for the user.

// Codex caches the models this account can use, with the reasoning efforts each supports.
function codexModels(home) {
  let cache
  try { cache = JSON.parse(fs.readFileSync(path.join(home, ".codex", "models_cache.json"), "utf8")) } catch { return null }
  return (cache.models ?? []).filter((model) => model.visibility === "list" && model.slug).map((model) => ({
    model: model.slug,
    label: model.display_name || model.slug,
    description: model.description || "",
    efforts: (model.supported_reasoning_levels ?? []).map((level) => level.effort).filter(Boolean),
    ...(model.default_reasoning_level ? { defaultEffort: model.default_reasoning_level } : {}),
  }))
}

// `cursor-agent models` prints "<id> - <name>" lines for the signed-in account.
export function parseCursorModels(output) {
  return output.split(/\r?\n/u).map((line) => /^([A-Za-z0-9._:/-]+) - (.+)$/u.exec(line.trim()))
    .filter((match) => match && match[1] !== "auto")
    .map(([, model, label]) => ({ model, label: label.replace(/[\u200b\s]+$/u, "").trim(), description: "" }))
}

function cursorModels(runCursor) {
  const result = runCursor()
  if (result.status !== 0 || !result.stdout) return null
  const models = parseCursorModels(result.stdout)
  return models.length ? models : null
}

const runCursorAgent = () => spawnSync("cursor-agent", ["models"], { encoding: "utf8", shell: false, timeout: 30000 })

// Claude Code has no model listing command. Its sub-agent `model` field takes these documented
// aliases or a full model ID; whether the account can use one is checked by Claude Code itself.
const CLAUDE_ALIASES = [
  { model: "haiku", label: "Haiku", description: "Claude Code alias for the current Haiku model." },
  { model: "sonnet", label: "Sonnet", description: "Claude Code alias for the current Sonnet model." },
  { model: "opus", label: "Opus", description: "Claude Code alias for the current Opus model." },
]

export function hostModels(host, { home = os.homedir(), runCursor = runCursorAgent } = {}) {
  if (host === "codex") {
    const models = codexModels(home)
    return models?.length ? { source: "~/.codex/models_cache.json", models } : { source: null, models: [] }
  }
  if (host === "cursor") {
    const models = cursorModels(runCursor)
    return models ? { source: "cursor-agent models", models } : { source: null, models: [] }
  }
  if (host === "claude") return { source: "Claude Code model aliases", models: CLAUDE_ALIASES }
  throw new Error(`Unknown host: ${host}`)
}

// Short family names let an agent ask in two steps when its question UI shows only a few options.
export function modelFamily(model) {
  const id = model.toLowerCase()
  for (const family of ["luna", "sol", "terra", "astra", "codex", "haiku", "sonnet", "opus", "fable", "grok", "gemini", "composer"]) {
    if (id.includes(family)) return family
  }
  return id.split(/[-.]/u)[0]
}
