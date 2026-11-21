"""Use the wordmark-free symbol for every icon of 48 px and below.

Run after `bunx tauri icon assets/branding/trackworth-logo.png` (which writes the full logo at
every size). Requires Pillow + NumPy and macOS `iconutil`. See assets/branding/README.md.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRANDING = ROOT / "assets" / "branding"
ICONS = ROOT / "src-tauri" / "icons"
PUBLIC = ROOT / "public"
SMALL_MAX = 48

logo = Image.open(BRANDING / "trackworth-logo.png").convert("RGBA")
symbol = Image.open(BRANDING / "trackworth-symbol.png").convert("RGBA")


def sized(src: Image.Image, px: int) -> Image.Image:
    return src.resize((px, px), Image.LANCZOS)


def pick(px: int) -> Image.Image:
    return sized(symbol if px <= SMALL_MAX else logo, px)


# 1. Branding exports: symbol for small sizes, full logo above.
png_dir = BRANDING / "png"
for px in (16, 24, 32, 48):
    sized(symbol, px).save(png_dir / f"trackworth-symbol-{px}.png", optimize=True)
    (png_dir / f"trackworth-logo-{px}.png").unlink(missing_ok=True)

# 2. UI assets.
sized(symbol, 32).save(PUBLIC / "favicon-32.png", optimize=True)
sized(symbol, 128).save(PUBLIC / "symbol.png", optimize=True)  # header, shown at 28 CSS px

# 3. Plain PNG app icons at or below 48 px.
for name, px in {"32x32.png": 32, "Square30x30Logo.png": 30, "Square44x44Logo.png": 44}.items():
    sized(symbol, px).save(ICONS / name, optimize=True)

mdpi = ICONS / "android" / "mipmap-mdpi"
sized(symbol, 48).save(mdpi / "ic_launcher.png", optimize=True)
# Round launcher: keep Tauri's circular mask, swap the artwork.
round_mask = Image.open(mdpi / "ic_launcher_round.png").convert("RGBA").getchannel("A")
round_icon = sized(symbol, 48)
round_icon.putalpha(
    Image.fromarray(np.minimum(np.asarray(round_icon.getchannel("A")), np.asarray(round_mask)))
)
round_icon.save(mdpi / "ic_launcher_round.png", optimize=True)

# 4. Windows .ico: one image per size, each from the right source.
ico_sizes = [16, 24, 32, 48, 64, 256]
frames = [pick(px) for px in ico_sizes]
frames[-1].save(ICONS / "icon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes],
                append_images=frames[:-1])

# 5. macOS .icns via iconutil (pixel sizes: name@2x is double the point size).
icns_entries = {
    "icon_16x16.png": 16, "icon_16x16@2x.png": 32, "icon_32x32.png": 32, "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128, "icon_128x128@2x.png": 256, "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512, "icon_512x512.png": 512, "icon_512x512@2x.png": 1024,
}
with tempfile.TemporaryDirectory() as tmp:
    iconset = Path(tmp) / "icon.iconset"
    iconset.mkdir()
    for name, px in icns_entries.items():
        pick(px).save(iconset / name)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS / "icon.icns")],
                   check=True)

print("Small icons (<= 48 px) now use the symbol.", file=sys.stderr)
