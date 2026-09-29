import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { assertRealPathInsideVault, safeMigrationPath } from "./brain-sync.mjs"

// Full originals, never silently shortened. This verifies identity, not meaning.
export function readSourceNotes(vault, requestedPaths) {
  if (!Array.isArray(requestedPaths) || !requestedPaths.length) throw new Error("paths must be a non-empty JSON array")
  const paths = [...new Set(requestedPaths.map((value) => safeMigrationPath(value, "source path")))]
  return { sources: paths.map((relative) => {
    if (!relative.toLowerCase().endsWith(".md")) throw new Error("Only Markdown source paths are supported")
    const candidate = path.resolve(vault, relative)
    assertRealPathInsideVault(fs, vault, candidate, "source path")
    if (!fs.statSync(candidate).isFile()) throw new Error("Source path is not a file")
    const bytes = fs.readFileSync(candidate)
    const markdown = bytes.toString("utf8")
    return { path: relative, sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length, lines: markdown.split("\n").length, markdown }
  }) }
}
