# Concept: Memory Patch

**Synthetic demo note — not real operational memory.**

## What It Is

A Memory Patch is the smallest durable unit of learned knowledge.
It captures one claim, its evidence, its scope, and its lifecycle.

## Schema

```
{
  claim:            string   // The durable lesson
  why_it_matters:   string   // Impact on future work
  scope:            object   // applies / excludes lists
  provenance:       array    // evidence leading to this patch
  confidence:       string   // high, medium, low
  suggested_type:   string   // decision, policy, concept, etc.
  lifecycle:        object   // status, revalidate_when, supersedes
}
```

## Lifecycle

1. **Authored** — The lead agent writes the patch from verified evidence.
2. **Curated** — Memory Curator validates, deduplicates, links, and stores.
3. **Recalled** — Future sessions retrieve via Brain Brief.
4. **Superseded** — A newer patch replaces or refines the claim.

## Related

- [[Brain Brief]] — The recall contract.
- [[Project Overview]] — The harness pillars.
