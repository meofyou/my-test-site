# Visual Validation

WSL from project root:

```bash
.venv/bin/python scripts/visual_verify.py --write-baseline
.venv/bin/python scripts/visual_verify.py --check
.venv/bin/python scripts/sprite_audit.py
```

Outputs:

- `visual/current/*.png`: latest captured scenes (`stand`, `run`, `jump`, `duck`)
- `visual/baseline/*.png`: approved reference scenes
- `visual/diff/*.png`: per-scene diff overlay on failure
- `visual/audit/*.png`: recolored sprite crops used by the game pipeline

Notes:

- `visual_verify.py` runs a local HTTP server, opens `app/index.html` in headless Chromium (Playwright), and captures deterministic scenes.
- `--check` fails if pixel-difference ratio is above threshold (`0.75%` default).
- If design changed intentionally, rerun `--write-baseline` first.
