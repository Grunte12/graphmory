# Graphmory motion graphic — direct FFmpeg

20 seconds · 1920×1080 · 30 fps · H.264/AAC.

The brag storyboard guides the concept. Python/Pillow draws deterministic native frames from the included SVG artwork; FFmpeg encodes the frames and mixes two quiet CC0 sound accents. No browser or HyperFrames runtime is required.

Requires Python 3, Pillow and FFmpeg. On this Mac:

```sh
python3 work/render.py --proof
python3 work/render.py
```

For another machine, pass two installed local font files:

```sh
python3 work/render.py --font-sans /path/to/sans.ttf --font-serif /path/to/serif.ttf
```

`--proof` captures every scene and transition. The MP4's first frame is replaced by the settled poster at 13.8 seconds, preserving exactly 600 frames and 20-second timing. Source geometry is a conceptual visualization of the CLI/Markdown workflow, not a recording of a Graphmory GUI.

See [credits](CREDITS.md), [storyboard](brag-plan.md) and [share copy](share-copy.txt).

Official platform logos illustrate host examples; actions use original line animation. See [CREDITS.md](CREDITS.md) for provenance and tested-host boundaries.
