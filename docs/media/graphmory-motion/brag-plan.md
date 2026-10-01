# Brag Plan: Graphmory

## What is this app?
Graphmory is an evidence-informed memory layer for coding agents: its local CLI combines keyword, semantic, and authored graph retrieval over Markdown notes, while a named Curator reads originals and manages supported, checked updates.

## The angle
Show memory as a shared, inspectable place that agents can return to. The video follows one concrete question through three local retrieval lanes, back to a canonical note and its evidence, then through a checkpointed update that a later agent can read. This is a conceptual visualization of a CLI/Markdown workflow, not a recording of a graphical app.

## Hook (first 2–3 seconds)
Two small agent workspaces pull linked notes into one paper-colored Markdown graph. The frame begins in motion; the central graph is the visual hook, with “One brain. Many agents.” as a compact label rather than a full-screen title.

## Key moments (the middle)
- A query pulse travels through separate Keyword, Semantic, and Authored graph lanes; the active path resolves to `notes/visual-verification.md` and retains a source link to `.opencode/visual-qa/2026-06-27/report.json`.
- The local CLI hands a bounded source set to “Curator · hosted model.” The original note stays visibly attached as the Curator forms a short Brain Brief with its cited path.
- The lead authors a Memory Patch. The Curator prepares a checkpoint and edits the supported Markdown target; the CLI verifies saved state and lifecycle checks before issuing a receipt. The prior note remains faded and linked as superseded; a later agent reads the current state.

## Outro / punchline
The network settles into a single linked note path. “Graphmory” and “Evidence-informed memory for coding agents.” land over the graph; the final small label is “A later session starts with the updated note.”

## User flow worth showing
Ask a narrow question → locally find and read the relevant original note with its evidence path → return a cited Brain Brief to the lead. For a meaningful update, the lead authors the Memory Patch, the Curator prepares a checkpoint and applies the supported edit, then the CLI verifies saved state and lifecycle checks before issuing a receipt for a later agent.

## Tone
- Preset: polished
- Creative direction: editorial systems film; warm paper, precise ink lines, one orange query path
- Interpretation: keep copy concise and calm while the graph, linked note cards, source traces, and lifecycle state carry the story through deliberate continuous motion.

## Format: landscape — 1920x1080
## Duration: 20 seconds

## Visual identity
- Background: `#f5f5f5` paper
- Accent: `#eb6c36` orange
- Text: `#2d3142` ink
- Secondary: `#4f5d75` muted
- Display font: local editorial serif if available; otherwise the shipped serif fallback
- Body font: shipped local sans if available; otherwise system sans
- Strongest visual element: a linked Markdown note graph that shifts between retrieval, evidence, and lifecycle states.

## Share copy (draft)
Graphmory gives coding agents a shared, linked Markdown memory: retrieve the original note, keep its evidence in view, and carry checked updates into the next session.

## Audio direction
- Role: intentional silence beneath the graphic, with a few quiet motion-matched accents.
- Music: none; the bundled vol. 12 file’s per-track license was not verified for this preview.
- Music treatment: not applicable.
- Music cue guidance: not applicable.
- Audio-reactive treatment: none.
- SFX posture: sparse, low-risk, CC0 Kenney accents only; one soft selection and one restrained saved-receipt accent.
- Audio-coupled moments: retrieval selection, Brief landing, receipt state.
- Restraint rule: no typing ticks, no strobing, and no sound that makes a check/receipt imply factual proof.

## Storyboard

### Scene 1 — Shared brain — 0–4s
An editorial Markdown graph fills most of the frame. Two labeled agent workspaces, Coding agents, connect into the same linked note field. A few node labels establish real note-like structure; a small “Conceptual flow” tag distinguishes the visualization from an actual UI. Compact copy: “One brain. Many agents.”
Sequential/interaction: yes — agent cards arrive one after another and their fine links draw into the graph; then the canonical Markdown node settles.
Audio intent: quiet opening; a low-risk soft impact marks the shared graph settling.
Audio-coupled idea: the soft impact lands as the central note graph resolves.
Transition mood: continuous camera push into the query path → Scene 2.

### Scene 2 — Find the source — 4–10s
A single query pulse moves through three distinct lanes labeled “Keyword,” “Semantic,” and “Authored graph.” Lane trails meet at a small set of candidate nodes. The camera follows one selected original note card, `notes/visual-verification.md`, with a visible source glyph/link to `.opencode/visual-qa/2026-06-27/report.json`; unrelated nodes remain in the graph. A small caption reads “Local retrieval · original Markdown.”
Sequential/interaction: yes — the pulse traces each lane in turn, then selects the linked note; labels reveal together and hold for reading.
Audio intent: restrained, tactile selection accent as the source path resolves.
Audio-coupled idea: the selection lands near 8.74s; the source link stays visible after it lands.
Transition mood: note follows the same graph edge into a brief card → Scene 3.

### Scene 3 — Brief to lead — 10–15s
The selected original note remains anchored while a smaller Curator node is labeled “hosted model.” It assembles one compact Brain Brief card from the read note and evidence link; the card returns to a Lead node. The source path remains attached to the brief. This shows a bounded read and cited return, not a dump of the whole vault.
Sequential/interaction: yes — original note, Curator, Brief, and Lead illuminate in causal order; the brief holds long enough to read.
Audio intent: remain sparse and quiet; let the source path and brief card land without an added cue.
Audio-coupled idea: keep the source path onscreen through the hold.
Transition mood: follow the brief’s single authored update back to its note → Scene 4.

### Scene 4 — Checked update, shared forward — 15–20s
The update sequence appears as three compact labels: “Prepare checkpoint” → “Edit” → “Lifecycle checks.” The old note shifts to muted ink but stays connected with a `superseded by` link; the new active note takes its place. A small saved-receipt mark appears beside it. A second agent arrives with “Later session” and reads the active note. Finish on the connected graph with “Graphmory” and “Evidence-informed memory for coding agents.” No claim that a receipt proves the claim true.
Sequential/interaction: yes — checkpoint, edit, lifecycle checks, receipt, then the later agent’s read appear in order.
Audio intent: a quiet receipt accent marks the saved state; the closing graph holds in silence.
Audio-coupled idea: receipt accent lands with the saved state; final Graphmory lockup holds through 20s.
Transition mood: gentle settle to the final lockup.

**Music mood for this video:** intentionally silent.
**Audio summary:** sparse CC0 accents mark the source selection and saved receipt; the graph choreography carries the rest.

## Source grounding
- `outputs/graphmory/README.md`
- `outputs/graphmory/docs/guides/demo-workflow.md`
- `outputs/graphmory/docs/guides/trial-mvp.md`
- Keep the selected note and evidence path exactly as in the demo example. All panels are conceptual diagrams; do not invent benchmark figures or imply a screenshot of Graphmory’s CLI.

## Official-logo revision
Scene 1 shows authentic Cursor, Codex, OpenCode and Antigravity logos connected to one Markdown graph. A separate DeepSeek badge identifies a model/provider example. Illustrative host names are not a claim of tested integration: native acceptance covers Codex and OpenCode. Actions, note relationships, retrieval paths and lifecycle transitions use original animated line artwork.
