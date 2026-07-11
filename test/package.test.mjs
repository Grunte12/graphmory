import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))

function listFiles(entry) {
  const fullPath = path.join(root, entry)
  if (!fs.existsSync(fullPath)) return []
  const stat = fs.statSync(fullPath)
  if (stat.isFile()) return [fullPath]
  if (!stat.isDirectory()) return []
  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((dirent) => {
    const child = path.join(entry, dirent.name)
    return listFiles(child)
  })
}

test("package ships the AI-agent entry instructions", () => {
  assert.equal(pkg.files.includes("AGENTS.md"), true)
  assert.equal(pkg.files.includes("CLAUDE.md"), true)
  assert.equal(fs.existsSync(path.join(root, "AGENTS.md")), true)
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8").trim(), "@AGENTS.md")
})

test("package exposes portable brain sync CLI aliases", () => {
  assert.equal(pkg.bin["memory-patch-harness"], "scripts/brain-sync.mjs")
  assert.equal(pkg.bin.mph, "scripts/brain-sync.mjs")
  assert.equal(fs.existsSync(path.join(root, pkg.bin.mph)), true)
})

test("all explicit package file entries exist", () => {
  for (const entry of pkg.files) {
    assert.equal(fs.existsSync(path.join(root, entry)), true, `missing package entry: ${entry}`)
  }
})

test("package allowlist excludes private runtime artifacts", () => {
  const normalized = pkg.files.map((entry) => entry.replaceAll("\\", "/"))
  assert.equal(normalized.some((entry) => entry.startsWith(".opencode")), false)
  assert.equal(normalized.some((entry) => entry.startsWith("tmp")), false)
  assert.equal(normalized.some((entry) => entry.includes("node_modules")), false)
})

test("package text has no known private workspace markers", () => {
  const forbidden = [
    /C:\\Users\\User/i,
    new RegExp(["Grunte", "Brain"].join(""), "i"),
    new RegExp(["Stock", "alytics"].join(""), "i"),
    new RegExp(["Grunte12", "my-brain"].join("/"), "i"),
    /sk-[A-Za-z0-9]{20,}/,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
  ]
  for (const entry of pkg.files) {
    for (const file of listFiles(entry)) {
      const ext = path.extname(file).toLowerCase()
      if (![".md", ".json", ".mjs", ".js", ".yml", ".yaml", ".cff", ""].includes(ext)) continue
      const content = fs.readFileSync(file, "utf8")
      for (const pattern of forbidden) {
        assert.equal(pattern.test(content), false, `${path.relative(root, file)} matched ${pattern}`)
      }
    }
  }
})

test("package text has no mojibake or replacement characters", () => {
  const mojibakePatterns = [
    /\uFFFD/u,
    /à¸/u,
    /à¹/u,
    /â€™|â€œ|â€\u009d|Ã©|Â/u,
  ]
  for (const entry of pkg.files) {
    for (const file of listFiles(entry)) {
      const ext = path.extname(file).toLowerCase()
      if (![".md", ".json", ".mjs", ".js", ".yml", ".yaml", ".cff", ""].includes(ext)) continue
      const content = fs.readFileSync(file, "utf8")
      for (const pattern of mojibakePatterns) {
        assert.equal(pattern.test(content), false, `${path.relative(root, file)} matched ${pattern}`)
      }
    }
  }
})

test("public Markdown entry points have no UTF-8 BOM", () => {
  for (const file of ["README.md", "AGENTS.md", "CLAUDE.md", "docs/install.md", "docs/portable-brain-sync.md"]) {
    const content = fs.readFileSync(path.join(root, file))
    const hasBom = content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf
    assert.equal(hasBom, false, `${file} contains a UTF-8 BOM`)
  }
})

test("agent package includes an unknown-failure recovery contract", () => {
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")
  const troubleshooting = fs.readFileSync(path.join(root, "docs", "troubleshooting.md"), "utf8")
  assert.match(agents, /Unknown Failure Protocol/)
  assert.match(troubleshooting, /Freeze state/)
  assert.match(troubleshooting, /Protect the only copy/)
  assert.match(troubleshooting, /Safe Escalation Report/)
  assert.match(troubleshooting, /Continue without optional services/)
})

test("agent package includes the shared-brain auto-pull contract", () => {
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")
  const portable = fs.readFileSync(path.join(root, "docs", "portable-brain-sync.md"), "utf8")
  const opencode = fs.readFileSync(path.join(root, "adapters", "opencode", "AGENTS.snippet.md"), "utf8")
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8")
  assert.match(agents, /auto-pull --vault/)
  assert.match(agents, /conflict-assist --vault/)
  assert.match(agents, /health --vault/)
  assert.match(agents, /Do not run a polling daemon/)
  assert.match(portable, /Hermes \+ OpenCode/)
  assert.match(portable, /separate local clones/)
  assert.match(portable, /Conflict assist/)
  assert.match(portable, /Check memory health/)
  assert.match(portable, /same-note conflicts/)
  assert.match(portable, /never auto-rebases/)
  assert.match(readme, /health --vault/)
  assert.match(opencode, /Memory Curator should not run Git sync itself/)
  assert.match(opencode, /conflict-assist --json/)
})

test("agent package preserves autonomy-first human-gated sync thresholds", () => {
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")
  const portable = fs.readFileSync(path.join(root, "docs", "portable-brain-sync.md"), "utf8")
  const generic = fs.readFileSync(path.join(root, "adapters", "generic-agent", "INSTALL.md"), "utf8")
  assert.match(agents, /Human Judgment Gates/)
  assert.match(agents, /autonomous loop engineering/)
  assert.match(agents, /Stop only at decision gates/)
  assert.match(agents, /Do not push after every remembered item/)
  assert.match(agents, /3-7 small APPLIED patches/)
  assert.match(portable, /Sync thresholds/)
  assert.match(portable, /not stop-and-ask synchronization/)
  assert.match(portable, /reversible detect-act-verify-repair loops/)
  assert.match(generic, /Do not push every remembered item/)
  assert.match(generic, /healthy threshold/)
})
