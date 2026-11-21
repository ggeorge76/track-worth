"""Build a wordmark-free TrackWorth symbol from the master logo."""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
orig = np.asarray(Image.open(src).convert("RGBA")).astype(np.float64)
H, W = orig.shape[:2]

# 1. Clean background: interpolate each column between a clean row above the chart
#    and a clean row below the wordmark (the square's sides are straight in this band).
top, bot = 215, 1015

def clean_row(y):
    """Row colours with transparent corner pixels filled from the nearest opaque pixel, smoothed."""
    rgb = orig[y, :, :3].copy()
    valid = np.where(orig[y, :, 3] > 250)[0]
    rgb[: valid[0]] = rgb[valid[0]]
    rgb[valid[-1] + 1 :] = rgb[valid[-1]]
    k = np.ones(41) / 41
    padded = np.pad(rgb, ((20, 20), (0, 0)), mode="edge")
    return np.stack([np.convolve(padded[:, c], k, mode="valid") for c in range(3)], axis=1)

ref_top, ref_bot = clean_row(top), clean_row(bot)
bg = orig.copy()
t = (np.arange(top, bot + 1) - top) / (bot - top)
bg[top : bot + 1, :, :3] = (1 - t)[:, None, None] * ref_top[None] + t[:, None, None] * ref_bot[None]
# Alpha (the rounded-square shape) is left exactly as in the original.

# 2. Chart layer: pixels that differ from the clean background (keeps soft shadows).
x0, x1, y0, y1 = 300, 1020, 230, 815
crop = orig[y0:y1, x0:x1]
diff = np.abs(crop[..., :3] - bg[y0:y1, x0:x1, :3]).sum(axis=2)
alpha = np.clip(diff / 45.0, 0, 1)
layer = np.dstack([crop[..., :3], alpha * 255]).astype(np.uint8)

# 3. Scale up a little and centre the chart's visual bbox in the square.
scale = 1.15
lw, lh = int((x1 - x0) * scale), int((y1 - y0) * scale)
layer_img = Image.fromarray(layer, "RGBA").resize((lw, lh), Image.LANCZOS)
chart_cx, chart_cy = (321 + 998) / 2 - x0, (247 + 791) / 2 - y0  # bright-content centre in crop
square_cx, square_cy = (84 + 1170) / 2, (87 + 1165) / 2
px = round(square_cx - chart_cx * scale)
py = round(square_cy - chart_cy * scale)

base = Image.fromarray(bg.astype(np.uint8), "RGBA")
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
canvas.paste(layer_img, (px, py), layer_img)
# Composite chart over background, keeping the background's alpha (rounded corners).
result = Image.alpha_composite(base, canvas)
res = np.asarray(result).copy()
res[..., 3] = orig[..., 3].astype(np.uint8)
# Edge and transparent pixels keep the original RGB: correct anti-aliasing, no colour bleed when downscaled.
transparent = orig[..., 3] < 250  # anti-aliased edge + fully transparent pixels
res[transparent, :3] = orig[transparent, :3].astype(np.uint8)
Image.fromarray(res, "RGBA").save(out, optimize=True)
print("pasted at", px, py, "size", lw, lh)
