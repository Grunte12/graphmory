import test from "node:test"
import assert from "node:assert/strict"
import { summarizeHostUsage } from "../scripts/lib/host-usage.mjs"

test("host usage adds all model steps and retains cache components separately", () => {
  const step = (input, output, read) => ({ type: "step_finish", part: { tokens: { input, output, cache: { read, write: 0 } } } })
  assert.deepEqual(summarizeHostUsage([step(10, 2, 30), { type: "text" }, step(20, 3, 40)]), { input: 30, output: 5, cacheRead: 70, cacheWrite: 0 })
})

test("missing token counters remain unknown instead of being counted as zero", () => {
  assert.equal(summarizeHostUsage([]), null)
  assert.equal(summarizeHostUsage([{ type: "step_finish", part: { tokens: { input: 10, output: 2 } } }]), null)
})
