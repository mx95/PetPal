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
COL_HALF_W = (86, 86, 90)  # row 3 uses column gutters to avoid neighbor bleed
GUTTER_INSET = 4
ROW_BANDS = ((328, 562), (608, 816), (858, 1035))
ROW_BOTTOM_MAX = (558, 810, 1020)


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


def _column_centers(arr: np.ndarray) -> list[int]:
    hits: list[int] = []
    for y in range(480, 1060, 2):
        if len(_white_runs(arr[y])) >= 6:
            hits.append(y)
    if not hits:
        w = arr.shape[1]
        return [int(w * (c + 0.5) / 7) for c in range(7)]

    bands: list[list[int]] = [[hits[0]]]
    for y in hits[1:]:
        if y - bands[-1][-1] <= 40:
            bands[-1].append(y)
        else:
            bands.append([y])

    center_y = bands[0][len(bands[0]) // 2]
    runs = _white_runs(arr[center_y])
    if len(runs) >= 7:
        return [((a + b) // 2) for a, b in runs[:7]]

    w = arr.shape[1]
    return [int(w * (c + 0.5) / 7) for c in range(7)]


def _strip_number_disc(arr: np.ndarray, fg: np.ndarray, box: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    """Drop the catalog number circle if it was captured at the bottom of a box."""
    left, top, right, bottom = box
    cx = (left + right) // 2
    scan_top = max(top, bottom - 36)
    for y in range(bottom, scan_top, -1):
        row = arr[y, left:right + 1]
        fg_count = fg[y, left:right + 1].sum()
        white = ((row[:, 0] > 240) & (row[:, 1] > 240) & (row[:, 2] > 240)).sum()
        width = right - left + 1
        if fg_count < 40 and white > width * 0.18:
            bottom = y - 1
            continue
        if fg_count > 60:
            break
    return left, top, right, bottom


def _flood_bbox(
    fg: np.ndarray,
    y0: int,
    y1: int,
    x0: int,
    x1: int,
    seed_x: int,
    seed_y: int,
) -> tuple[int, int, int, int] | None:
    from collections import deque

    sub = fg[y0:y1, x0:x1]
    h, w = sub.shape
    sx, sy = seed_x - x0, seed_y - y0
    if not (0 <= sx < w and 0 <= sy < h and sub[sy, sx]):
        ys, xs = np.where(sub)
        if len(ys) == 0:
            return None
        dist = (ys - sy) ** 2 + (xs - sx) ** 2
        idx = int(dist.argmin())
        sy, sx = int(ys[idx]), int(xs[idx])

    visited = np.zeros(sub.shape, bool)
    queue: deque[tuple[int, int]] = deque([(sy, sx)])
    visited[sy, sx] = True
    min_y = max_y = sy
    min_x = max_x = sx

    while queue:
        y, x = queue.popleft()
        min_y, max_y = min(min_y, y), max(max_y, y)
        min_x, max_x = min(min_x, x), max(max_x, x)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and sub[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    if max_y - min_y < 8 or max_x - min_x < 8:
        return None
    return x0 + min_x, y0 + min_y, x0 + max_x, y0 + max_y


def detect_tag_boxes(im: Image.Image) -> dict[int, tuple[int, int, int, int]]:
    arr = np.array(im.convert('RGB'))
    w, _h = arr.shape[:2]
    fg = _fg_mask(arr)
    col_centers = _column_centers(arr)

    # Keep each crop inside the gutter between neighboring catalog columns.
    gutters = [0]
    for i in range(len(col_centers) - 1):
        gutters.append((col_centers[i] + col_centers[i + 1]) // 2)
    gutters.append(w)

    seed_offset = (75, 70, 60)

    boxes: dict[int, tuple[int, int, int, int]] = {}
    for row_idx, (y0, y1) in enumerate(ROW_BANDS):
        half_w = COL_HALF_W[row_idx]
        bottom_max = ROW_BOTTOM_MAX[row_idx]
        for col, cx in enumerate(col_centers):
            x0 = max(gutters[col] + GUTTER_INSET, cx - half_w)
            x1 = min(gutters[col + 1] - GUTTER_INSET, cx + half_w)
            seed_y = y0 + seed_offset[row_idx]
            box = _flood_bbox(fg, y0, y1, x0, x1, cx, seed_y)
            if box is None:
                sub_fg = fg[y0:y1, x0:x1]
                ys, xs = np.where(sub_fg)
                if len(ys) == 0:
                    continue
                box = (
                    x0 + int(xs.min()),
                    y0 + int(ys.min()),
                    x0 + int(xs.max()),
                    y0 + int(ys.max()),
                )
            tag_num = row_idx * 7 + col + 1
            left, top, right, bottom = box
            bottom = min(bottom, bottom_max)
            box = _strip_number_disc(arr, fg, (left, top, right, bottom))
            boxes[tag_num] = box
    return boxes


def _whiten_background(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert('RGBA'))
    rgb = arr[:, :, :3].astype(float)
    bg = np.array(BG_RGB, dtype=float)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    arr[dist < 26, 3] = 0
    out = Image.fromarray(arr, 'RGBA')
    flat = Image.new('RGBA', out.size, (255, 255, 255, 255))
    flat.paste(out, (0, 0), out)
    return flat


def crop_tag(im: Image.Image, box: tuple[int, int, int, int], pad: int = 10) -> Image.Image:
    left, top, right, bottom = box
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(im.width, right + pad)
    bottom = min(im.height, bottom + pad)

    crop = _whiten_background(im.crop((left, top, right, bottom)))
    cw, ch = crop.size
    side = max(cw, ch)
    scale = (OUT * 0.82) / side
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (OUT, OUT), (255, 255, 255, 255))
    canvas.paste(resized, ((OUT - nw) // 2, (OUT - nh) // 2), resized)
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
    for idx, box in sorted(boxes.items()):
        l, t, r, b = box
        print(f'  tag {idx:02d}: ({l}, {t}, {r}, {b})')


if __name__ == '__main__':
    main()
