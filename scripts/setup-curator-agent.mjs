#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: graphmory-setup --host codex|claude|cursor [--scope user|project] [--project <path>] [--model <host-model-id>] [--apply]")
  console.log("Preview is the default. --apply installs the named curator agent and skill without overwriting existing files.")
  process.exit(0)
}

function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} needs a value`)
  return args[index + 1]
}

try {
  const host = option("--host")
  const scope = option("--scope") || "user"
  const apply = args.includes("--apply")
  if (!["codex", "claude", "cursor"].includes(host)) throw new Error("Choose --host codex|claude|cursor")
  if (!["user", "project"].includes(scope)) throw new Error("Choose --scope user|project")
  const project = option("--project")
  if (scope === "project" && !project) throw new Error("Project scope needs --project <path>")
  const model = option("--model") || ({ codex: "gpt-6-luna", claude: "haiku" })[host]
  if (!model) throw new Error("Cursor needs --model <supported-cheap-model-id>; 'inherit' would use the lead model")
  if (!/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new Error("Invalid model identifier")
  const base = scope === "user" ? os.homedir() : path.resolve(project)
  const hostDir = path.join(base, `.${host}`)
  const skillDir = host === "codex" ? path.join(base, ".agents", "skills", "memory-curator") : path.join(hostDir, "skills", "memory-curator")
  const agentPath = path.join(hostDir, "agents", host === "codex" ? "graphmory_curator.toml" : "graphmory-curator.md")
  const skillSource = path.join(repo, "skills", "memory-curator")
  const prompt = [
    "You are Graphmory's dedicated memory curator. Read and follow the installed memory-curator skill before working.",
    "The lead agent owns new claims and sends a bounded task, vault path, and evidence IDs. Never invent meaning or expand beyond that task.",
    "For recall, use graphmory recall-managed --agent with --vault and --query. It returns pages of candidate paths. For an explicit prior-state question, add --include-superseded and compare original dates and scope; omit the flag for current-state questions. Inspect relevant Markdown sections; if evidence is incomplete and hasMore is true, request the nextOffset page. Continue until evidence is sufficient or candidates are exhausted, then return a compact Brain Brief with exact paths and uncertainty. Do not edit during recall.",
    "For consolidation, require a complete lead-authored Memory Patch as a JSON file outside the vault. Before any host edit, run graphmory validate-patch --input <patch.json> --agent and stop BLOCKED if it is invalid. This checks schema only; it does not verify factual support, authorization, or whether a lifecycle transition is allowed. Read the cited original evidence and current target notes, confirm user authorization for any policy change or supersession, then apply the supported patch with the host's normal file-editing tools without expanding its meaning. Preserve prior evidence and superseded notes; put every lifecycle.revalidate_when event in a YAML list on the canonical note, and keep optional valid_until as a separate date field.",
    "Before returning APPLIED, run graphmory verify-patch-persistence --vault <vault> --input <patch.json> --note <canonical-note.md> --agent. If it reports missing lifecycle metadata, repair only that metadata and rerun; if still invalid, return BLOCKED with the missing field names. This read-only check verifies lifecycle metadata persistence only, not source support, authorization, claim meaning, or supersession. Then run graphmory graph-audit --vault <vault> --json and graphmory lifecycle-audit --vault <vault> --json. The lifecycle audit is date-oriented and may emit informational revalidation-mentioned-without-date findings for event triggers; report those separately. Repair bounded link/lifecycle metadata issues when supported; otherwise report the exact finding. In curator mode, do not call curate-plan: it is for hosted Jev/local decision workflows and returns advice only. Never store secrets or raw transcripts, and do not move or rewrite unrelated notes.",
    "Return APPLIED with changed paths, TENSION with conflicting paths, or BLOCKED with the smallest missing decision. Keep responses short.",
    "If the vault is unavailable or Graphmory CLI is missing, report BLOCKED. Do not scan arbitrary folders or silently install software.",
  ].join("\n")
  const description = "Use for Graphmory memory recall and for placing a lead-authored Memory Patch in a Markdown/Obsidian vault. Return a bounded Brain Brief or APPLIED/TENSION/BLOCKED."
  const content = host === "codex"
    ? `name = "graphmory_curator"\ndescription = ${JSON.stringify(description)}\nmodel = ${JSON.stringify(model)}\nmodel_reasoning_effort = "low"\ndeveloper_instructions = ${JSON.stringify(`${prompt}\nSkill: ${path.join(skillDir, "SKILL.md")}`)}\n\n[[skills.config]]\npath = ${JSON.stringify(path.join(skillDir, "SKILL.md"))}\nenabled = true\n`
    : `---\nname: graphmory-curator\ndescription: ${description}\nmodel: ${model}\n${host === "claude" ? "tools: Read, Glob, Grep, Bash, Edit, Write\nskills:\n  - memory-curator\n" : "readonly: false\n"}---\n\n${prompt}\n\nInstalled skill: ${skillDir}/SKILL.md\n`

  function sameTree(source, target) {
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return false
    const sourceFiles = fs.readdirSync(source, { recursive: true }).filter((file) => fs.statSync(path.join(source, file)).isFile())
    const targetFiles = fs.readdirSync(target, { recursive: true }).filter((file) => fs.statSync(path.join(target, file)).isFile())
    return sourceFiles.length === targetFiles.length && sourceFiles.every((file) =>
      fs.existsSync(path.join(target, file)) && fs.readFileSync(path.join(source, file)).equals(fs.readFileSync(path.join(target, file))))
  }
  const action = fs.existsSync(agentPath) ? (fs.readFileSync(agentPath, "utf8") === content ? "unchanged" : "conflict") : "create"
  const skillAction = fs.existsSync(skillDir) ? (sameTree(skillSource, skillDir) ? "unchanged" : "conflict") : "create"
  const verificationReminder = host === "codex"
    ? `${scope === "project" ? "Open this project as trusted in Codex, " : ""}start a fresh session, and verify a native graphmory_curator child run. With a spawn schema exposing fork_turns, select agent_type=graphmory_curator and fork_turns=none; a full-history fork cannot select the configured role.`
    : `Start a fresh ${host} session if needed and verify the named curator runs as a child.`
  console.log(JSON.stringify({ host, scope, model, agentPath, action, skillDir, skillAction, mode: apply ? "apply" : "preview" }, null, 2))
  if (action === "conflict") throw new Error("Existing agent differs. Review it manually; installer will not overwrite it")
  if (apply && skillAction === "unchanged" && action === "unchanged") {
    console.log(`Agent and skill already installed. ${verificationReminder}`)
    process.exit(0)
  }
  if (skillAction === "conflict") throw new Error("Existing skill differs. Review it manually; installer will not overwrite it")
  if (!apply) {
    console.log("Preview only. Add --apply after reviewing paths and model.")
    process.exit(0)
  }
  if (skillAction === "create") {
    fs.mkdirSync(path.dirname(skillDir), { recursive: true })
    fs.cpSync(skillSource, skillDir, { recursive: true, errorOnExist: true, force: false })
  }
  if (action === "create") {
    fs.mkdirSync(path.dirname(agentPath), { recursive: true })
    fs.writeFileSync(agentPath, content, { flag: "wx", mode: 0o600 })
  }
  console.log(`Installed. ${verificationReminder}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
