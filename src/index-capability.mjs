import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export function supportsNativeSqlite(version = process.versions.node) {
  const major = Number.parseInt(String(version).split('.')[0], 10)
  return Number.isInteger(major) && major >= 24
}

function resolveExistingAncestors(target) {
  const absolute = path.resolve(target)
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute)
  const parent = path.dirname(absolute)
  if (parent === absolute) return absolute
  return path.join(resolveExistingAncestors(parent), path.basename(absolute))
}

export function persistentIndexLocation(vault, scope, cacheDirectory) {
  const realVault = fs.realpathSync(vault)
  const realCache = resolveExistingAncestors(cacheDirectory)
  const relative = path.relative(realVault, realCache)
  if (!relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    throw new Error('INDEX_CACHE_INSIDE_VAULT: choose a cache directory outside the Markdown vault')
  }
  const key = createHash('sha256').update(`${realVault}\0${String(scope)}`).digest('hex')
  return path.join(realCache, 'graphmory', `${key}.sqlite`)
}
