"""PNG·JPG → WebP (build-data.mjs가 부른다).
stdin: [[원본 경로, 출력 경로], ...]  — 긴 변 MAX px로 줄이고 품질 Q로 저장.
"""
import json
import sys

from PIL import Image

MAX, Q = 1800, 82

for src, dst in json.loads(sys.stdin.buffer.read().decode("utf-8")):   # 셸 로캘과 무관하게 한글 경로를 읽는다
    with Image.open(src) as im:
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        im.save(dst, "WEBP", quality=Q, method=4)
