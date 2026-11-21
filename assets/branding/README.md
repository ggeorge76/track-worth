# Branding

Two master images, both 1254×1254 with a transparent background:

- `trackworth-logo.png` is the **full logo** (chart + "TrackWorth" wordmark), used at sizes
  above 48 px.
- `trackworth-symbol.png` is the **symbol only** (chart + arrow, no wordmark), used at **48 px
  and below**, where the wordmark is unreadable. It is generated from the logo by
  `scripts/branding/make_symbol.py`.

Never edit the derived files by hand. Regenerate them.

| File                                | Use                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `trackworth-logo-120.png`           | Google OAuth consent screen app logo (Google requires 120×120 px, under 1 MB).                             |
| `png/trackworth-logo-<size>.png`    | Full logo, 64–1024 px                                                                                      |
| `png/trackworth-symbol-<size>.png`  | Symbol, 16–48 px                                                                                           |
| `../../public/logo.png`             | Sign-in screen logo (256 px, shown at 128 CSS px)                                                          |
| `../../public/symbol.png`           | Header logo (128 px, shown at 28 CSS px)                                                                   |
| `../../public/favicon-32.png`       | Favicon (symbol)                                                                                           |
| `../../public/apple-touch-icon.png` | 180 px touch icon                                                                                          |
| `../../src-tauri/icons/`            | Desktop and Android app icons. Sizes ≤ 48 px (including inside `icon.ico` and `icon.icns`) use the symbol. |

## Regenerating after a logo change

Needs Pillow + NumPy (a throwaway virtualenv is fine) and, for `.icns`, macOS `iconutil`:

```bash
python3 -m venv /tmp/branding-env && /tmp/branding-env/bin/pip install pillow numpy

# 1. Symbol master (the script's crop coordinates assume the current logo layout;
#    re-measure them if the artwork moves)
/tmp/branding-env/bin/python scripts/branding/make_symbol.py \
  assets/branding/trackworth-logo.png assets/branding/trackworth-symbol.png

# 2. Full-logo exports
for s in 64 120 128 180 192 256 512 1024; do
  sips -s format png -z $s $s assets/branding/trackworth-logo.png \
    --out assets/branding/png/trackworth-logo-$s.png
done
cp assets/branding/png/trackworth-logo-120.png assets/branding/trackworth-logo-120.png
cp assets/branding/png/trackworth-logo-180.png public/apple-touch-icon.png
cp assets/branding/png/trackworth-logo-256.png public/logo.png

# 3. App icons: full logo everywhere, then swap in the symbol for sizes <= 48 px
bunx tauri icon assets/branding/trackworth-logo.png && rm -rf src-tauri/icons/ios
/tmp/branding-env/bin/python scripts/branding/apply_small_icons.py
```
