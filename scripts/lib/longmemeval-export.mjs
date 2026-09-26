import { hash, prepareCase } from './longmemeval.mjs'
export function exportGenerationEntries(items, report, arm, sourceBytes) {
  if(hash(sourceBytes)!==report.sourceSha256)throw new Error('Source hash differs from evaluated dataset')
  const byId=new Map(items.map(item=>[item.question_id,item]))
  const rows=report.runs.filter(run=>run.arm===arm)
  if(!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Missing or duplicate arm rows')
  return rows.map(run=>{
    const item=byId.get(run.id);if(!item)throw new Error('Missing case')
    const prepared=prepareCase(item), ids=new Set(prepared.documents.map(d=>d.path))
    if(!Array.isArray(run.selectedSessionPaths)||new Set(run.selectedSessionPaths).size!==run.selectedSessionPaths.length
      ||run.selectedSessionPaths.some(id=>!ids.has(id)))throw new Error('Invalid retrieval paths')
    return {question_id:item.question_id,question:item.question,question_date:item.question_date,
      // Upstream logs this field, but never sends it to the reader. Keep it blank; judge uses the original gold file.
      answer:'',haystack_session_ids:prepared.documents.map(d=>d.path),haystack_dates:prepared.documents.map(d=>d.session.date),
      haystack_sessions:prepared.documents.map(d=>d.session.turns),retrieval_results:{ranked_items:run.selectedSessionPaths.map(corpus_id=>({corpus_id}))}}
  })
}
