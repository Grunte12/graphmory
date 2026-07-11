import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const claudeAdapter = path.join(root, "adapters", "claude-code")
const codexAdapter = path.join(root, "adapters", "codex")
const opencodeAdapter = path.join(root, "adapters", "opencode")

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const stat = fs.statSync(dir)
  if (stat.isFile()) return [dir]
  if (!stat.isDirectory()) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => listFiles(path.join(dir, dirent.name)))
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const lines = match[1].split(/\r?\n/)
  const fields = {}
  for (const line of lines) {
    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (fieldMatch) fields[fieldMatch[1]] = fieldMatch[2].trim()
  }
  return fields
}

function pwshAvailable() {
  const probe = spawnSync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.Major"], {
    encoding: "utf8",
    shell: false,
  })
  return probe.status === 0
}

test("claude-code settings.snippet.json parses and contains only the documented single hook", () => {
  const snippetPath = path.join(claudeAdapter, "settings.snippet.json")
  const content = fs.readFileSync(snippetPath, "utf8")
  const parsed = JSON.parse(content)

  assert.ok(parsed.hooks, "settings snippet should have a hooks block")
  const hookEvents = Object.keys(parsed.hooks)
  assert.deepEqual(hookEvents, ["UserPromptSubmit"], "only UserPromptSubmit should be wired")

  const matchers = parsed.hooks.UserPromptSubmit
  assert.equal(matchers.length, 1, "exactly one UserPromptSubmit matcher block")

  const hooks = matchers[0].hooks
  assert.equal(hooks.length, 1, "exactly one hook command")
  assert.ok(
    hooks[0].args.some((arg) => arg.includes("brain-brief-hook.ps1")),
    "the single hook should be brain-brief-hook.ps1",
  )
})

test("agent and skill frontmatter under adapters/ uses only portable model values", () => {
  const portable = new Set(["sonnet", "opus", "haiku", "inherit"])
  const adaptersDir = path.join(root, "adapters")
  const candidates = listFiles(adaptersDir).filter(
    (file) => file.endsWith(".md") && (file.includes(`${path.sep}agents${path.sep}`) || /SKILL\.md$/.test(file)),
  )
  assert.ok(candidates.length > 0, "expected at least one agent/skill markdown file under adapters/")

  for (const file of candidates) {
    const content = fs.readFileSync(file, "utf8")
    const frontmatter = parseFrontmatter(content)
    if (!frontmatter || !("model" in frontmatter)) continue
    const model = frontmatter.model
    const isPortableAlias = portable.has(model)
    const isFullModelId = /^claude-[a-z0-9.-]+$/i.test(model) || /^gpt-[a-z0-9.-]+$/i.test(model)
    assert.ok(
      isPortableAlias || isFullModelId,
      `${path.relative(root, file)} has non-portable model value: ${model}`,
    )
    assert.notEqual(model.toLowerCase(), "fable", `${path.relative(root, file)} must not use model: fable`)
  }
})

test("claude-code memory curator can place patches but cannot author meaning", () => {
  const agentPath = path.join(claudeAdapter, "agents", "memory-curator.md")
  const content = fs.readFileSync(agentPath, "utf8")
  const frontmatter = parseFrontmatter(content)

  assert.ok(frontmatter, "claude-code curator should have YAML frontmatter")
  assert.match(frontmatter.tools, /\bWrite\b/u, "curator needs Write for new canonical notes")
  assert.match(frontmatter.tools, /\bEdit\b/u, "curator needs Edit for merge, links, and lifecycle updates")
  assert.doesNotMatch(content, /read-only memory curator/iu)
  assert.doesNotMatch(content, /lead uses `brain-update`/iu)
  assert.match(content, /lead owns semantic meaning/iu)
  assert.match(content, /APPLIED[\s\S]*TENSION[\s\S]*BLOCKED/u)
})

