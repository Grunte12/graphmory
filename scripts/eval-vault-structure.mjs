#!/usr/bin/env node
// Controlled 2x2 ablation on the committed research vault. No user vault is read or written.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadVaultDocuments } from "../src/memory-recall.mjs"
import { governedRank, parseMarkdown, scoreRun, scoreRunGroups, summarizeRuns } from "../src/retrieval.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const vault = path.join(root, "eval/real-vault/vault")
const queries = JSON.parse(fs.readFileSync(path.join(root, "eval/real-vault/queries.json"), "utf8"))
const source = loadVaultDocuments(vault)
const moc = (id) => /-moc\.md$/iu.test(id)
const key = (id) => path.basename(id)

if (queries.some((item) => item.scope)) throw new Error("This ablation expects unscoped queries")
if (queries.some((item) => JSON.stringify(item.relevant ?? item.relevant_groups).includes("-moc.md"))) {
  throw new Error("MOC pages must not be gold evidence when removed in the no-MOC arms")
}
if (new Set(source.map((document) => key(document.id))).size !== source.length) {
  throw new Error("Flattening would collide on note filenames")
}

const arms = [
  { id: "flat-no-index", flat: true, index: false },
  { id: "grouped-no-index", flat: false, index: false },
  { id: "flat-with-index", flat: true, index: true },
  { id: "grouped-with-index", flat: false, index: true },
]
const report = {
  suite: "vault-structure-ablation",
  corpus: "eval/real-vault/vault",
  questionSet: "eval/real-vault/queries.json",
  k: 3,
  method: "governed-bm25f-sections",
  note: "Development/public research fixture; same Markdown bodies and gold labels. Index arms add existing MOC notes. No project routing or agent-answer quality measured.",
  arms: {},
}

for (const arm of arms) {
  const documents = source.filter((document) => arm.index || !moc(document.id))
    .map((document) => parseMarkdown(arm.flat ? key(document.id) : document.id, document.markdown))
  const runs = queries.map((item) => {
    const relevant = item.relevant?.map((id) => arm.flat ? key(id) : id)
    const groups = item.relevant_groups?.map((group) => group.map((id) => arm.flat ? key(id) : id))
    if (!relevant?.length && !groups?.length) throw new Error(`Query ${item.id} lacks gold evidence`)
    const results = governedRank(documents, item.query, "bm25f-sections").results
    const metrics = groups ? scoreRunGroups(results, groups, 3) : scoreRun(results, relevant, 3)
    return {
      id: item.id,
      category: item.category,
      metrics,
      retrieved: results.slice(0, 3).map((result) => result.id),
    }
  })
  const summary = summarizeRuns(runs)
  report.arms[arm.id] = {
    notes: documents.length,
    summary,
    misses: runs.filter((run) => run.metrics.hit === 0).map((run) => run.id),
    byCategory: Object.fromEntries([...new Set(queries.map((item) => item.category))].map((category) => [
      category, summarizeRuns(runs.filter((run) => run.category === category)),
    ])),
    runs,
  }
}

// Paired resampling preserves each query's difficulty across the two arms.
function pairedDifference(left, right, metric, samples = 5000) {
  const a = report.arms[left].runs.map((run) => run.metrics[metric])
  const b = report.arms[right].runs.map((run) => run.metrics[metric])
  let state = 20260926
  const draw = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x100000000)
  const differences = []
  for (let sample = 0; sample < samples; sample++) {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const at = Math.floor(draw() * a.length)
      sum += a[at] - b[at]
    }
    differences.push(sum / a.length)
  }
  differences.sort((x, y) => x - y)
  return {
    mean: a.reduce((sum, value, i) => sum + value - b[i], 0) / a.length,
    pairedBootstrap95: [differences[Math.floor(samples * 0.025)], differences[Math.floor(samples * 0.975)]],
  }
}
report.contrasts = {
  folderEffectWithoutIndex: {
    hitAt3: pairedDifference("grouped-no-index", "flat-no-index", "hit"),
    recallAt3: pairedDifference("grouped-no-index", "flat-no-index", "recall"),
    reciprocalRank: pairedDifference("grouped-no-index", "flat-no-index", "reciprocalRank"),
  },
  indexEffectWithinGrouped: {
    hitAt3: pairedDifference("grouped-with-index", "grouped-no-index", "hit"),
    recallAt3: pairedDifference("grouped-with-index", "grouped-no-index", "recall"),
    reciprocalRank: pairedDifference("grouped-with-index", "grouped-no-index", "reciprocalRank"),
  },
}

const percent = (value) => `${(value * 100).toFixed(1)}%`
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`Vault structure ablation: same ${queries.length} questions, k=3, governed BM25F sections`)
  console.log("| Arm | Notes | Hit@3 | Recall@3 | MRR | nDCG@3 | Context chars | Misses |")
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
  for (const [name, arm] of Object.entries(report.arms)) {
    const s = arm.summary
    console.log(`| ${name} | ${arm.notes} | ${percent(s.hitAtK)} | ${percent(s.recallAtK)} | ${s.mrr.toFixed(3)} | ${s.ndcgAtK.toFixed(3)} | ${s.averageContextCharacters.toFixed(0)} | ${arm.misses.length} |`)
  }
}
