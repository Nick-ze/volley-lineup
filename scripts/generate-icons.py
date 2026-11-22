#!/usr/bin/env python3
"""Generate the app icons from the owner's ball (docs/PLAN.md §31.3, DECISIONS #192).

Source: assets/source/app-icon-source.png (black ball with splash on a transparent background).
Output (all in assets/images/, overwritten):
  icon.png                     1024², the ball centred on the app orange with margins
  android-icon-foreground.png  1024², transparent, the ball inside the adaptive-icon safe zone
  android-icon-background.png  1024², solid app orange
  android-icon-monochrome.png  1024², the ball's shape (white, alpha = shape) inside the safe zone
  splash-icon.png              512², the ball on transparent (app.json sets the orange background)
  favicon.png                  64², the ball on the app orange

Run from the repository root (needs Pillow: `pip install pillow`):
  python3 scripts/generate-icons.py
Never hand-edit the generated images; change this script or the source and run it again.
"""

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "source" / "app-icon-source.png"
OUT = ROOT / "assets" / "images"

ORANGE = (0xFF, 0x6B, 0x00, 255)  # the app orange (src/theme/colors.ts `primary`)
SIZE = 1024
# Android adaptive icons: the layer is 108 dp; only a centre circle of 66 dp diameter (the safe
# zone, about 61% of the size) is visible under every launcher mask.
SAFE_RADIUS = SIZE * 66 / 108 / 2


def load_source() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    return image.crop(image.getbbox())


def content_radius(image: Image.Image) -> float:
    """The distance from the image centre to its farthest visible pixel."""
    alpha = image.getchannel("A")
    width, height = image.size
    cx, cy = width / 2, height / 2
    pixels = alpha.load()
    radius = 0.0
    for y in range(height):
        for x in range(width):
            if pixels[x, y] > 8:
                radius = max(radius, math.hypot(x + 0.5 - cx, y + 0.5 - cy))
    return radius


def scaled(image: Image.Image, factor: float) -> Image.Image:
    width, height = image.size
    size = (max(1, round(width * factor)), max(1, round(height * factor)))
    return image.resize(size, Image.Resampling.LANCZOS)


def centred(canvas: Image.Image, image: Image.Image) -> Image.Image:
    x = (canvas.width - image.width) // 2
    y = (canvas.height - image.height) // 2
    canvas.alpha_composite(image, (x, y))
    return canvas


def fit(image: Image.Image, box: float) -> Image.Image:
    """Scale so the larger side is `box` px."""
    return scaled(image, box / max(image.size))


def on_orange(image: Image.Image, size: int, fill: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), ORANGE)
    return centred(canvas, fit(image, size * fill))


def main() -> None:
    ball = load_source()
    OUT.mkdir(parents=True, exist_ok=True)

    on_orange(ball, SIZE, 0.8).save(OUT / "icon.png", optimize=True)

    # Scale so every visible pixel lies inside the safe-zone circle.
    safe = scaled(ball, SAFE_RADIUS / content_radius(ball))
    centred(Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), safe).save(
        OUT / "android-icon-foreground.png", optimize=True
    )
    Image.new("RGB", (SIZE, SIZE), ORANGE[:3]).save(OUT / "android-icon-background.png", optimize=True)

    white = Image.new("RGBA", safe.size, (255, 255, 255, 255))
    white.putalpha(safe.getchannel("A"))
    centred(Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0)), white).save(
        OUT / "android-icon-monochrome.png", optimize=True
    )

    centred(Image.new("RGBA", (512, 512), (0, 0, 0, 0)), fit(ball, 512)).save(
        OUT / "splash-icon.png", optimize=True
    )

    on_orange(ball, 64, 0.86).save(OUT / "favicon.png", optimize=True)
    print(f"Icons written to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
