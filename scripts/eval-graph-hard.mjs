#!/usr/bin/env node
// Deterministic synthetic challenge. No model calls, private notes, or persistent vault writes.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graphmory-hard-'))
const vault = path.join(temp, 'vault')
const notes = new Map()
const queries = []
const add = (id, text) => notes.set(id, text)
const question = (id, category, query, gold, extra = {}) => queries.push({ id, category, query,
  relevant_groups: gold.map((p) => [p]), ...extra })
try {
  for (const [index, name] of ['Cobalt', 'Juniper', 'Saffron', 'Vesper'].entries()) {
    const dir = `Projects/${name}`
    const code = `K${index + 41}`
    const indexPath = `${dir}/Index.md`, bridge = `${dir}/Decision.md`, target = `${dir}/Runbook.md`, evidence = `${dir}/Evidence.md`
    add(indexPath, `---\nstatus: current\n---\n# ${name} production service\nThis service uses the ${code} release policy.\nSee [[${bridge}]].\n`)
    add(bridge, `---\nstatus: current\ndepends_on: ${target}\n---\n# ${code} authorization\nPromotion is permitted only after the guard check.\nThe operational procedure is [procedure](Runbook.md).\n`)
    add(target, `---\nstatus: current\nevidence_for: ${evidence}\n---\n# ${code} guard procedure\nIf the drift exceeds ${index + 3} percent, stop promotion and restore the previous build.\nThe responsible team is Unit ${index + 7}.\n`)
    add(evidence, `---\nstatus: current\n---\n# ${code} validation record\nThe recovery exercise succeeded on 2026-09-20. Source: synthetic exercise ${code}.\n`)
    add(`${dir}/Old.md`, `---\nstatus: superseded\n---\n# ${name} production release rollback owner\nNever stop promotion. Unit 99 owns rollback. [[${indexPath}]]\n`)
    add(`${dir}/Hub.md`, `# ${name} release archive index\n${Array.from({length: 45}, (_, i) => `[[Noise/N${index}-${i}.md]]`).join('\n')}\n[[${indexPath}]]\n`)
    for (let i = 0; i < 45; i++) add(`Noise/N${index}-${i}.md`, `# ${name} release rollback owner discussion ${i}\n${name} production release rollback owner deployment operations.\nThis draft discussion contains no approved threshold or team assignment.\n`)
    question(`${name}-direct`, 'direct', `Which team follows the ${code} guard procedure?`, [target])
    question(`${name}-natural`, 'natural-multihop', `For ${name}, when must we undo a rollout, and which team handles it?`, [indexPath, bridge, target])
    question(`${name}-scoped`, 'scoped-multihop', `For ${name}, when must we undo a rollout, and which team handles it?`, [indexPath, bridge, target], {scope: dir})
    question(`${name}-graph`, 'explicit-graph', `What other notes are linked to ${name} production service and its guard procedure?`, [bridge, target], {scope: dir})
    question(`${name}-long-chain`, 'three-hop-capacity', `Which notes connected to ${name} establish its policy, stopping rule and tested recovery?`, [indexPath, bridge, target, evidence], {scope: dir})
    question(`${name}-missing`, 'unsupported', `What is the approved monthly budget for ${name}?`, [], {scope: dir})
  }
  add('Teams/North/Relay.md', '# Relay\nThe Relay system in North is owned by Team Snow.')
  add('Teams/South/Relay.md', '# Relay\nThe Relay system in South is owned by Team Sun.')
  add('Teams/Index.md', '# Team systems\n[[Relay]] is ambiguous; use the full path.')
  question('ambiguous-relay', 'ambiguous', 'Who owns Relay?', [])
  question('scoped-relay', 'disambiguation', 'Who owns Relay?', ['Teams/North/Relay.md'], {scope: 'Teams/North'})
  add('Policies/A.md', '# Approval rule\nCurrent record A requires two reviewers. No precedence over record B has been established.')
  add('Policies/B.md', '# Approval rule\nCurrent record B requires three reviewers. No precedence over record A has been established.')
  question('conflict-evidence', 'conflict', 'Which records disagree about how many reviewers are required?', ['Policies/A.md', 'Policies/B.md'], {scope: 'Policies'})
  question('conflict-unresolved', 'unsupported', 'What is the single authoritative reviewer count?', [], {scope: 'Policies'})
  question('unknown-service', 'unsupported', 'What is the deployment key for the nonexistent Quartz service?', [])
  question('alias-gap', 'semantic-gap', 'Who handles reversing a launch for the blue-metal project?', ['Projects/Cobalt/Index.md', 'Projects/Cobalt/Decision.md', 'Projects/Cobalt/Runbook.md'])
  for (const q of queries) {
    for (const group of q.relevant_groups) for (const id of group) {
      if (!notes.has(id)) throw new Error(`Missing gold: ${id}`)
      if (q.scope && !id.startsWith(q.scope + '/')) throw new Error(`Out-of-scope gold: ${id}`)
    }
  }
  for (const [id, text] of notes) {
    const file = path.join(vault, id)
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, text)
  }
  const queryFile = path.join(temp, 'queries.json'), reportFile = path.join(temp, 'report.json')
  fs.writeFileSync(queryFile, JSON.stringify(queries))
  const run = spawnSync(process.execPath, [path.join(root, 'scripts/eval-adaptive-graph.mjs'), '--vault', vault, '--queries', queryFile, '--json', reportFile], {encoding: 'utf8'})
  if (run.status !== 0) throw new Error(run.stderr || run.stdout)
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
  const digest = (value) => createHash('sha256').update(value).digest('hex')
  report.suite = 'graph-hard-v1'
  report.fixtureHash = digest(JSON.stringify([...notes]))
  report.queryHash = digest(JSON.stringify(queries))
  report.implementationHash = digest(['src/retrieval.mjs','src/graph-navigation.mjs','src/adaptive-recall.mjs','src/brain-sync.mjs','src/memory-recall.mjs'].map(p => fs.readFileSync(path.join(root,p),'utf8')).join('\n'))
  report.design = 'Synthetic challenge frozen before first run; not an external benchmark or generated-answer evaluation. Runtime not tuned against this suite.'
  report.queries = queries
  report.categories = {}
  for (const category of new Set(queries.map(q => q.category))) {
    const cases = queries.filter(q => q.category === category)
    report.categories[category] = {}
    for (const arm of ['baseline','graph']) {
      const runs = report.runs[arm].filter(r => cases.some(q => q.id === r.id))
      const answerable = runs.filter(r => r.top3)
      report.categories[category][arm] = {cases: runs.length, answerable: answerable.length,
        completeAt3: answerable.filter(r => r.completeAt3).length,
        completeAt12: answerable.filter(r => r.completeAt12).length,
        noAnswerWithCandidates: runs.filter(r => !r.top3 && r.retrieved.length).length}
    }
  }
  report.boundaries = {}
  for (const arm of ['baseline', 'graph']) {
    report.boundaries[arm] = { staleCandidates: 0, outOfScopeCandidates: 0 }
    for (const run of report.runs[arm]) {
      const q = queries.find(q => q.id === run.id)
      report.boundaries[arm].staleCandidates += run.retrieved.filter(id => id.endsWith('/Old.md')).length
      report.boundaries[arm].outOfScopeCandidates += run.retrieved.filter(id => q.scope && !id.startsWith(q.scope + '/')).length
    }
  }
  report.graphActivation = { queries: report.runs.graph.filter(r => r.rounds > 0).map(r => r.id),
    unverifiedResults: report.runs.graph.every(r => r.evidenceStatus === 'unverified') }
  report.top3Capacity = {answerable: queries.filter(q => q.relevant_groups.length).length,
    impossibleAt3: queries.filter(q => q.relevant_groups.length > 3).map(q => q.id)}
  report.top3Capacity.achievableCompleteAt3 = {}
  for (const arm of ['baseline', 'graph']) {
    const achievable = report.runs[arm].filter(r => r.top3 && !report.top3Capacity.impossibleAt3.includes(r.id))
    report.top3Capacity.achievableCompleteAt3[arm] = { complete: achievable.filter(r => r.completeAt3).length, total: achievable.length }
  }
  const outputIndex = process.argv.indexOf('--out')
  if (outputIndex !== -1) {
    if (!process.argv[outputIndex + 1]) throw new Error('--out requires a path')
    fs.writeFileSync(path.resolve(process.argv[outputIndex + 1]), JSON.stringify(report, null, 2) + '\n')
  }
  console.log(JSON.stringify({suite:report.suite,notes:report.notes,questions:report.questions,baseline:report.baseline,graph:report.graph,categories:report.categories,top3Capacity:report.top3Capacity},null,2))
} finally { fs.rmSync(temp, {recursive: true, force: true}) }
