"""Reduces the PNG icons in public/icons to a 32-colour palette (they are flat blue and white).

    python scripts/shrink-icons.py        (needs Pillow; run after scripts/make-icons.mjs)

The browser fetches the 192 px icon when the page loads, so its size is paid by everybody:
7 KB became 2 KB with no visible change.
"""

from pathlib import Path

from PIL import Image

for icon in sorted(Path(__file__).resolve().parent.parent.joinpath("public/icons").glob("*.png")):
    picture = Image.open(icon).convert("RGBA")
    picture.quantize(colors=32, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
        icon, optimize=True
    )
    print(f"{icon.name}: {icon.stat().st_size} bytes")
