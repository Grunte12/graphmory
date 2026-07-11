import test from "node:test"
import assert from "node:assert/strict"
import { parseMarkdown } from "../src/retrieval.mjs"
import { analyzeQuery, buildAliasMap, classifyQuery, detectScript, expandQueryTerms } from "../src/query-understanding.mjs"

test("detectScript distinguishes latin, thai, and mixed queries", () => {
  assert.equal(detectScript("What is the latest deploy window?"), "latin")
  assert.equal(detectScript("พนักงานทำงานจากที่บ้านได้สัปดาห์ละกี่วัน"), "thai")
  assert.equal(detectScript("password ต้องยาวอย่างน้อยกี่ตัวอักษร"), "mixed")
})

test("classifyQuery labels temporal and aggregation queries", () => {
  assert.deepEqual(classifyQuery("What is the latest deploy window?"), ["temporal"])
  assert.deepEqual(classifyQuery("List all the on-call rotations"), ["aggregation"])
  assert.deepEqual(classifyQuery("What is the password policy?"), ["factual"])
})

test("classifyQuery recognizes Thai temporal and aggregation markers", () => {
  assert.deepEqual(classifyQuery("นโยบายล่าสุดคืออะไร"), ["temporal"])
  assert.deepEqual(classifyQuery("มีนโยบายทั้งหมดกี่ข้อ"), ["aggregation"])
})

test("buildAliasMap mines canonical <-> alias sibling tokens from vault frontmatter", () => {
  const documents = [
    parseMarkdown(
      "Retry Backoff.md",
      "---\naliases: [reconnect policy]\n---\n# Retry Backoff\nUse exponential backoff with jitter.",
    ),
    parseMarkdown("Deploy Rollback.md", "# Deploy Rollback\nRoll back the previous release."),
  ]
  const aliasMap = buildAliasMap(documents)
  assert.ok(aliasMap.get("retry")?.has("reconnect"))
  assert.ok(aliasMap.get("reconnect")?.has("policy"))
  assert.ok(aliasMap.get("reconnect")?.has("retry"))
  assert.equal(aliasMap.has("deploy"), false, "documents without aliases contribute no map entries")
})

test("expandQueryTerms expands to alias-sourced, reduced-weight siblings", () => {
  const documents = [
    parseMarkdown(
      "Retry Backoff.md",
      "---\naliases: [reconnect policy]\n---\n# Retry Backoff\nUse exponential backoff with jitter.",
    ),
  ]
  const aliasMap = buildAliasMap(documents)
  const expansions = expandQueryTerms(["retry"], aliasMap)
  assert.ok(expansions.some((expansion) => expansion.term === "reconnect"))
  assert.ok(expansions.every((expansion) => expansion.source === "alias" && expansion.weight < 1))
})

test("expandQueryTerms is a no-op when there is no alias map or no overlap", () => {
  assert.deepEqual(expandQueryTerms(["retry"], new Map()), [])
  assert.deepEqual(expandQueryTerms(["retry"], undefined), [])
})

test("analyzeQuery returns lang, segments, classes, expansions, and a retry variant", () => {
  const documents = [
    parseMarkdown(
      "Retry Backoff.md",
      "---\naliases: [reconnect policy]\n---\n# Retry Backoff\nUse exponential backoff with jitter.",
    ),
  ]
  const aliasMap = buildAliasMap(documents)
  const analysis = analyzeQuery("What is the latest retry policy?", { aliasMap })
  assert.equal(analysis.lang, "latin")
  assert.ok(analysis.segments.includes("retry"))
  assert.deepEqual(analysis.classes, ["temporal"])
  assert.ok(analysis.expansions.some((expansion) => expansion.term === "reconnect"))
  assert.equal(analysis.variants.length, 1)
  assert.ok(analysis.variants[0].startsWith("What is the latest retry policy?"))
})

test("analyzeQuery with no vault index produces no expansions or variants", () => {
  const analysis = analyzeQuery("What is the latest retry policy?")
  assert.deepEqual(analysis.expansions, [])
  assert.deepEqual(analysis.variants, [])
})
