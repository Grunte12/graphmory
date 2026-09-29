import fs from "node:fs"
import { readSourceNotes } from "./source-read.mjs"

const PROTOCOL = "graphmory-source-handoff-v1"

// The lead supplies exact paths. This records identity, not relevance or authority.
export function createSourceHandoff(vault, paths) {
  const vaultRoot = fs.realpathSync(vault)
  const originals = readSourceNotes(vaultRoot, paths)
  return { protocol: PROTOCOL, vaultRoot, sources: originals.sources.map(({ path, sha256, bytes }) =>
    ({ path, sha256, bytes })) }
}

// Verify every source before releasing any original text to the caller.
export function readSourceHandoff(vault, manifest) {
  if (!manifest || manifest.protocol !== PROTOCOL || !Array.isArray(manifest.sources)
    || !manifest.sources.length || typeof manifest.vaultRoot !== "string") {
    throw new Error("Invalid source handoff manifest")
  }
  const vaultRoot = fs.realpathSync(vault)
  if (manifest.vaultRoot !== vaultRoot) throw new Error("Source handoff vault differs")
  const paths = manifest.sources.map((item) => {
    if (!item || typeof item.path !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256)
      || !Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw new Error("Invalid source handoff entry")
    }
    return item.path
  })
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate source handoff path")
  const originals = readSourceNotes(vaultRoot, paths)
  for (let i = 0; i < originals.sources.length; i++) {
    const actual = originals.sources[i]
    const expected = manifest.sources[i]
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      throw new Error(`SOURCE_CHANGED: ${expected.path}`)
    }
  }
  return originals
}
