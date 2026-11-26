"""Give "Worth" in the logo's wordmark the app header's green → cyan → blue gradient.

The header writes "Track" plain and "Worth" with `from-accent-1 via-accent-2 to-accent-3`
(src/index.css). This recolours the green "Worth" in the logo master to match, keeping its
anti-aliased edges: each pixel's share of text colour (vs the navy tile) is measured from the
green channel and swapped for the gradient colour at that x.

Run once on the master, then regenerate everything (assets/branding/README.md). Running it again
does nothing, since the gradient is no longer the flat green it looks for.
Usage: python gradient_wordmark.py <logo.png in> <logo.png out>
"""
import sys

import numpy as np
from PIL import Image

STOPS = [(0.0, (0x10, 0xB9, 0x81)), (0.5, (0x06, 0xB6, 0xD4)), (1.0, (0x3B, 0x82, 0xF6))]
# Bounds of the wordmark line, and the flat green "Worth" is drawn in, as measured on the master.
TEXT_TOP, TEXT_BOTTOM = 850, 1000
WORTH_GREEN = np.array([20, 252, 160], dtype=float)


def gradient(t: np.ndarray) -> np.ndarray:
    xs = [s[0] for s in STOPS]
    return np.stack([np.interp(t, xs, [s[1][c] for s in STOPS]) for c in range(3)], axis=-1)


def main(src: str, dst: str) -> None:
    img = np.asarray(Image.open(src).convert("RGBA")).astype(float)
    band = img[TEXT_TOP:TEXT_BOTTOM]
    rgb = band[..., :3]
    # Green text: the green channel well above red. White "Track" and the navy tile fail this.
    is_green = (rgb[..., 1] - rgb[..., 0] > 60) & (rgb[..., 1] > 60)
    # Columns with real letter strokes (ignores stray greenish pixels in the tile's texture).
    cols = np.where(is_green.sum(axis=0) >= 5)[0]
    if cols.size == 0:
        sys.exit("No green wordmark found (already converted?).")
    left, right = cols.min(), cols.max()
    navy = np.median(rgb[~is_green & (rgb.max(axis=-1) < 60)], axis=0)
    # Text coverage per pixel, from the green channel between the navy tile and the text green.
    weight = np.clip((rgb[..., 1] - navy[1]) / (WORTH_GREEN[1] - navy[1]), 0, 1)
    weight[:, :left] = 0
    weight[:, right + 1:] = 0
    weight *= (rgb[..., 1] - rgb[..., 0] > 20)  # leave white "Track" alone
    t = np.clip((np.arange(band.shape[1]) - left) / max(right - left, 1), 0, 1)
    colour = np.broadcast_to(gradient(t)[None], rgb.shape)
    w = weight[..., None]
    # Only text pixels change: navy where the letter's edge lets the tile show, gradient elsewhere.
    band[..., :3] = np.where(w > 0, navy * (1 - w) + colour * w, rgb)
    img[TEXT_TOP:TEXT_BOTTOM] = band
    Image.fromarray(np.round(img).astype("uint8"), "RGBA").save(dst, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
