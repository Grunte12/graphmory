import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { writeJsonAtomic } from "./atomic-write.mjs"

export const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  version: 1,
  workflow: "curator",
  curator: { provider: "openai", model: "gpt-6-luna" },
  decision: {
    model: "jev-latest",
    endpoint: "https://api.typesafe.ai/v1/systemone",
    apiKeyEnv: "TYPESAFE_API_KEY",
    allowRemoteVaultContent: false,
    relevanceThreshold: 0.6,
    maxCandidates: 8,
  },
})

export function runtimeConfigPath(override = process.env.GRAPHMORY_CONFIG_PATH || process.env.MPH_CONFIG_PATH) {
  if (override) return path.resolve(override)
  const current = path.join(os.homedir(), ".config", "graphmory", "runtime.json")
  const legacy = path.join(os.homedir(), ".config", "memory-patch-harness", "runtime.json")
  return fs.existsSync(current) || !fs.existsSync(legacy) ? current : legacy
}

export function validateRuntimeConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Runtime configuration must be an object")
  if (value.version !== 1) throw new Error("Unsupported runtime configuration version")
  if (!["curator", "hosted-jev", "local-decision"].includes(value.workflow)) throw new Error("Invalid workflow")
  if (value.workflow === "curator") for (const key of ["provider", "model"]) {
    if (typeof value.curator?.[key] !== "string" || !value.curator[key].trim()) throw new Error(`curator.${key} is required`)
  }
  const decision = value.decision
  if (typeof decision?.model !== "string" || !decision.model.trim()) throw new Error("decision.model is required")
  if (typeof decision?.apiKeyEnv !== "string" || !/^[A-Z_][A-Z0-9_]*$/u.test(decision.apiKeyEnv)) throw new Error("decision.apiKeyEnv must name an environment variable")
  if (typeof decision.allowRemoteVaultContent !== "boolean") throw new Error("decision.allowRemoteVaultContent must be boolean")
  if (!Number.isFinite(decision.relevanceThreshold) || decision.relevanceThreshold < 0 || decision.relevanceThreshold > 1) throw new Error("decision.relevanceThreshold must be 0–1")
  if (!Number.isInteger(decision.maxCandidates) || decision.maxCandidates < 1 || decision.maxCandidates > 10) throw new Error("decision.maxCandidates must be 1–10")
  let endpoint
  try { endpoint = new URL(decision.endpoint) } catch { throw new Error("decision.endpoint must be a valid URL") }
  if (value.workflow === "hosted-jev" && (endpoint.protocol !== "https:" || endpoint.hostname !== "api.typesafe.ai" || endpoint.pathname !== "/v1/systemone")) {
    throw new Error("Hosted Jev endpoint must be https://api.typesafe.ai/v1/systemone")
  }
  if (value.workflow === "local-decision" && (!(endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1" || endpoint.hostname === "[::1]") || !["http:", "https:"].includes(endpoint.protocol))) {
    throw new Error("Local decision endpoint must use localhost")
  }
  return value
}

export function loadRuntimeConfig(file = runtimeConfigPath()) {
  if (!fs.existsSync(file)) return structuredClone(DEFAULT_RUNTIME_CONFIG)
  const value = JSON.parse(fs.readFileSync(file, "utf8"))
  return validateRuntimeConfig(value)
}

export function saveRuntimeConfig(file, value) {
  validateRuntimeConfig(value)
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeJsonAtomic(file, value)
  fs.chmodSync(file, 0o600)
}
