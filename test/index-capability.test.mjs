import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { persistentIndexLocation, supportsNativeSqlite } from "../src/index-capability.mjs"

test("SQLite is optional for Node 20 and enabled for Node 24", () => {
  assert.equal(supportsNativeSqlite("20.19.0"), false)
  assert.equal(supportsNativeSqlite("22.5.0"), false)
  assert.equal(supportsNativeSqlite("24.0.0"), true)
})

test("persistent cache cannot live in a vault, including through a symlink", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "graphmory-cache-path-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const vault = path.join(root, "vault")
  const cache = path.join(root, "cache")
  fs.mkdirSync(vault)
  fs.mkdirSync(cache)
  const link = path.join(root, "vault-link")
  fs.symlinkSync(vault, link)
  assert.throws(() => persistentIndexLocation(vault, "", path.join(vault, "index")), /INDEX_CACHE_INSIDE_VAULT/)
  assert.throws(() => persistentIndexLocation(vault, "", path.join(link, "index")), /INDEX_CACHE_INSIDE_VAULT/)
  assert.notEqual(persistentIndexLocation(vault, "a", cache), persistentIndexLocation(vault, "b", cache))
})
