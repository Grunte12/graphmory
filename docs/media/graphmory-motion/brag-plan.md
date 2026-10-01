# Brag plan: Graphmory

## Product and audience
A shared Markdown memory for coding agents. The lead owns meaning, a small Curator reads and maintains notes, and local code handles retrieval and saved-state checks.

## Creative angle
Editorial systems film: off-white paper, dark type, orange paths. Show the actual concept using the repo's synthetic `visual-verification.md` / `report.json` demo. This is a conceptual diagram, not a graphical product screen or a quality benchmark.

## Hook and identity
Two agent workspaces connect to one linked Markdown graph. The graph carries the message; text is limited to short labels. Colors: background `#f5f5f5`, ink `#2d3142`, accent `#eb6c36`, secondary `#4f5d75`. Local sans and serif fonts, no redistributed system fonts.

## Storyboard — 20 seconds, 1920×1080, 30 fps

| Time | Visual action | Meaning |
| --- | --- | --- |
| 0–4s | Codex and OpenCode connect to a graph of project, decision, evidence and history nodes | Many agents share one Markdown memory |
| 4–10s | Query packets traverse Keyword, Semantic and Graph lanes; the selected original stays linked to `report.json` | Retrieval finds sources through complementary signals |
| 10–15s | Originals feed a small Curator; a Brain Brief returns to the lead while a citation line remains attached | The lead gets compact evidence with provenance |
| 15–20s | A lead-authored patch goes through prepare/edit/verify; the previous note fades but retains its replacement link; a receipt appears and another agent reads the current note | Checked updates preserve history and carry into later sessions |

The Curator prepares the checkpoint and edits; the CLI verifies the saved state. A receipt establishes saved structure, not semantic truth. Only illustrative supported meaning is shown. No performance scores or claims of superiority appear.

## Rendering and sound
The user approved the graphical direction and requested direct FFmpeg rendering. `work/render.py` draws deterministic native frames from `work/artwork.svg` using Pillow, then pipes them into FFmpeg. No browser or HyperFrames runtime is required. Two quiet CC0 accents accompany selection at 7.7s and receipt at 17.5s. No music, narration or claimed beat sync.

## Sources and delivery
Current Graphmory `README.md`, `docs/guides/demo-workflow.md`, `docs/guides/trial-mvp.md` and the editorial architecture diagram informed the film. The settled cited-Brief frame at 13.8s is the poster and replaces frame zero without adding time. Share copy is in `share-copy.txt`; media credits are in `CREDITS.md`.
