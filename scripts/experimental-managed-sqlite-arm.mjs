#!/usr/bin/env node
// Development-only managed-recall arm. Production CLI never invokes this file.
import { spawnSync } from 'node:child_process'
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
for (const name of ['--arm', '--vault', '--query']) {
  if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const arm = option('--arm')
if (!['baseline', 'sqlite'].includes(arm)) throw new Error('Unknown arm')
const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
config.retrievalProfile = arm === 'sqlite' ? 'conversations' : 'mixed-notes'
const precomputedRankedLanes = []
if (arm === 'sqlite') {
  const db = option('--db')
  if (!db) throw new Error('Missing --db')
  const child = spawnSync(process.execPath,
    [new URL('./experimental-sqlite-postings.mjs', import.meta.url).pathname,
      'query', '--db', db, '--query', option('--query')],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 128 * 1024 * 1024 })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error('SQLite lane failed: ' + child.stderr.slice(0, 500))
  precomputedRankedLanes.push({ method: 'bm25f-focused-sections', results: JSON.parse(child.stdout) })
}
const report = await managedRecall(option('--vault'), option('--query'), config, {
  k: 10, scope: option('--scope') ?? '', adaptiveBundle: true,
  includeSuperseded: args.includes('--include-superseded'), precomputedRankedLanes,
})
console.log(JSON.stringify(report))
if (process.env.GRAPHMORY_EXPERIMENT_METRICS === '1') {
  console.error(JSON.stringify({ rssBytes: process.memoryUsage().rss,
    maxRssRaw: process.resourceUsage().maxRSS }))
}
