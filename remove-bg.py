"""Remove black background from neon logo, preserving glow alpha."""
from pathlib import Path

from PIL import Image

SRC = Path("photo_2026-06-01_00-18-55.jpg")
OUT = Path("assets/chamelion-logo.png")

img = Image.open(SRC).convert("RGBA")
pixels = img.load()
width, height = img.size

for y in range(height):
    for x in range(width):
        r, g, b, _ = pixels[x, y]
        luminance = max(r, g, b)
        # Keep glow edges; fade dark pixels to transparent.
        if luminance < 8:
            alpha = 0
        elif luminance < 40:
            alpha = int((luminance - 8) * (255 / 32))
        else:
            alpha = min(255, int(luminance * 1.15))

        pixels[x, y] = (r, g, b, alpha)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print(f"Saved {OUT} ({width}x{height})")
