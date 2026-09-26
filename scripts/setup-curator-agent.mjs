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
    "For recall, use graphmory recall-managed --agent with --vault, --query, and --k 3. Read only relevant returned notes; return a compact Brain Brief with exact paths and uncertainty. Do not edit during recall.",
    "For consolidation, require a complete lead-authored Memory Patch, verify provenance and current target notes, then deduplicate, link, and validate. Never store secrets or raw transcripts. Do not move or rewrite unrelated notes.",
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
  console.log(JSON.stringify({ host, scope, model, agentPath, action, skillDir, skillAction, mode: apply ? "apply" : "preview" }, null, 2))
  if (action === "conflict") throw new Error("Existing agent differs. Review it manually; installer will not overwrite it")
  if (apply && skillAction === "unchanged" && action === "unchanged") {
    console.log("Agent and skill already installed.")
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
  console.log("Installed. Restart the host if it does not discover a newly created agents directory.")
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
