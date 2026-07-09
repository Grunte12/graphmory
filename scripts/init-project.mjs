#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const args = process.argv.slice(2)
function required(name) {
  const index = args.indexOf(name)
  if (index < 0 || !args[index + 1]) {
    console.error(`Missing required option: ${name}`)
    process.exit(2)
  }
  return args[index + 1]
}

const vault = path.resolve(required("--vault"))
const project = required("--project").trim()
if (!/^[\w .-]+$/u.test(project)) {
  console.error("Project name may contain letters, numbers, spaces, dots, underscores, and hyphens.")
  process.exit(2)
}

const projectRoot = path.join(vault, "02 Projects", project)
const directories = [
  "01 Decisions",
  "02 Workflows",
  "03 Root Causes",
  "04 Preferences",
  "05 Source Maps",
  "06 Tensions",
  "inbox/memory-patches",
]

fs.mkdirSync(projectRoot, { recursive: true })
directories.forEach((directory) => fs.mkdirSync(path.join(projectRoot, directory), { recursive: true }))

const home = path.join(projectRoot, "00 Project Home.md")
if (!fs.existsSync(home)) {
  fs.writeFileSync(
    home,
    `---\nproject: ${project}\ntype: project-home\nstatus: active\n---\n\n# ${project}\n\n## Current State\n\n## Active Decisions\n\n## Workflow Map\n\n## Preferences\n\n## Known Root Causes\n\n## Tensions\n\n## Source Maps\n`,
  )
}

console.log(`Initialized project memory: ${projectRoot}`)
console.log(`Project map: ${home}`)
