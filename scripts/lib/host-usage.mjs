export function summarizeHostUsage(events) {
  const steps = events.filter((event) => event.type === "step_finish")
  if (!steps.length || steps.some(({ part }) => !Number.isFinite(part?.tokens?.input)
    || !Number.isFinite(part?.tokens?.output) || !Number.isFinite(part?.tokens?.cache?.read)
    || !Number.isFinite(part?.tokens?.cache?.write))) return null
  return steps.reduce((sum, { part: { tokens } }) => ({
    input: sum.input + tokens.input, output: sum.output + tokens.output,
    cacheRead: sum.cacheRead + tokens.cache.read, cacheWrite: sum.cacheWrite + tokens.cache.write,
  }), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
}
