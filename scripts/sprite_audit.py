#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import cast

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "app" / "img" / "offline-sprite-1x.png"
OUT = ROOT / "visual" / "audit"


FRAMES = {
    "stand": (677, 2, 44, 47),
    "run1": (677, 2, 44, 47),
    "run2": (721, 2, 44, 47),
    "duck": (1011, 20, 59, 29),
}


def recolor_like_game(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    out_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for y in range(img.height):
        for x in range(img.width):
            pixel = cast(tuple[int, int, int, int], img.getpixel((x, y)))
            r, g, b, a = pixel
            if a == 0:
                continue

            bright = (r + g + b) / 3
            if bright > 200:
                continue

            if bright < 95:
                out_img.putpixel((x, y), (23, 108, 64, 255))
            else:
                out_img.putpixel((x, y), (31, 158, 90, 255))

    return out_img


def main() -> int:
    if not SRC.exists():
        print(f"[FAIL] missing sprite: {SRC}")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")

    print("[INFO] frame audit")
    fail = False
    for name, (x, y, w, h) in FRAMES.items():
        crop = src.crop((x, y, x + w, y + h))
        recolored = recolor_like_game(crop)
        recolored.save(OUT / f"{name}.png")

        opaque = 0
        bright_white = 0
        for yy in range(recolored.height):
            for xx in range(recolored.width):
                pixel = cast(tuple[int, int, int, int], recolored.getpixel((xx, yy)))
                r, g, b, a = pixel
                if a == 0:
                    continue
                opaque += 1
                if r > 220 and g > 220 and b > 220:
                    bright_white += 1

        ratio = 0.0 if opaque == 0 else bright_white / opaque
        print(f" - {name}: opaque={opaque}, white={bright_white}, ratio={ratio:.4%}")
        if ratio > 0.0:
            fail = True

    if fail:
        print(f"[FAIL] white pixels remain after recolor. inspect: {OUT}")
        return 1

    print(f"[PASS] sprite recolor audit ok. outputs: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
