#!/usr/bin/env python3
"""Hash authored code and analysis, preserving attribution of reference images."""
import hashlib
import json
from pathlib import Path, PurePosixPath

REVISION = 36
HANDLE = '@r_peredelkino'
MODEL_ID = 'RP-CONCEPT-2026-10-07'


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def build(root):
    previous_path = root / 'ATTRIBUTION.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.is_file() else {}
    source = json.loads((root / 'references/source-amenities-v36.json').read_text(encoding='utf-8'))
    if source.get('revision') != REVISION or len(source.get('images', [])) != 20:
        raise RuntimeError('Expected twenty reviewed amenity references for v36')
    paths = set()
    for name in previous.get('files', {}):
        relative = PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts or str(relative) != name:
            raise RuntimeError('Unsafe prior provenance path: ' + repr(name))
        path = root / name
        if path.is_file():
            paths.add(path)
    paths.update(root.joinpath('dist').glob('*.js'))
    paths.update(root.joinpath('dist').glob('*.css'))
    paths.update(root.joinpath('references').glob('*-v36.json'))
    for suffix in ('*.json', '*.cjs', '*.mjs'):
        paths.update(root.joinpath('tools/qa-v36').glob(suffix))
    for name in ('dist/index.html', 'CHANGELOG-INTERIORS-v36.md', 'REPORT-v36.html',
                 'RELEASE-v36.json', 'BACKUP-INDEX-v36.json', 'AI-EDITING-POLICY.json',
                 'tools/reference-study-v36.md', 'tools/finalize-v36.py',
                 'tools/finish-backup-v36.py', 'tools/build-provenance-v36.py',
                 'tools/fetch-amenity-assets-v36.py'):
        paths.add(root / name)
    references = {item['path'] for item in source['images']}
    references.add('dist/assets/reference-office-v35/office-3-5-plan.png')
    # These are the source authors' unchanged images, never our marked model textures.
    paths = sorted(p for p in paths if p.is_file() and not p.is_symlink()
                   and str(p.relative_to(root)) not in references
                   and not str(p.relative_to(root)).startswith(('dist/assets/', 'dist/vendor/'))
                   and p.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp')
                   and '__pycache__' not in p.parts
                   and not any(s in str(p).lower() for s in ('browser-profile', 'interaction-failure', 'screenshot')))
    source_assets = [item for item in previous.get('sourceReferenceAssets', [])
                     if item.get('path') not in references - {'dist/assets/reference-office-v35/office-3-5-plan.png'}]
    plan_path = 'dist/assets/reference-office-v35/office-3-5-plan.png'
    if not any(item.get('path') == plan_path for item in source_assets):
        source_assets.append({'path': plan_path,
                              'sha256': '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296',
                              'sourceUrl': 'https://peredelkino-offices.ru/!upload/t_lots/4d71f717a5c5ec3e31cabbda6c588b44.png',
                              'rights': 'Official developer reference; retained from v35 and excluded from authored files'})
    for image in source['images']:
        path = root / image['path']
        if not path.is_file() or sha(path) != image['sha256']:
            raise RuntimeError('Reviewed source image differs: ' + image['path'])
        source_assets.append({'path': image['path'], 'sha256': image['sha256'],
                              'uploadedSha256': image.get('uploadedSha256'),
                              'sourceUrl': image.get('sourceUrl'), 'rights': image.get('rights'),
                              'status': 'Exact official web image; matched to uploaded render, excluded from authored files'})
    data = {'handle': HANDLE, 'modelId': MODEL_ID, 'version': REVISION,
            'scope': 'Authored application code, reconstructed geometry, interactive furnishings and source-analysis records. '
                     'Original panoramas, developer render references and the office3/5 plan retain their source authors rights. '
                     'New room placement and the first-floor equipment fitout are authored adaptations, not developer working drawings. '
                     'The advertised individual-training room has no exercise machines; our equipment showroom is an additional concept. '
                     'Geographic data remains © OpenStreetMap contributors, ODbL1.0.',
            'architecturalProject': 'Родина Переделкино · Группа Родина',
            'sourceReferenceAssets': source_assets,
            'thirdPartySoftware': previous.get('thirdPartySoftware', []),
            'algorithm': 'SHA-256',
            'files': {str(p.relative_to(root)): sha(p) for p in paths}}
    (root / 'ATTRIBUTION.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data


if __name__ == '__main__':
    result = build(Path(__file__).resolve().parents[1])
    print('Provenance v36:', len(result['files']), 'authored files;', len(result['sourceReferenceAssets']), 'source assets excluded')
