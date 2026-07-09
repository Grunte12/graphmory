# Concept: Brain Brief

**Synthetic demo note — not real operational memory.**

## What It Is

A Brain Brief is the compact recall response from Memory Curator.
It provides just enough context for a lead agent to make informed decisions.

## Schema

```
{
  relevant_memory:   array    // Most relevant prior knowledge
  constraints:       array    // Rules that restrict future action
  watchouts:         array    // Risks, edge cases, gotchas
  note_paths:        array    // Paths to canonical notes
  direct_read_paths: array    // Paths recommended for full read
}
```

## When to Request

- Before non-trivial work where prior decisions could change the plan.
- When multiple agent sessions share the same memory workspace.
- When entering a domain that has prior Memory Patches.

## When Not to Request

- Trivial one-off edits with no memory relevance.
- When Memory Curator is not available in the current agent runtime.

## Related

- [[Memory Patch]] — The raw data that feeds into briefs.
- [[Project Overview]] — When to request recall.
