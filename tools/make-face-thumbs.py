#!/usr/bin/env python3
"""バトルの仲間のカード用の小さな絵を作る（2026-11-12）。

会話用の上半身の絵（public/art/portraits/{id}-normal.webp、900×1200）の上の方（顔と肩）を切り出し、
幅 330px（カードの幅 110px の3倍）に縮めて public/art/faces/{id}.webp に書き出す。
上半身の絵を差し替えたら、もう一度これを動かす：python3 tools/make-face-thumbs.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public/art/portraits')
OUT = os.path.join(ROOT, 'public/art/faces')
# 切り出す範囲（元の絵の高さに対する割合）と、書き出す幅
CROP_BOTTOM = 0.6
WIDTH = 330
QUALITY = 80

os.makedirs(OUT, exist_ok=True)
for path in sorted(glob.glob(os.path.join(SRC, '*-normal.webp'))):
    hero = os.path.basename(path)[: -len('-normal.webp')]
    im = Image.open(path)
    w, h = im.size
    face = im.crop((0, 0, w, round(h * CROP_BOTTOM)))
    face = face.resize((WIDTH, round(WIDTH * face.height / face.width)), Image.LANCZOS)
    dest = os.path.join(OUT, f'{hero}.webp')
    face.save(dest, 'WEBP', quality=QUALITY, method=6)
    print(f'{hero}: {os.path.getsize(path) // 1024}KB -> {os.path.getsize(dest) // 1024}KB')
