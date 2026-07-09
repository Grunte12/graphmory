# PARA Methodology Example

PARA stands for **Projects, Areas, Resources, Archives** (by Tiago Forte).
It organizes notes by actionability: from active projects to reference material.

## Layout

```
vault/
├── source-map.md
└── notes/
    ├── 01 Projects/
    │   ├── Redesign landing page.md
    │   └── API migration v2.md
    ├── 02 Areas/
    │   ├── DevOps operations.md
    │   └── Documentation standards.md
    ├── 03 Resources/
    │   ├── TypeScript patterns.md
    │   └── Agent tooling research.md
    └── 04 Archives/
        ├── Legacy auth system.md
        └── Deprecated build pipeline.md
```

## Category Definitions

| Category | Includes | Lifecycle |
|---|---|---|
| **01 Projects** | Short-term outcomes with deadlines | Active until delivered or cancelled |
| **02 Areas** | Ongoing responsibilities without end dates | Continuous — revalidate periodically |
| **03 Resources** | Reference topics, research, tutorials | Active indefinitely; prune stale entries |
| **04 Archives** | Completed or inactive items from other categories | Frozen — do not edit; preserve for history |

## Memory Patch Guidance

- Patches about active projects and decisions belong in **01 Projects** or **02 Areas**.
- Research-backed concepts belong in **03 Resources**.
- When a project completes, move its relevant Memory Patches to **04 Archives**
  and update the lifecycle status.

## Reference

- Tiago Forte, *Building a Second Brain* (Atria Books, 2022)
- https://fortelabs.com/blog/para/
