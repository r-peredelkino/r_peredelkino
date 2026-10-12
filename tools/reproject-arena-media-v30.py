"""Reproject the visible LED artwork from original node1 JPEG tiles.

This is a source-derived texture for a reconstructed mesh, not the developer's
original material. Surface correspondences are hand registered in the supplied
arena camera; no lettering is repainted and the hidden sector stays transparent.
The original compressed JPEG files are read only.

Requires NumPy and Pillow. Run from any working directory with Python:
    python /path/to/project/tools/reproject-arena-media-v30.py
Reads only the bundled dist/assets/panorama JPEG tiles; no network is used.
Writes dist/assets/reference/arena-visible-media.png and
tools/qa-v30/arena-media-reprojection.json below this script's project root.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parents[1]
ASSETS = BASE / 'dist/assets'
QA = BASE / 'tools/qa-v30'
WIDTH, HEIGHT = 1024, 128
VIEW = dict(width=1700, height=1200, pan=-37, tilt=-37, horizontalFov=58)
# Mesh U and source screen top/bottom pixels. Only the observed, unoccluded
# surface is registered. UV values outside this interval retain zero alpha.
CONTROL = np.array([
    [.42, 1080, 574, 1080, 623],
    [.50, 1130, 563, 1130, 617],
    [.58, 1180, 544, 1180, 592],
    [.64, 1210, 523, 1210, 571],
    [.72, 1240, 500, 1240, 533],
    [.79, 1255, 481, 1255, 510],
    [.84, 1263, 470, 1263, 489],
], dtype=float)
faces, sources = {}, {}


def cube_face(face):
    if face in faces:
        return faces[face]
    out = np.zeros((3500, 3500, 3), dtype=np.uint8)
    for col in range(7):
        for row in range(7):
            path = ASSETS / f'panorama/tiles/node1/cf_{face}/l_3/c_{col}/tile_{row}.jpg'
            raw = path.read_bytes()
            bitmap = np.asarray(Image.open(path).convert('RGB'))
            w, h = min(510, 3500-col*510), min(510, 3500-row*510)
            out[row*510:row*510+h, col*510:col*510+w] = bitmap[1:h+1, 1:w+1]
            sources[str(path.relative_to(ASSETS))] = hashlib.sha256(raw).hexdigest()
    faces[face] = out
    return out


def sample_native(x, y):
    tx = math.tan(math.radians(VIEW['horizontalFov']/2))
    ty = tx * VIEW['height']/VIEW['width']
    a, b, c = (x/(VIEW['width']/2)-1)*tx, (1-y/(VIEW['height']/2))*ty, -1
    t, p = math.radians(VIEW['tilt']), math.radians(VIEW['pan'])
    b, c = b*math.cos(t)-c*math.sin(t), b*math.sin(t)+c*math.cos(t)
    a, c = a*math.cos(p)+c*math.sin(p), -a*math.sin(p)+c*math.cos(p)
    m = max(abs(a), abs(b), abs(c))
    if abs(a) == m:
        face, u, v = (1, c/a, -b/a) if a > 0 else (3, c/a, b/a)
    elif abs(b) == m:
        face, u, v = (4, a/b, -c/b) if b > 0 else (5, -a/b, -c/b)
    else:
        face, u, v = (2, -a/c, -b/c) if c > 0 else (0, -a/c, b/c)
    image = cube_face(face)
    sx, sy = np.clip([(u+1)*1750-.5, (v+1)*1750-.5], 0, 3499)
    ix, iy = int(sx), int(sy)
    fx, fy = sx-ix, sy-iy
    jx, jy = min(ix+1, 3499), min(iy+1, 3499)
    # Bilinear sampling only: preserve the source colour and actual glyph pixels.
    return np.rint((image[iy, ix]*(1-fx)+image[iy, jx]*fx)*(1-fy)
                   +(image[jy, ix]*(1-fx)+image[jy, jx]*fx)*fy).astype(np.uint8)


rgba = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
for x in range(WIDTH):
    u = (x+.5)/WIDTH
    if not CONTROL[0, 0] <= u <= CONTROL[-1, 0]:
        continue
    topx, topy, bottomx, bottomy = [np.interp(u, CONTROL[:, 0], CONTROL[:, c]) for c in range(1, 5)]
    edge = min(1, (u-CONTROL[0, 0])/.012, (CONTROL[-1, 0]-u)/.012)
    for y in range(HEIGHT):
        v = (y+.5)/HEIGHT
        sx, sy = topx*(1-v)+bottomx*v, topy*(1-v)+bottomy*v
        rgba[y, x, :3] = sample_native(sx, sy)
        rgba[y, x, 3] = round(255*edge)

out = ASSETS / 'reference/arena-visible-media.png'
out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgba, 'RGBA').save(out)
meta = {
    'source': 'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/',
    'node': 'node1', 'nativeFaceSize': 3500, 'sourceCamera': VIEW,
    'registration': CONTROL.tolist(), 'coveredMeshURange': [.42, .84],
    'unknownSector': 'Transparent; the existing neutral white shell remains visible',
    'method': 'Registered source-pixel rays, original cube JPEG sampling, bilinear reprojection',
    'letteringRepainted': False, 'originalDeveloperMaterial': False,
    'sourceTileHashes': sources,
    'output': str(out.relative_to(BASE)), 'outputSHA256': hashlib.sha256(out.read_bytes()).hexdigest(),
}
QA.mkdir(parents=True, exist_ok=True)
(QA/'arena-media-reprojection.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k:v for k,v in meta.items() if k not in ['sourceTileHashes', 'registration']}, ensure_ascii=False))
