#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import readline from "node:readline/promises"
import { fileURLToPath } from "node:url"
import { hostModels, modelFamily } from "../src/host-models.mjs"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)

// How the installing agent turns the host's list into a suggestion. The user always decides.
const CHOOSING_GUIDANCE = "Set up only the host you are running in. Suggest 2-4 models from these choices, then let the user pick or type another. Do not choose for the user. "
  + "The Curator reads notes, follows a strict protocol and returns short structured answers, so it needs reliable instruction following and tool use, not frontier reasoning. "
  + "Put first the newest generation of the host's fast, low-cost tier (for example a Luna, Haiku or Flash model); prefer it over an older generation of the same tier. "
  + "Offer one stronger mid-tier model for vaults with many conflicts. Mention that frontier models cost more for little gain here. Never suggest auto or inherit. "
  + "If there are more choices than the question UI shows, ask for the family first, then the model. For Codex, then ask for the effort; low or medium is usually enough."

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: graphmory-setup --host codex|claude|cursor [--scope user|project] [--project <path>] [--model <host-model-id>] [--effort <level>] [--apply] [--update]")
  console.log("       graphmory-setup --host codex|claude|cursor --choices")
  console.log("Preview is the default. --apply installs the Graphmory Curator sub-agent and its skill. --update replaces an older install and keeps a backup.")
  console.log("--choices prints the models the host reports as JSON so the agent running in that host can ask the user. Graphmory never picks the model:")
  console.log("pass --model, or run --apply in an interactive terminal to choose from the host's list.")
  process.exit(0)
}

