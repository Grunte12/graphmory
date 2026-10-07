// Owner decisions over MCP elicitation. The host shows the question to the person in its own UI and
// returns their answer, so the model never answers for the owner. Hosts without elicitation get
// { action: "unsupported" } and the caller keeps the item queued.

const NOTE_LIMIT = 500

export function createOwnerAsk(server) {
  return async function askOwner({ message, choices, note = true }) {
    if (!server.getClientCapabilities()?.elicitation) return { action: "unsupported" }
    const properties = {
      decision: { type: "string", title: "Decision", oneOf: choices.map(({ value, title }) => ({ const: value, title })) },
      ...(note ? { note: { type: "string", title: "Note for the agent (optional)", maxLength: NOTE_LIMIT } } : {}),
    }
    let reply
    try {
      reply = await server.elicitInput({ mode: "form", message, requestedSchema: { type: "object", properties, required: ["decision"] } })
    } catch {
      return { action: "unsupported" }
    }
    if (reply.action !== "accept") return { action: reply.action }
    const decision = reply.content?.decision
    if (!choices.some((choice) => choice.value === decision)) return { action: "decline" }
    const text = typeof reply.content?.note === "string" ? reply.content.note.trim().slice(0, NOTE_LIMIT) : ""
    return { action: "accept", decision, ...(text ? { note: text } : {}) }
  }
}
