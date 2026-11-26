"""Android launcher icons from the symbol (no wordmark).

Launchers crop adaptive icons to a circle or squircle, which cut the "TrackWorth" wordmark off at
both ends, and the name is shown under the icon anyway. So every Android icon uses the symbol:

- adaptive icon (API 26+): the chart and arrow, lifted off the symbol's navy tile, as the
  foreground, sized to Android's 66 dp safe zone, over the navy `ic_launcher_background` colour;
- legacy square and round icons: the symbol itself, and the chart on a navy circle.

Run after `apply_small_icons.py`. Writes to src-tauri/icons/android and to the generated Android
project (src-tauri/gen/android), which is what actually gets built. Requires Pillow + NumPy.
See assets/branding/README.md.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SYMBOL = ROOT / "assets" / "branding" / "trackworth-symbol.png"
TARGETS = [ROOT / "src-tauri" / "icons" / "android", ROOT / "src-tauri" / "gen" / "android" /
           "app" / "src" / "main" / "res"]
NAVY = (11, 27, 51, 255)  # ic_launcher_background (#0B1B33)
# Launcher icon size per density (dp x scale); the adaptive layer is 108 dp, the legacy icon 48 dp.
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
CHART_DP = 60  # chart width; keeps its corners inside the 66 dp safe circle

symbol = Image.open(SYMBOL).convert("RGBA")
pixels = np.asarray(symbol).astype(float)

# The chart and arrow are bright and the tile is dark navy, so brightness gives a clean,
# anti-aliased cut-out. The tile's faint top sheen stays below the threshold.
brightness = pixels[..., :3].max(axis=-1)
alpha = np.clip((brightness - 90) / 50, 0, 1) * (pixels[..., 3] / 255)
chart = symbol.copy()
chart.putalpha(Image.fromarray((alpha * 255).astype("uint8")))
chart = chart.crop(chart.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def chart_on(canvas_px: int, chart_px: int, background=None) -> Image.Image:
    """The chart, `chart_px` wide, centred on a transparent (or `background`) square."""
    canvas = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    if background is not None:
        canvas.paste(background, (0, 0), background)
    w = chart_px
    h = round(chart.height * w / chart.width)
    art = chart.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(art, ((canvas_px - w) // 2, (canvas_px - h) // 2))
    return canvas


def navy_circle(px: int) -> Image.Image:
    scale = 4  # draw large, then shrink, for a smooth edge
    big = Image.new("RGBA", (px * scale, px * scale), (0, 0, 0, 0))
    ImageDraw.Draw(big).ellipse((0, 0, px * scale - 1, px * scale - 1), fill=NAVY)
    return big.resize((px, px), Image.LANCZOS)


for target in TARGETS:
    for density, scale in DENSITIES.items():
        out = target / f"mipmap-{density}"
        fg_px, icon_px = round(108 * scale), round(48 * scale)
        chart_on(fg_px, round(CHART_DP * scale)).save(out / "ic_launcher_foreground.png",
                                                       optimize=True)
        symbol.resize((icon_px, icon_px), Image.LANCZOS).save(out / "ic_launcher.png",
                                                                optimize=True)
        chart_on(icon_px, round(icon_px * 0.66), navy_circle(icon_px)).save(
            out / "ic_launcher_round.png", optimize=True)

print("Android launcher icons now use the symbol.", file=sys.stderr)