function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} needs a value`)
  return args[index + 1]
}

function installedValue(file, pattern) {
  try { return pattern.exec(fs.readFileSync(file, "utf8"))?.[1] } catch { return undefined }
}

async function pick(question, options, { allowCustom = false } = {}) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stderr })
  try {
    process.stderr.write(`${question}\n`)
    options.forEach((option, index) => process.stderr.write(`  ${index + 1}. ${option.label}${option.description ? `: ${option.description}` : ""}\n`))
    if (allowCustom) process.stderr.write(`  ${options.length + 1}. Type another id\n`)
    for (;;) {
      const answer = (await prompt.question("Choice: ")).trim()
      const index = Number(answer) - 1
      if (Number.isInteger(index) && options[index]) return options[index].value
      if (allowCustom && (index === options.length || (answer && !/^\d+$/.test(answer)))) {
        return index === options.length ? (await prompt.question("Id: ")).trim() : answer
      }
    }
  } finally {
    prompt.close()
  }
}

function sameTree(source, target) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return false
  const files = (directory) => fs.readdirSync(directory, { recursive: true }).filter((file) => fs.statSync(path.join(directory, file)).isFile())
  const sourceFiles = files(source)
  return sourceFiles.length === files(target).length && sourceFiles.every((file) =>
    fs.existsSync(path.join(target, file)) && fs.readFileSync(path.join(source, file)).equals(fs.readFileSync(path.join(target, file))))
}

try {
  const host = option("--host")
  if (host && !["codex", "claude", "cursor"].includes(host)) throw new Error("Choose --host codex|claude|cursor")
  if (args.includes("--choices")) {
    if (!host) throw new Error("Pass --host for the coding agent you are running in; set up only your own host")
    const { source, models } = hostModels(host)
    console.log(JSON.stringify({
      question: "Which model should the Graphmory Curator sub-agent use?",
      header: "Curator model",
      source,
      choices: models.map((model) => ({ ...model, family: modelFamily(model.model) })),
      allowCustom: true,
      guidance: CHOOSING_GUIDANCE,
      next: `graphmory-setup --host ${host} --model <chosen model>${host === "codex" ? " --effort <chosen effort>" : ""} --apply`,
    }, null, 2))
    process.exit(0)
  }
  if (!host) throw new Error("Choose --host codex|claude|cursor: the coding agent you are running in")
  const scope = option("--scope") || "user"
  const apply = args.includes("--apply")
  const update = args.includes("--update")
  if (!["user", "project"].includes(scope)) throw new Error("Choose --scope user|project")
  const project = option("--project")
  if (scope === "project" && !project) throw new Error("Project scope needs --project <path>")
  const base = scope === "user" ? os.homedir() : path.resolve(project)
  const hostDir = path.join(base, `.${host}`)
  const skillDir = host === "codex" ? path.join(base, ".agents", "skills", "memory-curator") : path.join(hostDir, "skills", "memory-curator")
  const agentPath = path.join(hostDir, "agents", host === "codex" ? "graphmory_curator.toml" : "graphmory-curator.md")
  const skillSource = path.join(repo, "skills", "memory-curator")

  // An update keeps the owner's earlier model and effort choices unless new ones are given.
  const modelPattern = host === "codex" ? /^\s*model\s*=\s*"([^"]+)"/mu : /^model:\s*["']?([^\s"']+)/mu
  let model = option("--model") || (update ? installedValue(agentPath, modelPattern) : undefined)
  let effort = option("--effort") || (update ? installedValue(agentPath, /^\s*model_reasoning_effort\s*=\s*"([^"]+)"/mu) : undefined)
  if (!model && apply && process.stdin.isTTY) {
    const { models } = hostModels(host)
    model = await pick("Which model should the Graphmory Curator sub-agent use?", models.map((item) => ({ value: item.model, label: item.label, description: item.description })), { allowCustom: true })
    const efforts = models.find((item) => item.model === model)?.efforts ?? []
    if (host === "codex" && !effort && efforts.length) effort = await pick("Which reasoning effort?", efforts.map((value) => ({ value, label: value })))
  }
  if (!model && apply) throw new Error(`Choose the Curator model: pass --model <id>. Run 'graphmory-setup --host ${host} --choices' to list the models this host reports`)
  if (model && (!/^[a-zA-Z0-9._:/-]+$/.test(model) || model.toLowerCase() === "inherit")) throw new Error("Invalid model identifier; 'inherit' would use the main agent's model")
  if (host === "codex" && !effort) effort = hostModels(host).models.find((item) => item.model === model)?.defaultEffort ?? "low"
  if (effort && !/^[a-z]+$/.test(effort)) throw new Error("Invalid effort level")

  const prompt = fs.readFileSync(path.join(skillSource, "references", "curator-agent.md"), "utf8").trim()
  const skillFile = path.join(skillDir, "SKILL.md")
  const description = "Graphmory memory specialist. Use to recall cited memory from the Markdown vault as a Brain Brief, or to file a main-agent-authored Memory Patch (APPLIED/TENSION/BLOCKED)."
  const tools = "Read, Glob, Grep, Bash, Edit, Write, mcp__graphmory__recall, mcp__graphmory__read, mcp__graphmory__remember"
  const content = host === "codex"
    ? `name = "graphmory_curator"\ndescription = ${JSON.stringify(description)}\nmodel = ${JSON.stringify(model)}\nmodel_reasoning_effort = ${JSON.stringify(effort)}\ndeveloper_instructions = ${JSON.stringify(`${prompt}\n\nInstalled skill: ${skillFile}`)}\n\n[[skills.config]]\npath = ${JSON.stringify(skillFile)}\nenabled = true\n`
    : `---\nname: graphmory-curator\ndescription: ${description}\nmodel: ${model}\n${host === "claude" ? `tools: ${tools}\nskills:\n  - memory-curator\n` : "readonly: false\n"}---\n\n${prompt}\n\nInstalled skill: ${skillFile}\n`

  const action = fs.existsSync(agentPath) ? (fs.readFileSync(agentPath, "utf8") === content ? "unchanged" : update ? "update" : "conflict") : "create"
  const skillAction = fs.existsSync(skillDir) ? (sameTree(skillSource, skillDir) ? "unchanged" : update ? "update" : "conflict") : "create"
  const verificationReminder = host === "codex"
    ? `${scope === "project" ? "Open this project as trusted in Codex, " : ""}restart Codex once so it loads the sub-agent. The main agent then dispatches graphmory_curator as a child run; verify a native graphmory_curator child run. With a spawn schema exposing fork_turns, select agent_type=graphmory_curator and fork_turns=none; a full-history fork cannot select the configured role.`
    : `Restart ${host} once so it loads the sub-agent. The main agent then dispatches graphmory-curator as a child run; verify the named curator runs as a child.`
  console.log(JSON.stringify({ host, scope, model, ...(host === "codex" ? { effort } : {}), agentPath, action, skillDir, skillAction, mode: apply ? "apply" : "preview" }, null, 2))
  if (action === "conflict") throw new Error("Existing agent differs. Re-run with --update to replace it (a backup is kept); the installer will not overwrite it otherwise")
  if (skillAction === "conflict") throw new Error("Existing skill differs. Re-run with --update to replace it (a backup is kept); the installer will not overwrite it otherwise")
  if (apply && skillAction === "unchanged" && action === "unchanged") {
    console.log(`Agent and skill already installed. ${verificationReminder}`)
    process.exit(0)
  }
  if (!apply) {
    console.log("Preview only. Add --apply after reviewing paths and model.")
    process.exit(0)
  }
  // Backups sit outside the skills and agents folders so the host never loads them.
  const backupDir = path.join(path.dirname(path.dirname(skillDir)), "graphmory-backups", new Date().toISOString().replace(/[:.]/g, "-"))
  if (action === "update" || skillAction === "update") fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  if (skillAction === "update") fs.renameSync(skillDir, path.join(backupDir, "memory-curator"))
  if (skillAction !== "unchanged") {
    fs.mkdirSync(path.dirname(skillDir), { recursive: true })
    fs.cpSync(skillSource, skillDir, { recursive: true, errorOnExist: true, force: false })
  }
  if (action === "update") fs.renameSync(agentPath, path.join(backupDir, path.basename(agentPath)))
  if (action !== "unchanged") {
    fs.mkdirSync(path.dirname(agentPath), { recursive: true })
    fs.writeFileSync(agentPath, content, { flag: "wx", mode: 0o600 })
  }
  if (action === "update" || skillAction === "update") console.log(`Previous files backed up to ${backupDir}`)
  console.log(`${action === "update" || skillAction === "update" ? "Updated" : "Installed"}. ${verificationReminder}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
