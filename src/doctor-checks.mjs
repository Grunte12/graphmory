import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DEFAULT_MODEL } from "./semantic-recall.mjs"

export const MCP_TOOLS = ["recall", "read", "remember", "status"]

// Where graphmory-setup writes the user-scope Curator agent for each host (docs/guides/agent-hosts.md).
const HOST_AGENTS = [
  { host: "codex", file: [".codex", "agents", "graphmory_curator.toml"], skill: [".agents", "skills", "graphmory-curator"], toml: true, model: /^\s*model\s*=\s*["']([^"']+)["']/mu },
  { host: "claude", file: [".claude", "agents", "graphmory-curator.md"], skill: [".claude", "skills", "graphmory-curator"], model: /^model:\s*["']?([^\s"']+)/mu },
  { host: "cursor", file: [".cursor", "agents", "graphmory-curator.md"], skill: [".cursor", "skills", "graphmory-curator"], model: /^model:\s*["']?([^\s"']+)/mu },
]
const PACKAGE_SKILL = fileURLToPath(new URL("../skills/graphmory-curator", import.meta.url))

const isPinned = (model) => Boolean(model) && model.toLowerCase() !== "inherit"

export function curatorModelCheck({ home = os.homedir() } = {}) {
  const found = []
  for (const agent of HOST_AGENTS) {
    let source
    try { source = fs.readFileSync(path.join(home, ...agent.file), "utf8") } catch { continue }
    // Only the frontmatter counts; a later "model:" line in the prompt body must not.
    const scope = agent.toml ? source : source.split(/^---\s*$/mu).slice(0, 2).join("\n")
    found.push({ host: agent.host, model: agent.model.exec(scope)?.[1] ?? null })
  }
  if (!found.length) {
    return { id: "curator-model", status: "warn", required: false, detail: "No Curator agent installed for Codex, Claude Code or Cursor",
      fix: "Run 'graphmory-setup --host codex|claude|cursor' and pin an inexpensive model for the Curator." }
  }
  const unpinned = found.filter((entry) => !isPinned(entry.model))
  if (unpinned.length) {
    return { id: "curator-model", status: "warn", required: false,
      detail: `${unpinned.map((entry) => entry.host).join(", ")} Curator agent does not pin a model and may inherit the main agent's model`,
      fix: "Run 'graphmory-setup --host <host> --model <inexpensive-model-id>' so the Curator never uses the main agent's model." }
  }
  return { id: "curator-model", status: "pass", required: false, detail: found.map((entry) => `${entry.host}: ${entry.model}`).join("; "), model: found[0].model, fix: null }
}

// graphmory-setup copies the skill and prompt; a later package update does not change those copies.
export function curatorFreshnessCheck({ home = os.homedir(), packageSkill = PACKAGE_SKILL } = {}) {
  const prompt = fs.readFileSync(path.join(packageSkill, "references", "curator-agent.md"), "utf8").trim()
  const files = (directory) => fs.readdirSync(directory, { recursive: true }).filter((file) => fs.statSync(path.join(directory, file)).isFile()).sort()
  const expected = files(packageSkill)
  const outdated = []
  for (const agent of HOST_AGENTS) {
    let source
    try { source = fs.readFileSync(path.join(home, ...agent.file), "utf8") } catch { continue }
    const skillDir = path.join(home, ...agent.skill)
    const skillCurrent = fs.existsSync(skillDir) && JSON.stringify(files(skillDir)) === JSON.stringify(expected)
      && expected.every((file) => fs.readFileSync(path.join(skillDir, file)).equals(fs.readFileSync(path.join(packageSkill, file))))
    const promptCurrent = source.includes(agent.toml ? JSON.stringify(prompt).slice(1, -1) : prompt)
    const legacySkill = fs.existsSync(path.join(path.dirname(skillDir), "memory-curator"))
    if (!skillCurrent || !promptCurrent || legacySkill) outdated.push(agent.host)
  }
  if (outdated.length) {
    return { id: "curator-current", status: "warn", required: false,
      detail: `${outdated.join(", ")} Curator agent or skill is older than this Graphmory version`,
      fix: outdated.map((host) => `graphmory-setup --host ${host} --apply --update`).join("; ") + " (keeps your model and a backup)" }
  }
  return { id: "curator-current", status: "pass", required: false, detail: "Curator agent and skill match this Graphmory version", fix: null }
}

export async function mcpToolsCheck() {
  let client
  let modules
  try {
    // Loaded lazily: the CLI also runs from an installer copy that has no node_modules yet.
    modules = await Promise.all([
      import("@modelcontextprotocol/sdk/inMemory.js"), import("@modelcontextprotocol/sdk/client/index.js"), import("./mcp-server.mjs"),
    ])
  } catch (error) {
    return { id: "mcp-tools", status: "warn", required: false, detail: `MCP server cannot load: ${error.code ?? error.message}`,
      fix: "Run 'npm install' in the Graphmory clone to add the MCP dependencies, then run doctor again." }
  }
  const [{ InMemoryTransport }, { Client }, { createMcpServer }] = modules
  try {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    // Listing tools never calls the engine, so no vault is opened.
    const server = createMcpServer({})
    client = new Client({ name: "graphmory-doctor", version: "1" })
    await server.connect(serverSide)
    await client.connect(clientSide)
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort()
    const exact = names.length === MCP_TOOLS.length && MCP_TOOLS.every((name) => names.includes(name))
    return { id: "mcp-tools", status: exact ? "pass" : "fail", required: true, detail: `mcp tools: ${MCP_TOOLS.filter((name) => names.includes(name)).join(" · ")}`,
      fix: exact ? null : `Expected exactly ${MCP_TOOLS.join(", ")}. Reinstall Graphmory from a clean clone.` }
  } catch (error) {
    return { id: "mcp-tools", status: "fail", required: true, detail: `MCP server did not start: ${error.message}`,
      fix: "Run 'npm install' in the Graphmory clone, then run doctor again." }
  } finally {
    await client?.close().catch(() => {})
  }
}

const transformersResolves = () => { try { import.meta.resolve("@huggingface/transformers"); return true } catch { return false } }

export function semanticBackendCheck({ env = process.env, modelCache = path.join(os.homedir(), ".cache", "graphmory", "semantic"), dependencyResolves = transformersResolves } = {}) {
  const installed = env.MPH_TEST_SEMANTIC_MOCK_MISSING !== "1" && dependencyResolves()
  if (!installed) {
    return { id: "semantic-backend", status: "warn", required: false, detail: "Meaning search is unavailable: @huggingface/transformers is not installed",
      fix: "Run 'npm install' in the Graphmory clone (optional dependency), then run doctor again." }
  }
  if (!fs.existsSync(path.join(modelCache, ...DEFAULT_MODEL.split("/")))) {
    return { id: "semantic-backend", status: "warn", required: false, detail: `Meaning search ready; model ${DEFAULT_MODEL} downloads on first use`,
      fix: "Run one recall while online to download the model once; it then works offline." }
  }
  return { id: "semantic-backend", status: "pass", required: false, detail: `Meaning search ready (${DEFAULT_MODEL})`, fix: null }
}

// Short lines shown above the detailed list, matching the setup screen of the launch film.
export function doctorSummaryLines(checks) {
  const by = (id) => checks.find((check) => check.id === id)
  const lines = []
  const vault = by("vault-detection")
  if (vault) lines.push(vault.status === "pass" && by("vault-permission")?.status !== "fail" ? "vault ok" : "vault: needs attention")
  const curator = by("curator-model")
  if (curator) lines.push(curator.status === "pass" ? `curator model ok (${curator.model})` : "curator model: needs attention")
  if (by("curator-current")?.status === "warn") lines.push("curator: update available")
  const tools = by("mcp-tools")
  if (tools) lines.push(tools.status === "pass" ? tools.detail : "mcp tools: needs attention")
  const semantic = by("semantic-backend")
  if (semantic) lines.push(semantic.status === "pass" ? "meaning search ok" : "meaning search: needs attention")
  return lines
}
