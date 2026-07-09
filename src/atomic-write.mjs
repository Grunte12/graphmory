import fs from "node:fs"
import path from "node:path"

export function writeFileAtomic(target, content, { fsApi = fs } = {}) {
  const absolute = path.resolve(target)
  fsApi.mkdirSync(path.dirname(absolute), { recursive: true })
  const temporary = path.join(
    path.dirname(absolute),
    `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`,
  )
  try {
    fsApi.writeFileSync(temporary, content)
    fsApi.renameSync(temporary, absolute)
  } catch (error) {
    try {
      if (fsApi.existsSync(temporary)) fsApi.unlinkSync(temporary)
    } catch {
      // Preserve the original error; leftover cleanup is best-effort.
    }
    throw error
  }
}

export function writeJsonAtomic(target, value, options) {
  writeFileAtomic(target, `${JSON.stringify(value, null, 2)}\n`, options)
}
