#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import http.server
import shutil
import socketserver
import threading
import time
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
VISUAL_DIR = ROOT / "visual"
CURRENT_DIR = VISUAL_DIR / "current"
BASELINE_DIR = VISUAL_DIR / "baseline"
DIFF_DIR = VISUAL_DIR / "diff"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


@contextlib.contextmanager
def run_server(port: int = 4173):
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    handler = lambda *a, **k: _QuietHandler(*a, directory=str(ROOT), **k)
    httpd = ReusableTCPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}/app/index.html"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=1)


SCENARIOS = {
    "stand": """
      const d = window.__dinoDebug;
      d.restart();
      d.setInput({up:false, down:false});
      d.setState({running:false, gameOver:false, score:0, tick:0});
      d.render();
    """,
    "run": """
      const d = window.__dinoDebug;
      d.restart();
      d.beginGame();
      d.setInput({up:false, down:false});
      for (let i = 0; i < 14; i += 1) d.update();
      d.render();
    """,
    "jump": """
      const d = window.__dinoDebug;
      d.restart();
      d.beginGame();
      d.jump();
      d.setInput({up:false, down:false});
      for (let i = 0; i < 8; i += 1) d.update();
      d.render();
    """,
    "duck": """
      const d = window.__dinoDebug;
      d.restart();
      d.beginGame();
      d.setInput({up:false, down:true});
      for (let i = 0; i < 4; i += 1) d.update();
      d.render();
    """,
}


def capture_scenes(url: str) -> None:
    CURRENT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 560})
        context.add_init_script(
            """
            let seed = 123456789;
            Math.random = () => {
              seed = (seed * 1664525 + 1013904223) >>> 0;
              return seed / 4294967296;
            };
            """
        )
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(250)

        for name, js in SCENARIOS.items():
            page.evaluate(js)
            page.wait_for_timeout(60)
            page.locator("#game").screenshot(path=str(CURRENT_DIR / f"{name}.png"))

        browser.close()


def _image_diff_ratio(img_a: Path, img_b: Path, diff_out: Path) -> float:
    a = Image.open(img_a).convert("RGBA")
    b = Image.open(img_b).convert("RGBA")
    if a.size != b.size:
        raise ValueError(f"size mismatch: {img_a.name} {a.size} != {b.size}")

    diff = ImageChops.difference(a, b)
    def threshold_fn(p):
        return 255 if int(p) > 18 else 0

    mask = diff.convert("L").point(threshold_fn)
    changed = int(mask.histogram()[255])

    ratio = changed / float(a.size[0] * a.size[1])

    if changed:
        marked = Image.new("RGBA", a.size, (0, 0, 0, 0))
        red = Image.new("RGBA", a.size, (255, 60, 60, 255))
        marked.paste(red, (0, 0), mask)
        marked.save(diff_out)
    elif diff_out.exists():
        diff_out.unlink()

    return ratio


def check_against_baseline(threshold: float) -> int:
    DIFF_DIR.mkdir(parents=True, exist_ok=True)
    failures = []

    for name in SCENARIOS:
        cur = CURRENT_DIR / f"{name}.png"
        base = BASELINE_DIR / f"{name}.png"
        if not cur.exists() or not base.exists():
            failures.append(f"missing image pair for {name}")
            continue
        ratio = _image_diff_ratio(base, cur, DIFF_DIR / f"{name}.png")
        if ratio > threshold:
            failures.append(f"{name}: diff ratio {ratio:.4%} > {threshold:.2%}")

    if failures:
        print("[FAIL] visual regression check")
        for row in failures:
            print(" -", row)
        print(f"Diff images: {DIFF_DIR}")
        return 1

    print("[PASS] visual regression check")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture and compare Dino visual scenes")
    parser.add_argument("--write-baseline", action="store_true", help="overwrite visual/baseline with current captures")
    parser.add_argument("--check", action="store_true", help="compare visual/current with visual/baseline")
    parser.add_argument("--threshold", type=float, default=0.0075, help="max changed-pixel ratio before fail (default: 0.0075)")
    args = parser.parse_args()

    if not args.write_baseline and not args.check:
        args.check = True

    with run_server() as url:
        capture_scenes(url)

    if args.write_baseline:
        BASELINE_DIR.mkdir(parents=True, exist_ok=True)
        for name in SCENARIOS:
            shutil.copy2(CURRENT_DIR / f"{name}.png", BASELINE_DIR / f"{name}.png")
        print(f"Baseline updated: {BASELINE_DIR}")

    if args.check:
        return check_against_baseline(args.threshold)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
