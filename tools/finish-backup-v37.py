#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify installed v37 QA, snapshot every file, and export reviewed changes.

First run the three browser checks against the installed8080 application and
save installed-geometry.json, installed-acceptance.json, installed-interaction.json.
Then use --write-installed-receipt. A normal invocation verifies that receipt,
all installed file hashes and every copied file before producing an archive.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import shutil
import zipfile
from pathlib import Path, PurePosixPath

REVISION = 37
CHECK_NAMES = ('geometry', 'acceptance', 'interaction')
PLAN_PATH = 'dist/assets/reference-office-v35/office-3-5-plan.png'
SOURCE_MANIFEST = 'references/source-amenities-v36.json'
SOURCE_PREFIX = 'dist/assets/reference-amenities-v36/'
APARTMENTS_MANIFEST = 'references/apartments-v37.json'
APARTMENT_SOURCE_PREFIXES = {'dist/assets/reference/apartment-plans/': ('.png', '!upload/t_lots/'),
                             'dist/assets/plans/': ('.svg', '!upload/t_blds/')}
SOURCE_SUFFIXES = ('.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf')
PLAN_SHA256 = '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def clock():
    utc = dt.datetime.now(dt.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        moscow = utc.astimezone(ZoneInfo('Europe/Moscow'))
    except (ImportError, KeyError):
        moscow = utc.astimezone(dt.timezone(dt.timedelta(hours=3), 'Europe/Moscow'))
    return utc, moscow


def publish_without_overwrite(source, destination):
    """An existing verified output is reusable; different bytes are never replaced."""
    if destination.exists():
        require(destination.is_file() and not destination.is_symlink()
                and sha(destination) == sha(source),
                'A different or incomplete published export already exists: ' + str(destination))
    else:
        with source.open('rb') as incoming, destination.open('xb') as outgoing:
            shutil.copyfileobj(incoming, outgoing, length=1024 * 1024)
            outgoing.flush()
            os.fsync(outgoing.fileno())
        require(sha(destination) == sha(source), 'Published export differs: ' + str(destination))
    return str(destination)


def safe_name(name):
    require(isinstance(name, str), 'Manifest path must be a string: ' + repr(name))
    p = PurePosixPath(name)
    require(bool(name) and name != '.' and not p.is_absolute() and '..' not in p.parts
            and str(p) == name, 'Unsafe relative path: ' + repr(name))
    return name


def snapshot(root):
    # The snapshot's own manifest is evidence, not a self-hashed project file.
    result = {}
    for p in sorted(root.rglob('*')):
        require(not p.is_symlink(), 'Symlinks are not allowed in a sealed snapshot: ' + str(p))
        if p.is_file() and str(p.relative_to(root)) != 'BACKUP-SHA256.json':
            result[str(p.relative_to(root))] = sha(p)
    return result


def verify_report(path, name, installed_url):
    report = load(path)
    checks = report.get('checks')
    require(report.get('pass') is True and isinstance(checks, list) and checks
            and all(isinstance(c, dict) and c.get('pass') is True for c in checks),
            'Installed QA failed: ' + name)
    for key in ('errors', 'bad', 'resources'):
        require(not report.get(key), 'Installed QA reported errors: ' + name + '/' + key)
    require(report.get('revision') == REVISION
            and report.get('base', '').rstrip('/') == installed_url.rstrip('/'),
            'Installed report did not explicitly identify the installed v37 application: ' + name)
    return report


def reference_images(root):
    source = load(root / SOURCE_MANIFEST)
    images = source.get('images')
    require(source.get('revision') == 36 and isinstance(images, list) and len(images) == 20,
            'The twenty matched official source images are not recorded')
    result = {}
    for image in images:
        name = safe_name(image.get('path'))
        require(name.startswith(SOURCE_PREFIX) and name.lower().endswith(SOURCE_SUFFIXES) or name.startswith('dist/assets/')
                and name not in result, 'Unexpected or repeated source asset: ' + name)
        require((root / name).is_file() and not (root / name).is_symlink()
                and sha(root / name) == image.get('sha256')
                and (root / name).stat().st_size == image.get('bytes'),
                'Reviewed official source image changed: ' + name)
        result[name] = image
    require({str(p.relative_to(root)) for p in (root / SOURCE_PREFIX).rglob('*') if p.is_file()} == set(result),
            'Unrecorded source image in installed project')
    return result


def apartment_sources(root, baseline_hashes):
    """v37 reuses baseline PNG/SVG plans; it introduces no new source-image bytes."""
    catalog = load(root / APARTMENTS_MANIFEST)
    require(catalog.get('revision') == REVISION, 'Apartment study belongs to another revision')
    layouts = catalog.get('layouts')
    require(isinstance(layouts, list) and layouts, 'Apartment study has no reviewed layouts')
    require(catalog.get('threeDExamples') == len(layouts), 'Apartment example count differs from its layouts')
    assets = catalog.get('sourceAssets')
    require(isinstance(assets, list), 'Apartment study must explicitly record its source assets')
    result = {}
    for item in assets:
        require(isinstance(item, dict), 'Invalid apartment source asset')
        name = safe_name(item.get('path'))
        prefix = next((p for p in APARTMENT_SOURCE_PREFIXES if name.startswith(p)), None)
        require(prefix and name not in result, 'Unexpected or repeated apartment source asset: ' + name)
        suffix, official_path = APARTMENT_SOURCE_PREFIXES[prefix]
        require(name.lower().endswith(suffix) and name[len(prefix):] == Path(name).name,
                'Unexpected apartment reference subtree or file type: ' + name)
        require(item.get('sourceUrl') == 'https://rodina-peredelkino.ru/' + official_path + Path(name).name
                and item.get('rights') and item.get('status') == 'existing-source-unchanged',
                'Apartment source needs attribution and review status: ' + name)
        file = root / name
        require(file.is_file() and not file.is_symlink()
                and sha(file) == item.get('sha256') and file.stat().st_size == item.get('bytes'),
                'Reviewed apartment source asset differs: ' + name)
        require(baseline_hashes.get(name) == item.get('sha256'),
                'Apartment source was not unchanged in the verified baseline: ' + name)
        result[name] = item
    used = set()
    ids = set()
    for layout in layouts:
        require(isinstance(layout, dict) and isinstance(layout.get('id'), str)
                and layout['id'] not in ids, 'Invalid or repeated apartment layout')
        ids.add(layout['id'])
        require(layout.get('sourceUrl') == 'https://rodina-peredelkino.ru/catalog/' + layout['id'] + '/',
                'Apartment layout must retain its official page URL')
        for key in ('imagePath', 'floorPath'):
            name = safe_name(layout.get(key))
            require(name in result, 'Layout source is missing from the source-assets journal: ' + name)
            used.add(name)
    require(used == set(result), 'Source-assets journal contains unused or missing apartment plans')
    return catalog, result


def verified_install(root, out):
    install = load(out / 'install.json')
    release = load(root / 'RELEASE-v37.json')
    require(install.get('revision') == REVISION and release.get('revision') == REVISION,
            'Unexpected installed revision')
    require(install.get('indexInstalledLast') is True, 'Index-last installation evidence is missing')
    require(install.get('projectSHA256') and snapshot(root) == install['projectSHA256'],
            'Installed project changed since the guarded installation')
    require(all(sha(root / safe_name(n)) == h for n, h in install['sha256'].items()),
            'A reviewed installed file changed')
    for name, data in release['changedFiles'].items():
        require(sha(root / safe_name(name)) == data['after'], 'Changed-file hash mismatch: ' + name)
    require(sha(root / PLAN_PATH) == PLAN_SHA256, 'Original developer plan image changed')
    attribution = load(root / 'ATTRIBUTION.json')
    sources = reference_images(root)
    _, apartment_images = apartment_sources(root, load(Path(release['baselineBackup']) / 'BACKUP-SHA256.json')['files'])
    sources = dict(sources, **apartment_images)
    require(attribution.get('version') == REVISION
            and not ({PLAN_PATH} | set(sources)) & set(attribution.get('files', {})),
            'Developer image must not be claimed as an authored texture')
    require(all(sha(root / safe_name(n)) == h for n, h in attribution['files'].items()),
            'Installed provenance hashes changed')
    return install, release


def write_receipt(root, out, url):
    install, release = verified_install(root, out)
    reports = {name: verify_report(out / ('installed-' + name + '.json'), name, url) for name in CHECK_NAMES}
    # The browser runners check dataset.release37 inside the real browser.
    require(reports['interaction'].get('base', '').rstrip('/') == url.rstrip('/'),
            'Interaction report must explicitly identify the installed URL')
    utc, moscow = clock()
    receipt = {'revision': REVISION, 'base': url.rstrip('/'), 'completedUTC': utc.isoformat(),
               'completedMoscow': moscow.isoformat(), 'releaseSHA256': sha(root / 'RELEASE-v37.json'),
               'installReceiptSHA256': sha(out / 'install.json'),
               'reports': {n: {'path': 'installed-' + n + '.json',
                               'sha256': sha(out / ('installed-' + n + '.json')),
                               'checks': len(r['checks'])} for n, r in reports.items()}}
    write_json(out / 'installed-run.json', receipt)
    print(json.dumps({'installedQAReceipt': str(out / 'installed-run.json'), 'revision': REVISION,
                      'base': url.rstrip('/'), 'counts': {n: len(r['checks']) for n, r in reports.items()},
                      'completedMoscow': moscow.isoformat()}, ensure_ascii=False))


def finish(root, out, url):
    install, release = verified_install(root, out)
    receipt = load(out / 'installed-run.json')
    require(receipt.get('revision') == REVISION and receipt.get('base') == url.rstrip('/'),
            'Installed QA completion receipt is missing or has the wrong URL')
    require(receipt.get('releaseSHA256') == sha(root / 'RELEASE-v37.json')
            and receipt.get('installReceiptSHA256') == sha(out / 'install.json'),
            'Installed QA receipt no longer identifies this installation')
    checks = {}
    for name in CHECK_NAMES:
        record = receipt.get('reports', {}).get(name, {})
        require(record.get('path') == 'installed-' + name + '.json', 'Installed report receipt is missing: ' + name)
        report_path = out / record['path']
        require(sha(report_path) == record.get('sha256'), 'Installed report changed since completion: ' + name)
        checks[name] = verify_report(report_path, name, url)
        require(record.get('checks') == len(checks[name]['checks']), 'Installed count changed: ' + name)
    hashes = snapshot(root)
    backup = Path(release['releaseBackup']).resolve()
    require(backup.parent == root.parent and backup.name.startswith('RODINA-PEREDELKINO-backup-v37-')
            and backup != root, 'Unexpected full-backup destination')
    started_utc, started_moscow = clock()
    reused = backup.exists()
    manifest_path = backup / 'BACKUP-SHA256.json'
    if reused:
        require(manifest_path.is_file(), 'Existing final backup lacks a completion manifest; inspect it before resuming')
        manifest = load(manifest_path)
        require(manifest.get('revision') == REVISION and manifest.get('files') == hashes
                and snapshot(backup) == hashes
                and manifest.get('installedQAReceiptSHA256') == sha(out / 'installed-run.json'),
                'Existing final snapshot differs from this installation or its QA receipt')
    else:
        shutil.copytree(root, backup, copy_function=shutil.copy2)
        copied = snapshot(backup)
        after = snapshot(root)
        require(hashes == copied == after, 'Full snapshot verification failed or the installed project changed during copying')
        completed_utc, completed_moscow = clock()
        manifest = {'revision': REVISION, 'createdAtUTC': completed_utc.isoformat(),
                    'createdAtMoscow': completed_moscow.isoformat(),
                    'snapshotStartedUTC': started_utc.isoformat(), 'snapshotStartedMoscow': started_moscow.isoformat(),
                    'project': str(root), 'backup': str(backup), 'files': hashes, 'fileCount': len(hashes),
                    'bytes': sum((root / n).stat().st_size for n in hashes),
                    'installedQAReceiptSHA256': sha(out / 'installed-run.json'),
                    'installedChecks': {n: len(r['checks']) for n, r in checks.items()},
                    'verification': 'Every copied project file equals the installed project by SHA-256 before and after copying; installed browser QA passed',
                    'manifestExclusion': 'BACKUP-SHA256.json is the evidence file itself and is not included in its files map'}
        write_json(manifest_path, manifest)
    require(snapshot(root) == hashes and snapshot(backup) == hashes, 'Project or final snapshot changed during completion')
    ledger = load(root / 'BACKUP-INDEX-v37.json')
    ledger.update({'state': 'Completed and verified', 'completedUTC': manifest['createdAtUTC'],
                   'completedMoscow': manifest['createdAtMoscow'], 'snapshotFiles': len(hashes),
                   'snapshotBytes': manifest['bytes'], 'releaseBackup': str(backup),
                   'releaseManifestSHA256': sha(manifest_path), 'installedQAReceiptSHA256': sha(out / 'installed-run.json')})
    for entry in ledger['entries']:
        if entry.get('path') == str(backup):
            entry.update({'state': 'Final v37 snapshot fully verified by SHA-256', 'verifiedFiles': len(hashes),
                          'verifiedBytes': manifest['bytes'], 'manifestSHA256': sha(manifest_path),
                          'createdAtUTC': manifest['createdAtUTC'], 'createdAtMoscow': manifest['createdAtMoscow']})
    write_json(out / 'BACKUP-INDEX-v37-completed.json', ledger)
    names = sorted(set(release['changedFiles']) | {'RELEASE-v37.json', 'ATTRIBUTION.json'})
    sources = reference_images(root)
    _, apartment_images = apartment_sources(root, load(Path(release['baselineBackup']) / 'BACKUP-SHA256.json')['files'])
    sources = dict(sources, **apartment_images)
    for name in names:
        safe_name(name)
        require(not any(part in name.lower() for part in ('chrome-', '__pycache__', 'browser-profile', 'interaction-failure', 'screenshot')),
                'Temporary or private file in export: ' + name)
        if name.lower().endswith(SOURCE_SUFFIXES) or name.startswith('dist/assets/'):
            require(name in sources and sha(root / name) == sources[name]['sha256'], 'Unreviewed image in export: ' + name)
    archive = out / 'RODINA-PEREDELKINO-v37-changes.zip'
    snapshot_time = dt.datetime.fromisoformat(manifest['createdAtUTC'])
    zip_time = (max(1980, min(2107, snapshot_time.year)), snapshot_time.month, snapshot_time.day,
                snapshot_time.hour, snapshot_time.minute, snapshot_time.second)
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as exported:
        def add_bytes(name, data):
            info = zipfile.ZipInfo(safe_name(name), date_time=zip_time)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            exported.writestr(info, data)
        for name in names:
            add_bytes(name, (root / name).read_bytes())
        for name in checks:
            add_bytes('tools/qa-v37/installed-' + name + '.json', (out / ('installed-' + name + '.json')).read_bytes())
        add_bytes('tools/qa-v37/installed-run.json', (out / 'installed-run.json').read_bytes())
        add_bytes('tools/qa-v37/install.json', (out / 'install.json').read_bytes())
        add_bytes('BACKUP-SHA256-v37.json', manifest_path.read_bytes())
        add_bytes('BACKUP-INDEX-v37-completed.json', (out / 'BACKUP-INDEX-v37-completed.json').read_bytes())
        add_bytes('APPLY-v37.txt',
            'RODINA-PEREDELKINO v37. Apply changed paths over a COMPLETE v36 project after a full backup.\n'
            'The full reviewed Mac snapshot retains all original panoramas, official render references and source plans unchanged. v37 introduces no new source-image bytes; it reuses unchanged official plans from the complete v36 project.\n'
            'BACKUP-SHA256-v37.json and BACKUP-INDEX-v37-completed.json are export evidence, not application files to copy into the project.\n'
            'Author: @r_peredelkino; model ID RP-CONCEPT-2026-10-07. Approximate3D apartment contours, facade registration, furnishing and household poses are authored reconstructions, not developer construction drawings.\n'
            'Distributed pixel marks and existing texture signatures document provenance but cannot guarantee technical prevention of copying. Third-party plans, render references and panoramas are excluded from our authored files and are not marked.\n'.encode('utf-8'))
        require(exported.testzip() is None, 'Export ZIP failed its CRC check')
    raw = archive.read_bytes()
    archive_sha = hashlib.sha256(raw).hexdigest()
    suffix = backup.name.removeprefix('RODINA-PEREDELKINO-backup-v37-') if hasattr(str, 'removeprefix') else backup.name[len('RODINA-PEREDELKINO-backup-v37-'):]
    published_archive = root.parent / ('RODINA-PEREDELKINO-v37-changes-' + suffix + '.zip')
    published_ledger = root.parent / ('RODINA-PEREDELKINO-BACKUP-INDEX-v37-' + suffix + '.json')
    publish_without_overwrite(archive, published_archive)
    publish_without_overwrite(out / 'BACKUP-INDEX-v37-completed.json', published_ledger)
    checksum = out / 'archive-v37.sha256'
    checksum.write_text(archive_sha + '  ' + published_archive.name + '\n', encoding='ascii')
    published_checksum = published_archive.with_suffix('.zip.sha256')
    publish_without_overwrite(checksum, published_checksum)
    encoded = base64.b64encode(raw).decode('ascii')
    lines = [encoded[i:i + 6000] for i in range(0, len(encoded), 6000)]
    parts = []
    for start in range(0, len(lines), 24):
        selected = lines[start:start + 24]
        name = 'release-v37-part-' + format(len(parts), '04d') + '.b64'
        text = '\n'.join(selected) + '\n'
        part_path = out / name
        part_path.write_text(text, encoding='ascii')
        decoded = base64.b64decode(''.join(selected), validate=True)
        parts.append({'path': str(part_path), 'name': name, 'lines': len(selected),
                      'encodedCharacters': sum(len(line) for line in selected),
                      'decodedBytes': len(decoded), 'encodedFileSHA256': sha(part_path),
                      'decodedSHA256': hashlib.sha256(decoded).hexdigest()})
    # Every part has at most24lines, so remote reads never need high offsets.
    require(b''.join(base64.b64decode(Path(part['path']).read_text(encoding='ascii'))
                     for part in parts) == raw, 'Partitioned export does not reconstruct the ZIP')
    export_index = out / 'release-v37-export-index.json'
    write_json(export_index, {'revision': REVISION, 'archiveSHA256': archive_sha,
                             'archiveBytes': len(raw), 'lineLength': 6000, 'maximumPartLines': 24,
                             'encoding': 'base64; decode each part and concatenate in listed order',
                             'parts': parts})
    utc, moscow = clock()
    result = {'revision': REVISION, 'archive': str(archive), 'sha256': archive_sha,
              'archiveBytes': len(raw), 'b64Lines': (len(encoded) + 5999) // 6000,
              'base64ExportIndex': str(export_index), 'base64Parts': len(parts),
              'releaseBackup': str(backup), 'snapshotFiles': len(hashes), 'snapshotBytes': manifest['bytes'],
              'snapshotCompletedUTC': manifest['createdAtUTC'], 'snapshotCompletedMoscow': manifest['createdAtMoscow'],
              'exportedUTC': utc.isoformat(), 'exportedMoscow': moscow.isoformat(), 'snapshotReused': reused,
              'projectUnchangedDuringSnapshot': True, 'installedChecks': {n: len(r['checks']) for n, r in checks.items()},
              'checkCounts': release['checkCounts'], 'totalChecks': sum(release['checkCounts'].values()),
              'originalAssetsPreserved': release['originalAssetsUnchanged'],
              'newSourceImages': len(release.get('newSourceAssets', {})),
              'recordedApartmentSourceAssets': len(apartment_images),
              'changedFiles': len(names), 'completionLedger': str(out / 'BACKUP-INDEX-v37-completed.json'),
              'publishedArchive': str(published_archive), 'publishedChecksum': str(published_checksum),
              'publishedBackupLedger': str(published_ledger), 'publishedLedgerSHA256': sha(published_ledger)}
    write_json(out / 'final-result.json', result)
    print(json.dumps(result, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO')
    parser.add_argument('--out', default='/tmp/rodina-qa-v37')
    parser.add_argument('--installed-url', default='http://127.0.0.1:8080')
    parser.add_argument('--write-installed-receipt', action='store_true')
    args = parser.parse_args()
    root, out = Path(args.project).resolve(), Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if args.write_installed_receipt:
        write_receipt(root, out, args.installed_url)
    else:
        finish(root, out, args.installed_url)


if __name__ == '__main__':
    main()
