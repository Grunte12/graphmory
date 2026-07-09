# Decision: Agent Routing

**Synthetic demo note — not real operational memory.**

## Context

A multi-agent coding system needs to route tasks to the correct agent.
Routing mistakes waste tokens and produce lower-quality results.

## Decision

Route tasks by **user-visible artifact ownership**, not by file type.

- If the user can see, click, or interact with it → **designer** owns it.
- Backend, data, tests, config, and infrastructure → **fixer** owns it.
- Architecture, high-risk debugging, and correctness review → **oracle** owns it.
- External research and source-backed analysis → **librarian** owns it.

## Rationale

File-type routing breaks when a single feature spans frontend, backend, and tests.
Ownership by artifact keeps the human experience as the boundary.

## Scope

| Applies | Excludes |
|---|---|
| Task assignment in agent conversations | Internal library code not visible to users |
| Handoff policy | Build tooling ownership |

## Related

- [[Concepts/Memory Patch]]
- [[Project Overview]]
