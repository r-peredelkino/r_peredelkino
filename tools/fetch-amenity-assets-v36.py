#!/usr/bin/env python3
"""Fetch unchanged official visual references and verify every expected byte."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import urllib.parse
import urllib.request


def verify(data, item):
    if len(data) != item['bytes']:
        raise ValueError('Unexpected byte length for ' + item['path'])
    if hashlib.sha256(data).hexdigest() != item['sha256']:
        raise ValueError('SHA-256 mismatch for ' + item['path'])
    fmt = item['mediaFormat']
    if fmt == 'WEBP' and not (data[:4] == b'RIFF' and data[8:12] == b'WEBP'):
        raise ValueError('Expected actual WEBP bytes for ' + item['path'])
    if fmt == 'JPEG' and data[:2] != b'\xff\xd8':
        raise ValueError('Expected actual JPEG bytes for ' + item['path'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    root = args.project_root.resolve()
    manifest = json.loads((root / 'references/amenity-assets-download-v36.json').read_text())
    items = manifest['images']
    if len(items) != 20 or len({x['path'] for x in items}) != 20:
        raise ValueError('Expected exactly 20 distinct reference assets')

    def one(item):
        path = (root / item['path']).resolve()
        if root not in path.parents or not item['path'].startswith('dist/assets/reference-amenities-v36/'):
            raise ValueError('Invalid reference destination')
        url = urllib.parse.urlsplit(item['sourceUrl'])
        if url.scheme != 'https' or url.netloc != 'rodina-peredelkino.ru':
            raise ValueError('Expected official developer HTTPS source')
        if path.exists():
            verify(path.read_bytes(), item)
            return {'path': item['path'], 'verified': True, 'downloaded': False}
        if args.check_only:
            raise FileNotFoundError(path)
        request = urllib.request.Request(item['sourceUrl'], headers={'User-Agent': 'Rodina-Peredelkino-reference-verification/36'})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read(item['bytes'] + 1)
        verify(data, item)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + '.reference-download')
        try:
            temporary.write_bytes(data)
            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink()
        return {'path': item['path'], 'verified': True, 'downloaded': True}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(one, items))
    print(json.dumps({'ok': True, 'assets': len(results), 'bytes': sum(x['bytes'] for x in items), 'results': results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
