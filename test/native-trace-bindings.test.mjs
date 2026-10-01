import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { extractWaitTargetIds, extractRecallManagedOffsets, parseTraceFile, scanSession } from "../scripts/eval-mvp-correctness-repair.mjs"

test("wait IDs require an observed spawn result for dynamic variable/store targets", () => {
  const spawn = { input: 'const r = await tools.multi_agent_v1__spawn_agent({agent_type:"graphmory_curator"}); store("child_id", r.agent_id);', output: '{"agent_id":"child-1"}' }
  assert.deepEqual(extractWaitTargetIds([spawn, { input: 'await tools.multi_agent_v1__wait_agent({targets:[load("child_id")]});' }]), ["child-1"])
  assert.deepEqual(extractWaitTargetIds([{ ...spawn, input: spawn.input + '\nawait tools.multi_agent_v1__wait_agent({targets:[r.agent_id]});' }]), ["child-1"])
  assert.deepEqual(extractWaitTargetIds([{ input: 'await tools.multi_agent_v1__wait_agent({targets:[r.agent_id]});' }]), [])
  assert.deepEqual(extractWaitTargetIds([{ ...spawn, output: '' }, { input: 'await tools.multi_agent_v1__wait_agent({targets:[load("child_id")]});' }]), [])
  assert.deepEqual(extractWaitTargetIds([spawn, { input: 'r = unknownValue; await tools.multi_agent_v1__wait_agent({targets:[r.agent_id]});' }]), [])
})

test("variable command literals/templates preserve implicit and loop page offsets", () => {
  const input = 'const cli="/tmp/project/graphmory.mjs"; const first = `node ${cli} recall-managed --query recovery`; await tools.exec_command({cmd:first}); for (const offset of [2,4,6]) { const cmd=`node ${cli} recall-managed --offset ${offset}`; await tools.exec_command({cmd}); }'
  assert.deepEqual(extractRecallManagedOffsets([{ input }]), ["0", "2", "4", "6"])
})

test("spawn output is paired by call ID instead of unrelated outputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-trace-pair-")), file = path.join(root, "trace.jsonl")
  try {
    const records = [
      { type: "response_item", payload: { type: "custom_tool_call", name: "exec", call_id: "spawn", input: 'const r = await tools.multi_agent_v1__spawn_agent({}); await tools.multi_agent_v1__wait_agent({targets:[r.agent_id]});' } },
      { type: "response_item", payload: { type: "custom_tool_call_output", call_id: "other", output: '{"agent_id":"wrong-child"}' } },
      { type: "response_item", payload: { type: "custom_tool_call_output", call_id: "spawn", output: [{ type: "input_text", text: '{"agent_id":"right-child"}' }] } },
    ]
    fs.writeFileSync(file, records.map(row => JSON.stringify(row)).join("\n"))
    assert.deepEqual(extractWaitTargetIds(parseTraceFile(file).calls), ["right-child"])
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

const evidence = new URL('../../graphmory-mvp-repair-20261001/native/private/repair-native-05/evidence/native-traces.json', import.meta.url)
test("native-05 dynamic dispatch regression reads frozen raw traces without replacing scores", { skip: !fs.existsSync(evidence) }, () => {
  const record = JSON.parse(fs.readFileSync(evidence, "utf8"))
  for (const session of Object.values(record.sessions)) {
    const scan = scanSession(session, session.launchStateRoot, "/tmp/unused-project")
    assert.ok(scan.childWaitTargetIds.includes(session.dispatch.childThreadId))
    assert.equal(scan.dispatchTraceEvidence.pass, true)
  }
})
