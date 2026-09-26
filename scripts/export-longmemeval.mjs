#!/usr/bin/env node
import fs from 'node:fs'
import { exportGenerationEntries } from './lib/longmemeval-export.mjs'
const [source, reportPath, arm, output]=process.argv.slice(2)
if(!source||!reportPath||!arm||!output)throw new Error('Usage: export-longmemeval.mjs <source JSON> <report JSON> <arm> <new output JSONL>')
const bytes=fs.readFileSync(source)
const rows=exportGenerationEntries(JSON.parse(bytes),JSON.parse(fs.readFileSync(reportPath,'utf8')),arm,bytes)
fs.writeFileSync(output,rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx',mode:0o600})
console.log(JSON.stringify({cases:rows.length,arm,format:'upstream flat-session generation input',containsGoldAnswers:false}))
