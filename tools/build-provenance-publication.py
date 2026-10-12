#!/usr/bin/env python3
# coding: utf-8
"""Preserve reconstruction provenance and hash the authorized publication changes."""
import hashlib
import importlib.util
import json
from pathlib import Path


def build(root):
    spec = importlib.util.spec_from_file_location('source_v37', root / 'tools/build-provenance-v37.py')
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    data = source.build(root)
    data['publicationVersion'] = '37.1.0'
    data['sourceRevision'] = 37
    data['sourceTag'] = 'v37-source'
    data['architecturalProjectUrl'] = 'https://rodina-peredelkino.ru/'
    data['developerUrl'] = 'https://rodinagroup.com/'
    data['thirdPartySoftware'] = [
        {'name': 'Three.js and OrbitControls', 'version': '0.186.1', 'license': 'MIT', 'path': 'dist/vendor/three.LICENSE.txt'},
        {'name': 'polygon-clipping', 'version': '0.15.7', 'license': 'MIT', 'path': 'dist/vendor/polygon-clipping.LICENSE.txt'},
        {'name': 'robust-predicates', 'license': 'Unlicense', 'path': 'dist/vendor/robust-predicates.LICENSE.txt'},
        {'name': 'splaytree', 'license': 'MIT', 'path': 'dist/vendor/splaytree.LICENSE.txt'}
    ]
    additions = [root / name for name in ('README.md', 'docs/CONCEPT.md', 'LICENSE-AUTHORED.txt', 'NOTICE.md', 'package.json', 'package-lock.json', 'PUBLICATION.json', 'dist/walk/index.html')]
    for folder in ('scripts', '.github/workflows', 'tools/qa-publication'):
        additions.extend(p for p in (root / folder).rglob('*') if p.is_file() and p.suffix in ('.mjs', '.cjs', '.json', '.yml'))
    additions.append(root / 'tools/build-provenance-publication.py')
    for p in additions:
        if p.is_file():
            data['files'][p.relative_to(root).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
    data['files'] = dict(sorted(data['files'].items()))
    (root / 'ATTRIBUTION.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return data


if __name__ == '__main__':
    result = build(Path(__file__).resolve().parents[1])
    print('Publication provenance:', len(result['files']), 'authored files;', len(result['sourceReferenceAssets']), 'unchanged source images credited separately')
