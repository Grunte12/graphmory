# Learning Loop

Memory Patch Harness treats durable memory as the result of a verified loop, not a running diary.

The loop is:

```text
recall relevant memory
  -> act on the task
  -> verify the result
  -> produce a Learning Packet only if future behavior should change
  -> curate and link without inventing missing facts
  -> evaluate whether future decisions improve
```

## Learning Packet

A Learning Packet is stricter than the earlier Memory Patch contract. It requires:

- the lesson,
- the trigger that made the lesson worth remembering,
- optional structured selectors for retrieval and routing,
- the future behavior change,
- bounded scope,
- evidence,
- verification status and result,
- loop trace,
- memory action,
- confidence,
- lifecycle and revalidation triggers.

The purpose is to prevent two failure modes:

1. Saving routine summaries that do not change future behavior.
2. Saving unverified reflections as if they were durable lessons.

## Relationship To Existing Contracts

Memory Patch remains a compact compatibility contract.

Learning Packet is the v0.3 loop-engineered contract for higher-confidence memory updates. A project can adopt it gradually:

```text
low-risk/simple memory -> Memory Patch
behavior-changing lesson -> Learning Packet
```

## Evaluation

Run:

```sh
npm run eval:learning-loop
npm run eval:future-task
```

The included learning-loop comparison scores a v0.2-style Memory Patch candidate against a v0.3 Learning Packet candidate. It also reports payload bytes, characters, estimated tokens, evidence count, selector count, and score-per-token delta. The point is not to declare universal superiority. The point is to show what extra structure the loop adds:

- explicit verification,
- future behavior change,
- phase trace,
- evidence separation,
- structured selectors,
- lifecycle gate.

The future-task eval adds a cheap downstream utility check: given a later task, does the saved memory cause the right decision, avoid stale trust, and reject diary/noise saves?

Each candidate can also set `expected_max_estimated_tokens`. This keeps the contract honest: a better packet should not pass if it becomes too expensive to use.
