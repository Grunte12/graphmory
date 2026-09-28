#!/usr/bin/env node
// Development-only managed-recall arm. Production CLI never invokes this file.
import { managedRecall } from '../src/decision-recall.mjs'
import { DEFAULT_RUNTIME_CONFIG } from '../src/runtime-config.mjs'
import { rank } from '../src/retrieval.mjs'
import { rankEligibleSqlite } from './experimental-sqlite-eligible-ranker.mjs'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
for (const name of ['--arm', '--vault', '--query']) {
  if (!option(name) || option(name).startsWith('--')) throw new Error('Missing ' + name)
}
const arm = option('--arm')
if (!['baseline', 'sqlite'].includes(arm)) throw new Error('Unknown arm')
const config = structuredClone(DEFAULT_RUNTIME_CONFIG)
config.retrievalProfile = 'mixed-notes'
const db = option('--db')
if (arm === 'sqlite' && !db) throw new Error('Missing --db')
const rankImpl = arm === 'sqlite'
  ? (documents, query, method) => method === 'bm25f-focused-sections'
    ? rankEligibleSqlite(db, documents, query) : rank(documents, query, method)
  : undefined
const report = await managedRecall(option('--vault'), option('--query'), config, {
  k: 10, scope: option('--scope') ?? '', adaptiveBundle: true,
  includeSuperseded: args.includes('--include-superseded'), rankImpl,
})
console.log(JSON.stringify(report))
if (process.env.GRAPHMORY_EXPERIMENT_METRICS === '1') {
  console.error(JSON.stringify({ rssBytes: process.memoryUsage().rss,
    maxRssRaw: process.resourceUsage().maxRSS }))
}
