#!/usr/bin/env python3
"""Fetch or verify original developer panorama JPEGs with the recorded SHA-256.

Uses only Python's standard library. Does not write to another project unless
--destination explicitly points there. Existing correct source files are reused.
The optional manifest is either the v29 source inventory or the compact v30 copy.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import threading
import time
import urllib.request

SOURCE = 'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/'
PATH_PATTERN = re.compile(r'tiles/node[1-6]/cf_[0-5]/l_[03]/c_[0-6]/tile_[0-6]\.jpg\Z')


def main():
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, default=project / 'dist/assets/panorama')
    parser.add_argument('--manifest', type=Path, default=project / 'dist/assets/panorama/source-manifest.json')
    parser.add_argument('--workers', type=int, default=4)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text(encoding='utf-8'))
    assets = data['assets']
    if len(assets) != 1566:
        raise ValueError('The frozen six-scene source inventory must have 1566 assets')
    seen = set()
    for item in assets:
        path = item['path']
        if not PATH_PATTERN.fullmatch(path) or path in seen:
            raise ValueError('Invalid or duplicated source path: ' + path)
        if item['url'] != SOURCE + path or not re.fullmatch(r'[0-9a-f]{64}', item['sha256']):
            raise ValueError('Source URL or checksum is outside the frozen inventory: ' + path)
        seen.add(path)
    args.destination.mkdir(parents=True, exist_ok=True)
    lock = threading.Lock()
    progress = [0]

    def is_valid(blob, item):
        return len(blob) == item['bytes'] and hashlib.sha256(blob).hexdigest() == item['sha256']

    def process(item):
        path = args.destination / item['path']
        reused = False
        try:
            blob = path.read_bytes() if path.is_file() else None
            if blob is not None and is_valid(blob, item):
                reused = True
            elif args.verify_only:
                raise ValueError('Missing or mismatched original file')
            else:
                error = None
                for attempt in range(3):
                    try:
                        with urllib.request.urlopen(item['url'], timeout=30) as response:
                            blob = response.read(item['bytes'] + 1)
                        if not is_valid(blob, item):
                            raise ValueError('Downloaded source checksum mismatch')
                        error = None
                        break
                    except Exception as caught:
                        error = caught
                        if attempt < 2:
                            time.sleep(attempt + 1)
                if error:
                    raise error
                path.parent.mkdir(parents=True, exist_ok=True)
                temporary = path.with_name(path.name + '.part')
                temporary.write_bytes(blob)
                temporary.replace(path)
            result = {'path': item['path'], 'verified': True, 'bytes': item['bytes'], 'reused': reused}
        except Exception as error:
            result = {'path': item['path'], 'verified': False, 'error': str(error)}
        with lock:
            progress[0] += 1
            if progress[0] % 100 == 0 or progress[0] == len(assets):
                print(json.dumps({'checked': progress[0], 'total': len(assets)}), flush=True)
        return result

    started = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 10))) as pool:
        results = list(pool.map(process, assets))
    report = {'sourceUrl': SOURCE, 'destination': str(args.destination.resolve()),
              'assetCount': len(results), 'bytes': sum(item.get('bytes', 0) for item in results),
              'reused': sum(item.get('reused', False) for item in results),
              'elapsedSeconds': round(time.time() - started, 2),
              'allOriginalBytesVerified': all(item['verified'] for item in results),
              'errors': [item for item in results if not item['verified']]}
    report_path = args.report or args.destination / 'download-verification.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0 if report['allOriginalBytesVerified'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
