#!/usr/bin/env python3
"""Crop individual NFC tag images from marketing/instagram/NFCFullpic.png."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'instagram' / 'NFCFullpic.png'
FINAL_DIR = Path(__file__).resolve().parent / 'final'
PREVIEW_DIR = Path(__file__).resolve().parent / 'preview'

GRID = {'left': 78, 'top': 248, 'right': 1176, 'bottom': 1055, 'cols': 7, 'rows': 3}
ROW_PAD = [
    {'top': 0.06, 'bottom': 0.16, 'x': 0.07},
    {'top': 0.11, 'bottom': 0.17, 'x': 0.07},
    {'top': 0.17, 'bottom': 0.14, 'x': 0.06},
]
OUT = 512


def main() -> None:
    im = Image.open(SRC).convert('RGBA')
    cell_w = (GRID['right'] - GRID['left']) / GRID['cols']
    cell_h = (GRID['bottom'] - GRID['top']) / GRID['rows']
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    crops = []

    for r in range(GRID['rows']):
        pad = ROW_PAD[r]
        for c in range(GRID['cols']):
            idx = r * GRID['cols'] + c + 1
            x0 = GRID['left'] + c * cell_w
            y0 = GRID['top'] + r * cell_h
            cx0 = int(x0 + cell_w * pad['x'])
            cy0 = int(y0 + cell_h * pad['top'])
            cx1 = int(x0 + cell_w * (1 - pad['x']))
            cy1 = int(y0 + cell_h * (1 - pad['bottom']))
            if idx in (7, 19):
                cy1 = int(y0 + cell_h * (1 - 0.12))
            if idx == 19:
                cx0 = int(x0 + cell_w * 0.03)
                cx1 = int(x0 + cell_w * 0.97)
            crop = im.crop((cx0, cy0, cx1, cy1))
            cw, ch = crop.size
            scale = min((OUT * 0.90) / cw, (OUT * 0.90) / ch)
            nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
            resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (OUT, OUT), (255, 255, 255, 255))
            canvas.paste(resized, ((OUT - nw) // 2, (OUT - nh) // 2))
            canvas.save(FINAL_DIR / f'nfc-tag-{idx:02d}.png', optimize=True)
            crops.append(canvas)

    thumb = 180
    sheet = Image.new('RGBA', (thumb * 7 + 40, thumb * 3 + 60), (245, 247, 250, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 10), 'NFC catalog crops (21 tags)', fill=(15, 23, 42, 255))
    for i, img in enumerate(crops):
        row, col = divmod(i, 7)
        t = img.copy()
        t.thumbnail((thumb - 8, thumb - 20), Image.Resampling.LANCZOS)
        sheet.paste(
            t,
            (20 + col * thumb + (thumb - t.size[0]) // 2, 36 + row * thumb + (thumb - t.size[1]) // 2),
            t,
        )
        draw.text((24 + col * thumb, 36 + row * thumb + thumb - 18), str(i + 1), fill=(100, 116, 139, 255))
    sheet.save(PREVIEW_DIR / 'contact-sheet.png')
    print(f'Wrote {len(crops)} crops to {FINAL_DIR}')


if __name__ == '__main__':
    main()
