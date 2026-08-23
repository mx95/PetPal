#!/usr/bin/env python3
"""Crop individual NFC tag images from marketing/instagram/NFCFullpic.png."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'instagram' / 'NFCFullpic.png'
FINAL_DIR = Path(__file__).resolve().parent / 'final'
PREVIEW_DIR = Path(__file__).resolve().parent / 'preview'

OUT = 512
BG_RGB = (231, 229, 234)
COL_HALF_W = 72


def _fg_mask(arr: np.ndarray, threshold: float = 18) -> np.ndarray:
    bg = np.array(BG_RGB, dtype=float)
    dist = np.sqrt(((arr.astype(float) - bg) ** 2).sum(axis=2))
    return dist > threshold


def _white_runs(row: np.ndarray, min_w: int = 12, max_w: int = 45) -> list[tuple[int, int]]:
    white = (row[:, 0] > 245) & (row[:, 1] > 245) & (row[:, 2] > 245)
    runs: list[tuple[int, int]] = []
    in_run = False
    start = 0
    for x, is_white in enumerate(white):
        if is_white and not in_run:
            start = x
            in_run = True
        elif not is_white and in_run:
            if min_w <= x - start <= max_w:
                runs.append((start, x - 1))
            in_run = False
    if in_run and min_w <= len(white) - start <= max_w:
        runs.append((start, len(white) - 1))
    return runs


def _find_number_rows(arr: np.ndarray) -> list[int]:
    """Return y positions of the three inter-row number label bands."""
    hits: list[int] = []
    for y in range(480, 1060, 2):
        if len(_white_runs(arr[y])) >= 6:
            hits.append(y)

    if not hits:
        return [566, 822, 1052]

    # Merge nearby hits into bands separated by large vertical gaps (>40px).
    bands: list[list[int]] = [[hits[0]]]
    for y in hits[1:]:
        if y - bands[-1][-1] <= 40:
            bands[-1].append(y)
        else:
            bands.append([y])

    centers = [band[len(band) // 2] for band in bands[:3]]
    while len(centers) < 3:
        centers.append(centers[-1] + 256)
    return centers[:3]


def _column_centers(arr: np.ndarray, number_row_y: int) -> list[int]:
    runs = _white_runs(arr[number_row_y])
    if len(runs) >= 7:
        return [((a + b) // 2) for a, b in runs[:7]]

    w = arr.shape[1]
    return [int(w * (c + 0.5) / 7) for c in range(7)]


def detect_tag_boxes(im: Image.Image) -> dict[int, tuple[int, int, int, int]]:
    arr = np.array(im.convert('RGB'))
    w, h = arr.shape[:2]
    fg = _fg_mask(arr)

    num_rows = _find_number_rows(arr)
    col_centers = _column_centers(arr, num_rows[0])

    # Vertical bands: ring row → above numbers → below numbers.
    row_bands = [
        (338, num_rows[0] - 30),
        (num_rows[0] + 20, num_rows[1] - 14),
        (num_rows[1] + 36, num_rows[2] - 27),
    ]

    boxes: dict[int, tuple[int, int, int, int]] = {}
    for row_idx, (y0, y1) in enumerate(row_bands):
        y0 = max(0, y0)
        y1 = min(h - 1, y1)
        for col, cx in enumerate(col_centers):
            x0 = max(0, cx - COL_HALF_W)
            x1 = min(w, cx + COL_HALF_W)
            sub_fg = fg[y0:y1, x0:x1]
            ys, xs = np.where(sub_fg)
            if len(ys) == 0:
                continue
            tag_num = row_idx * 7 + col + 1
            boxes[tag_num] = (
                x0 + int(xs.min()),
                y0 + int(ys.min()),
                x0 + int(xs.max()),
                y0 + int(ys.max()),
            )
    return boxes


def crop_tag(im: Image.Image, box: tuple[int, int, int, int], pad: int = 6) -> Image.Image:
    left, top, right, bottom = box
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(im.width, right + pad)
    bottom = min(im.height, bottom + pad)

    crop = im.crop((left, top, right, bottom))
    cw, ch = crop.size
    side = max(cw, ch)
    scale = (OUT * 0.88) / side
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (OUT, OUT), (255, 255, 255, 255))
    if resized.mode == 'RGBA':
        canvas.paste(resized, ((OUT - nw) // 2, (OUT - nh) // 2), resized)
    else:
        canvas.paste(resized, ((OUT - nw) // 2, (OUT - nh) // 2))
    return canvas


def main() -> None:
    im = Image.open(SRC).convert('RGBA')
    boxes = detect_tag_boxes(im)
    if len(boxes) != 21:
        raise SystemExit(f'Expected 21 tag boxes, found {len(boxes)}')

    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    overlay = im.copy().convert('RGB')
    draw = ImageDraw.Draw(overlay)
    crops: list[Image.Image] = []

    for idx in range(1, 22):
        box = boxes[idx]
        draw.rectangle(box, outline=(34, 197, 94), width=2)
        draw.text((box[0] + 4, box[1] + 4), str(idx), fill=(34, 197, 94))
        out = crop_tag(im, box)
        out.save(FINAL_DIR / f'nfc-tag-{idx:02d}.png', optimize=True)
        crops.append(out)

    overlay.save(PREVIEW_DIR / 'crop-boxes.png')

    thumb = 190
    sheet = Image.new('RGBA', (thumb * 7 + 30, thumb * 3 + 50), (248, 250, 252, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 10), 'NFC catalog crops (21 tags)', fill=(15, 23, 42, 255))
    for i, img in enumerate(crops):
        row, col = divmod(i, 7)
        t = img.copy()
        t.thumbnail((thumb - 6, thumb - 18), Image.Resampling.LANCZOS)
        sheet.paste(
            t,
            (15 + col * thumb + (thumb - t.size[0]) // 2, 35 + row * thumb + (thumb - t.size[1]) // 2),
            t,
        )
        draw.text((20 + col * thumb, 35 + row * thumb + thumb - 18), str(i + 1), fill=(100, 116, 139, 255))
    sheet.save(PREVIEW_DIR / 'contact-sheet.png')
    print(f'Wrote {len(crops)} crops to {FINAL_DIR}')


if __name__ == '__main__':
    main()
