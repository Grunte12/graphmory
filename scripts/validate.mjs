#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import {
  detectContract,
  validateBrainBrief,
  validateCurationPlan,
  validateDerivedIndex,
  validateHotContextPack,
  validateLearningPacket,
  validateMemoryPatch,
} from "../src/contracts.mjs"

const target = process.argv[2]
if (!target) {
  console.error("Usage: node scripts/validate.mjs <contract.json>")
  process.exit(2)
}

const absolute = path.resolve(target)
let value
try {
  value = JSON.parse(fs.readFileSync(absolute, "utf8"))
} catch (error) {
  console.error(`Invalid JSON: ${error.message}`)
  process.exit(1)
}

const kind = detectContract(value)
const result =
  kind === "memory-patch"
    ? validateMemoryPatch(value)
    : kind === "learning-packet"
      ? validateLearningPacket(value)
    : kind === "brain-brief"
      ? validateBrainBrief(value)
      : kind === "derived-index"
        ? validateDerivedIndex(value)
      : kind === "hot-context-pack"
          ? validateHotContextPack(value)
          : kind === "curation-plan"
            ? validateCurationPlan(value)
          : { valid: false, errors: ["unable to detect contract type"] }

if (!result.valid) {
  console.error(`${kind} validation failed:`)
  result.errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`${kind} is valid: ${absolute}`)
