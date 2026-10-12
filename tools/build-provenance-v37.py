#!/usr/bin/env python3
"""Hash authored code and analysis, preserving attribution of reference images."""
import hashlib
import json
from pathlib import Path, PurePosixPath

REVISION = 37
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
    if source.get('revision') != 36 or len(source.get('images', [])) != 20:
        raise RuntimeError('Expected the twenty retained, unchanged amenity references from v36')
    apartments = json.loads((root / 'references/apartments-v37.json').read_text(encoding='utf-8'))
    if apartments.get('revision') != REVISION or not isinstance(apartments.get('sourceAssets'), list):
        raise RuntimeError('Expected the reviewed v37 apartment-source manifest')
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
    paths.update(root.joinpath('references').glob('*-v37.json'))
    for suffix in ('*.json', '*.cjs', '*.mjs'):
        paths.update(root.joinpath('tools/qa-v37').glob(suffix))
    for name in ('dist/index.html', 'CHANGELOG-GENPLAN-v37.md', 'REPORT-v37.html',
                 'RELEASE-v37.json', 'BACKUP-INDEX-v37.json', 'AI-EDITING-POLICY.json',
                 'tools/reference-study-v37.md', 'tools/finalize-v37.py',
                 'tools/finish-backup-v37.py', 'tools/build-provenance-v37.py'):
        paths.add(root / name)
    references = {item['path'] for item in source['images']}
    references.update(item['path'] for item in apartments['sourceAssets'])
    references.add('dist/assets/reference-office-v35/office-3-5-plan.png')
    # These are the source authors' unchanged images, never our marked model textures.
    paths = sorted(p for p in paths if p.is_file() and not p.is_symlink()
                   and str(p.relative_to(root)) not in references
                   and not str(p.relative_to(root)).startswith(('dist/assets/', 'dist/vendor/'))
                   and p.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf')
                   and '__pycache__' not in p.parts
                   and not any(s in str(p).lower() for s in ('browser-profile', 'interaction-failure', 'screenshot')))
    source_assets = [item for item in previous.get('sourceReferenceAssets', [])
                     if item.get('path') not in references - {'dist/assets/reference-office-v35/office-3-5-plan.png'}]
    plan_path = 'dist/assets/reference-office-v35/office-3-5-plan.png'
    if not any(item.get('path') == plan_path for item in source_assets):
        source_assets.append({'path': plan_path,
                              'sha256': '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296',
                              'sourceUrl': 'https://peredelkino-offices.ru/!upload/t_lots/4d71f717a5c5ec3e31cabbda6c588b44.png',
                              'rights': 'Official developer reference; retained from v36 and excluded from authored files'})
    for image in [*source['images'], *apartments['sourceAssets']]:
        relative = PurePosixPath(image['path'])
        if relative.is_absolute() or '..' in relative.parts or str(relative) != image['path']:
            raise RuntimeError('Unsafe source-reference path')
        path = root / relative
        if not path.is_file() or sha(path) != image['sha256']:
            raise RuntimeError('Reviewed source image differs: ' + image['path'])
        source_assets.append({'path': image['path'], 'sha256': image['sha256'],
                              'uploadedSha256': image.get('uploadedSha256'),
                              'sourceUrl': image.get('sourceUrl'), 'rights': image.get('rights'),
                              'status': image.get('status', 'Exact official web image; matched to uploaded render, excluded from authored files')})
    source_assets = list({item['path']: item for item in source_assets}.values())
    data = {'handle': HANDLE, 'modelId': MODEL_ID, 'version': REVISION,
            'scope': 'Authored application code, reconstructed geometry, interactive furnishings and source-analysis records. '
                     'Original panoramas, developer render references, apartment plans and the office3/5 plan retain their source authors rights. '
                     'Approximate 3D apartment contours, facade registration, furniture and household poses are authored reconstructions, not developer working drawings. '
                     'Distributed geometry marks and existing texture signatures identify provenance but do not technically prevent copying. '
                     'Geographic data remains © OpenStreetMap contributors, ODbL1.0.',
            'architecturalProject': 'Родина Переделкино · Группа Родина',
            'sourceReferenceAssets': source_assets,
            'distributedMarking': {'handle': HANDLE, 'foreignSourceAssetsMarked': False,
                                   'technicalCopyPrevention': False,
                                   'scope': 'Reconstructed model geometry and authored material textures'},
            'thirdPartySoftware': previous.get('thirdPartySoftware', []),
            'algorithm': 'SHA-256',
            'files': {str(p.relative_to(root)): sha(p) for p in paths}}
    (root / 'ATTRIBUTION.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data


if __name__ == '__main__':
    result = build(Path(__file__).resolve().parents[1])
    print('Provenance v37:', len(result['files']), 'authored files;', len(result['sourceReferenceAssets']), 'source assets excluded')