test("OpenCode wildcard curator has three modes and narrow write authority", () => {
  const template = fs.readFileSync(path.join(opencodeAdapter, "agents", "memory_curator.md"), "utf8")
  const prompt = fs.readFileSync(path.join(opencodeAdapter, "memory-curator-prompt.md"), "utf8")

  assert.match(template, /mode: subagent/u)
  assert.match(template, /1\. Recall:[\s\S]*2\. Synthesis:[\s\S]*3\. Consolidation:/u)
  assert.match(template, /Recall:[\s\S]*Do not edit\./u)
  assert.match(template, /Consolidation:[\s\S]*complete lead-authored patch/u)
  assert.match(template, /task: deny/u)
  assert.match(template, /webfetch: deny/u)
  assert.match(template, /websearch: deny/u)
  assert.match(template, /bash:\s+["']?\*["']?: deny/us)
  assert.match(template, /edit:\s+["']?\*["']?: deny[\s\S]*VAULT_GLOB_JSON/us)
  assert.match(template, /TENSION[\s\S]*do not mutate canonical memory/u)
  assert.match(template, /BLOCKED[\s\S]*do not mutate canonical memory/u)
  assert.doesNotMatch(`${template}\n${prompt}`, /brain-ingest|brain-update/iu)
})

test("core curator contract does not require adapter-specific ingest or update helpers", () => {
  const skill = fs.readFileSync(path.join(root, "skills", "memory-curator", "SKILL.md"), "utf8")
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8")
  assert.doesNotMatch(`${skill}\n${agents}`, /send to `brain-ingest`|use `brain-update` to promote/iu)
  assert.match(skill, /complete lead-authored patch/iu)
})

test("remaining claude-code .ps1 scripts parse with the PowerShell parser", { skip: !pwshAvailable() }, () => {
  const scriptsDir = path.join(claudeAdapter, "scripts")
  const scripts = fs.readdirSync(scriptsDir).filter((file) => file.endsWith(".ps1"))
  assert.ok(scripts.length > 0, "expected at least one .ps1 script")

  for (const script of scripts) {
    const scriptPath = path.join(scriptsDir, script)
    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-Command",
        `$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replace(/'/g, "''")}', [ref]$null, [ref]$errors) | Out-Null; if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; exit 1 } else { exit 0 }`,
      ],
      { encoding: "utf8", shell: false },
    )
    assert.equal(result.status, 0, `${script} failed to parse: ${result.stderr}`)
  }
})

test("brain-brief hook fails closed when vault/scope env is unset", { skip: !pwshAvailable() }, () => {
  const hookPath = path.join(claudeAdapter, "scripts", "brain-brief-hook.ps1")
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-brain-brief-"))
  const fakeHome = path.join(tmp, "home")
  fs.mkdirSync(fakeHome, { recursive: true })

  try {
    const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome }
    delete env.OBSIDIAN_VAULT
    delete env.MEMORY_PATCH_HARNESS_SCOPE

    const result = spawnSync("pwsh", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", hookPath], {
      input: JSON.stringify({ prompt: "remind me about our claude memory handoff and context caching setup" }),
      encoding: "utf8",
      shell: false,
      env,
    })

    assert.equal(result.status, 0, `hook should exit 0, stderr: ${result.stderr}`)
    assert.equal(result.stdout.trim(), "", "hook must emit no output when vault/scope env is missing")
    assert.equal(
      fs.existsSync(path.join(fakeHome, "ObsidianVault")),
      false,
      "hook must never create a fallback vault directory",
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("codex memory-curator skill file exists at the documented adapter path", () => {
  const skillPath = path.join(codexAdapter, "skills", "memory-curator", "SKILL.md")
  assert.ok(fs.existsSync(skillPath), "adapters/codex/skills/memory-curator/SKILL.md should exist")
  const content = fs.readFileSync(skillPath, "utf8")
  const frontmatter = parseFrontmatter(content)
  assert.ok(frontmatter, "codex skill file should have YAML frontmatter")
  assert.equal(frontmatter.name, "memory-curator")
  assert.ok(frontmatter.description && frontmatter.description.length > 0)
})

test("codex recall skill uses bounded sparse recall and one semantic candidate fallback", () => {
  const content = fs.readFileSync(path.join(codexAdapter, "skills", "memory-curator", "SKILL.md"), "utf8")
  assert.match(content, /recall[^\n]+--k 3 --rerank/u)
  assert.match(content, /recall-semantic[^\n]+--k 10/u)
  assert.match(content, /candidate metadata, not\s+permission to read ten notes/u)
  assert.match(content, /archive.*auto-triggers.*memory-patches/us)
  assert.match(content, /one primary and two supporting paths/u)
  assert.match(content, /raw retriever confidence is\s+low/u)
})

test("codex intake and update skills preserve lead authorship and evidence boundaries", () => {
  const ingest = fs.readFileSync(path.join(codexAdapter, "skills", "brain-ingest", "SKILL.md"), "utf8")
  const update = fs.readFileSync(path.join(codexAdapter, "skills", "brain-update", "SKILL.md"), "utf8")

  assert.match(ingest, /Ingestion is evidence preparation, not memory authorship/u)
  assert.match(ingest, /Do not edit the vault/u)
  assert.match(ingest, /secret_scan/u)
  assert.match(ingest, /lead agent owns the\s+claim/u)

  assert.match(update, /lead-agent write workflow/u)
  assert.match(update, /Never promote an Evidence Digest/u)
  assert.match(update, /APPLIED.*TENSION.*BLOCKED/us)
  assert.match(update, /Never auto-push/u)
})

test("codex custom agent templates are narrow, read-only, and model-configurable", () => {
  const agentsDir = path.join(codexAdapter, "agents")
  const expected = ["memory-curator.toml", "memory-curator-deep.toml", "memory-ingest.toml"]
  for (const file of expected) {
    const content = fs.readFileSync(path.join(agentsDir, file), "utf8")
    assert.match(content, /^name = ".+"/mu)
    assert.match(content, /^description = ".+"/mu)
    assert.match(content, /^model = "\{\{.+_MODEL\}\}"/mu)
    assert.match(content, /^model_reasoning_effort = "\{\{.+_EFFORT\}\}"/mu)
    assert.match(content, /^sandbox_mode = "read-only"/mu)
    assert.doesNotMatch(content, /model\s*=\s*"fable"/iu)
  }
})

test("claude-code installer renders adapter files without modifying CLAUDE.md or settings.json", { timeout: 30_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-claude-adapter-"))
  const claudeHome = path.join(tmp, "claude-home")
  const vault = path.join(tmp, "Brain Vault")
  fs.mkdirSync(vault, { recursive: true })

  try {
    const result = spawnSync(process.execPath, [
      path.join(claudeAdapter, "install.mjs"),
      "--claude-home", claudeHome,
      "--vault", vault,
      "--scope", "02 Projects/Test Memory",
      "--force",
    ], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)

    const installedAgent = path.join(claudeHome, "agents", "memory-curator.md")
    const installedSkill = path.join(claudeHome, "skills", "claude-memory-handoff", "SKILL.md")
    const claudeSnippet = path.join(claudeHome, "memory-patch-harness", "CLAUDE.snippet.md")
    const settingsSnippet = path.join(claudeHome, "memory-patch-harness", "settings.snippet.json")
    const installedScripts = fs.readdirSync(path.join(claudeAdapter, "scripts"))
      .filter((file) => file.endsWith(".ps1"))
      .map((file) => path.join(claudeHome, "scripts", file))

    assert.ok(fs.existsSync(installedAgent))
    assert.ok(fs.existsSync(installedSkill))
    assert.ok(fs.existsSync(claudeSnippet))
    assert.ok(fs.existsSync(settingsSnippet))
    for (const scriptPath of installedScripts) assert.ok(fs.existsSync(scriptPath))

    assert.equal(fs.existsSync(path.join(claudeHome, "CLAUDE.md")), false)
    assert.equal(fs.existsSync(path.join(claudeHome, "settings.json")), false)

    for (const file of [installedSkill, claudeSnippet, settingsSnippet]) {
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), /<CLAUDE_HOME>|<path-to-your-vault>|<your-memory-scope>/u)
    }

    const settings = JSON.parse(fs.readFileSync(settingsSnippet, "utf8"))
    assert.equal(settings.env.OBSIDIAN_VAULT, vault)
    assert.equal(settings.env.MEMORY_PATCH_HARNESS_SCOPE, "02 Projects/Test Memory")

    const doctor = spawnSync(process.execPath, [
      path.join(claudeHome, "bin", "memory-patch-harness.mjs"),
      "doctor",
      "--json",
    ], { cwd: tmp, encoding: "utf8", shell: false })
    assert.equal(doctor.status, 0, doctor.stderr)
    assert.equal(JSON.parse(doctor.stdout).ok, true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("claude-code installer copies scripts individually and never wipes an existing scripts/ directory", { timeout: 30_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-claude-adapter-merge-"))
  const claudeHome = path.join(tmp, "claude-home")
  const vault = path.join(tmp, "Brain Vault")
  fs.mkdirSync(vault, { recursive: true })
  fs.mkdirSync(path.join(claudeHome, "scripts"), { recursive: true })
  const unrelatedScript = path.join(claudeHome, "scripts", "unrelated-personal-hook.ps1")
  fs.writeFileSync(unrelatedScript, "# personal script, not part of this adapter\n")

  try {
    const result = spawnSync(process.execPath, [
      path.join(claudeAdapter, "install.mjs"),
      "--claude-home", claudeHome,
      "--vault", vault,
      "--scope", "02 Projects/Test Memory",
      "--force",
    ], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.ok(fs.existsSync(unrelatedScript), "installer must not delete unrelated files in an existing scripts/ directory")
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test("codex installer renders skills and agents without modifying AGENTS.md", { timeout: 30_000 }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mph-codex-adapter-"))
  const codexHome = path.join(tmp, "codex-home")
  const harnessTarget = path.join(codexHome, "tools", "memory-patch-harness")
  const vault = path.join(tmp, "Brain Vault")
  fs.mkdirSync(vault, { recursive: true })

  try {
    const result = spawnSync(process.execPath, [
      path.join(codexAdapter, "install.mjs"),
      "--codex-home", codexHome,
      "--harness-target", harnessTarget,
      "--vault", vault,
      "--scope", "02 Projects/Test Memory",
      "--curator-model", "gpt-5.4-mini",
      "--deep-model", "gpt-5.4",
      "--force",
    ], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)

    const installedAgent = path.join(codexHome, "agents", "memory-curator.toml")
    const installedSkill = path.join(codexHome, "skills", "memory-curator", "SKILL.md")
    const snippet = path.join(codexHome, "memory-patch-harness", "AGENTS.snippet.md")
    assert.ok(fs.existsSync(installedAgent))
    assert.ok(fs.existsSync(installedSkill))
    assert.ok(fs.existsSync(snippet))
    assert.equal(fs.existsSync(path.join(codexHome, "AGENTS.md")), false)

    for (const file of [installedAgent, installedSkill, snippet]) {
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\{\{[A-Z_]+\}\}/u)
    }
    const agent = fs.readFileSync(installedAgent, "utf8")
    assert.match(agent, /model = "gpt-5\.4-mini"/u)
    assert.match(agent, /sandbox_mode = "read-only"/u)

    const doctor = spawnSync(process.execPath, [
      path.join(harnessTarget, "bin", "memory-patch-harness.mjs"),
      "doctor",
      "--json",
    ], { cwd: tmp, encoding: "utf8", shell: false })
    assert.equal(doctor.status, 0, doctor.stderr)
    assert.equal(JSON.parse(doctor.stdout).ok, true)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
