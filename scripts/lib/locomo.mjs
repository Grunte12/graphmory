import { createHash } from "node:crypto"
export const digest = (value) => createHash("sha256").update(value).digest("hex")

export function prepareConversation(item) {
  if (typeof item?.sample_id !== "string" || !Array.isArray(item.qa) || !item.conversation) throw new Error("Invalid conversation")
  const evidencePaths = new Map()
  const documents = Object.entries(item.conversation).filter(([key,value]) => /^session_\d+$/u.test(key) && Array.isArray(value))
    .sort(([a],[b]) => Number(a.slice(8))-Number(b.slice(8)))
    .map(([key, turns]) => {
      const path = `${key}.md`
      const timestamp = item.conversation[`${key}_date_time`]
      if (typeof timestamp !== "string" || !turns.length) throw new Error("Missing timestamp or turns")
      const body = turns.map((turn) => {
        if (typeof turn.dia_id !== "string" || typeof turn.speaker !== "string" || typeof turn.text !== "string") throw new Error("Invalid turn")
        if (evidencePaths.has(turn.dia_id)) throw new Error("Duplicate turn ID")
        evidencePaths.set(turn.dia_id, path)
        return `## ${turn.speaker} (${turn.dia_id})\n${turn.text}${typeof turn.blip_caption === "string" ? `\nImage caption: ${turn.blip_caption}` : ""}`
      }).join("\n\n")
      return { path, markdown:`# Conversation ${key}\nTimestamp: ${timestamp}\n\n${body}` }
    })
  if (!documents.length) throw new Error("Empty history")
  const questions = item.qa.map((qa,index) => {
    if (typeof qa.question !== "string" || !qa.question.trim() || ![1,2,3,4,5].includes(qa.category) || !Array.isArray(qa.evidence)) throw new Error("Invalid QA")
    const unresolved = qa.evidence.filter((id) => !evidencePaths.has(id))
    return { id:`${item.sample_id}:${index}`, query:qa.question, category:qa.category,
      evidence: [...new Set(qa.evidence.map((id)=>evidencePaths.get(id)).filter(Boolean))],
      unresolved, goldTurns:qa.evidence.length,
      captionInGoldSession:qa.evidence.some((id)=>documents.find((doc)=>doc.path===evidencePaths.get(id))?.markdown.includes("Image caption:")) }
  })
  return { documents, questions }
}

export function evidenceMetrics(paths, gold, k) {
  if (!gold.length) return null
  const selected = paths.slice(0,k)
  const hits = gold.filter((id)=>selected.includes(id)).length
  return { recall:hits/gold.length, complete:hits===gold.length }
}
