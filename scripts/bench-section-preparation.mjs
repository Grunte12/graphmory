#!/usr/bin/env node
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { execFileSync } from "node:child_process"
import { performance } from "node:perf_hooks"
import * as candidate from "../src/retrieval.mjs"
import { managedRecall as candidateRecall } from "../src/decision-recall.mjs"
import { DEFAULT_RUNTIME_CONFIG } from "../src/runtime-config.mjs"
const root = path.resolve(import.meta.dirname, "..")
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-sections-"))
try {
  const baselineRevision = "c272cf4"
  const source = execFileSync("git", ["show", `${baselineRevision}:src/retrieval.mjs`], { cwd: root, encoding: "utf8" })
    .replace('"./brain-sync.mjs"', JSON.stringify(pathToFileURL(path.join(root, "src/brain-sync.mjs")).href))
  const file = path.join(temp, "baseline.mjs")
  fs.writeFileSync(file, source)
  const baseline = await import(pathToFileURL(file).href)
  const baselineDir = path.join(temp, "baseline-src")
  fs.cpSync(path.join(root, "src"), baselineDir, { recursive:true })
  fs.writeFileSync(path.join(baselineDir, "retrieval.mjs"), execFileSync("git", ["show", `${baselineRevision}:src/retrieval.mjs`], {cwd:root,encoding:"utf8"}))
  const { managedRecall: baselineRecall } = await import(pathToFileURL(path.join(baselineDir,"decision-recall.mjs")).href)
  const make = (count) => Array.from({ length: count }, (_, i) => ({ id: `projects/note-${i}.md`,
    markdown: `---\nstatus: current\naliases: [Evidence, Records]\n---\n# Project ${i}\n` +
      Array.from({ length: 12 }, (_, j) => `## Decision ${j}\nProject group ${i % 20} preserves evidence ${j}. Do NOT erase records.\n`).join("") }))
  const rows = []
  for (const count of [100, 1000]) {
    const fixtures = make(count)
    const before = fixtures.map((f) => baseline.parseMarkdown(f.id, f.markdown))
    const after = fixtures.map((f) => candidate.parseMarkdown(f.id, f.markdown))
    for (let i = 0; i < count; i++) {
      if (JSON.stringify(baseline.splitMarkdownSections(before[i])) !== JSON.stringify(candidate.splitMarkdownSections(after[i]))) throw new Error("Section output drift")
    }
    for (const query of ["Which project group preserves evidence 7?", "Do NOT erase records", "Records Evidence"]) {
      const project = (m, d) => m.rank(d, query, "bm25f-focused-sections").map((r) => ({ id:r.id, score:r.score }))
      if (JSON.stringify(project(baseline, before)) !== JSON.stringify(project(candidate, after))) throw new Error("Rank drift")
    }
    for (let repeat = 0; repeat < 9; repeat++) {
      for (const arm of repeat % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]) {
        const module = arm === "baseline" ? baseline : candidate
        const documents = fixtures.map((f) => module.parseMarkdown(f.id, f.markdown))
        const start = performance.now()
        for (const document of documents) module.splitMarkdownSections(document)
        rows.push({ phase:"section-preparation", count, repeat, arm, elapsedMs:Number((performance.now()-start).toFixed(3)), sections:count*12 })
      }
    }
  }
  for (const count of [100,1000]) {
    const vault = path.join(temp, `vault-${count}`)
    fs.mkdirSync(path.join(vault,"projects"), {recursive:true})
    for (const f of make(count)) fs.writeFileSync(path.join(vault,f.id),f.markdown)
    for (let repeat=0;repeat<5;repeat++) {
      let previous
      for (const arm of repeat%2 ? ["candidate","baseline"] : ["baseline","candidate"]) {
        const recall=arm==="baseline"?baselineRecall:candidateRecall
        const start=performance.now()
        const response=await recall(vault,"Which project group preserves evidence 7?",DEFAULT_RUNTIME_CONFIG,{adaptiveBundle:true,matchedPreviews:true})
        const elapsedMs=Number((performance.now()-start).toFixed(3))
        const serialized=JSON.stringify(response)
        if(previous && previous!==serialized) throw new Error("Managed recall output drift")
        previous=serialized
        rows.push({phase:"managed-recall",count,repeat,arm,elapsedMs,bytes:Buffer.byteLength(serialized)})
      }
    }
  }
  const output = { baselineRevision, kind:"synthetic-section-preparation-not-end-to-end", parity:"sections-and-three-ranking-queries", rows }
  const index = process.argv.indexOf("--out")
  if (index >= 0) fs.writeFileSync(process.argv[index+1], JSON.stringify(output, null, 2)+"\n")
  for (const phase of ["section-preparation","managed-recall"]) for (const count of [100,1000]) for (const arm of ["baseline","candidate"]) {
    const values=rows.filter((r)=>r.phase===phase&&r.count===count&&r.arm===arm).map((r)=>r.elapsedMs).sort((a,b)=>a-b)
    console.log(JSON.stringify({phase,count,arm,medianMs:values[Math.floor(values.length/2)]}))
  }
} finally { fs.rmSync(temp, {recursive:true,force:true}) }
