#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify installed v35 QA, snapshot every file, and export reviewed changes.

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
import shutil
import zipfile
from pathlib import Path, PurePosixPath

REVISION = 35
CHECK_NAMES = ('geometry', 'acceptance', 'interaction')
PLAN_PATH = 'dist/assets/reference-office-v35/office-3-5-plan.png'
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


def safe_name(name):
    p = PurePosixPath(name)
    require(isinstance(name, str) and not p.is_absolute() and '..' not in p.parts
            and str(p) == name, 'Unsafe relative path: ' + repr(name))
    return name


def snapshot(root):
    # The snapshot's own manifest is evidence, not a self-hashed project file.
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob('*'))
            if p.is_file() and str(p.relative_to(root)) != 'BACKUP-SHA256.json'}


def verify_report(path, name, installed_url):
    report = load(path)
    checks = report.get('checks')
    require(report.get('pass') is True and isinstance(checks, list) and checks
            and all(isinstance(c, dict) and c.get('pass') is True for c in checks),
            'Installed QA failed: ' + name)
    for key in ('errors', 'bad', 'resources'):
        require(not report.get(key), 'Installed QA reported errors: ' + name + '/' + key)
    if 'base' in report:
        require(report['base'].rstrip('/') == installed_url.rstrip('/'),
                'Installed report came from the candidate URL: ' + name)
    return report


def verified_install(root, out):
    install = load(out / 'install.json')
    release = load(root / 'RELEASE-v35.json')
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
    require(attribution.get('version') == REVISION and PLAN_PATH not in attribution.get('files', {}),
            'Developer image must not be claimed as an authored texture')
    require(all(sha(root / safe_name(n)) == h for n, h in attribution['files'].items()),
            'Installed provenance hashes changed')
    return install, release


def write_receipt(root, out, url):
    install, release = verified_install(root, out)
    reports = {name: verify_report(out / ('installed-' + name + '.json'), name, url) for name in CHECK_NAMES}
    # The interaction runner checks dataset.release35 inside the real browser.
    require(reports['interaction'].get('base', '').rstrip('/') == url.rstrip('/'),
            'Interaction report must explicitly identify the installed URL')
    utc, moscow = clock()
    receipt = {'revision': REVISION, 'base': url.rstrip('/'), 'completedUTC': utc.isoformat(),
               'completedMoscow': moscow.isoformat(), 'releaseSHA256': sha(root / 'RELEASE-v35.json'),
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
    require(receipt.get('releaseSHA256') == sha(root / 'RELEASE-v35.json')
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
    require(backup.parent == root.parent and backup.name.startswith('RODINA-PEREDELKINO-backup-v35-')
            and backup != root, 'Unexpected full-backup destination')
    started_utc, started_moscow = clock()
    reused = backup.exists()
    manifest_path = backup / 'BACKUP-SHA256.json'
    if reused:
        require(manifest_path.is_file(), 'Existing final backup lacks a completion manifest; inspect it before resuming')
        manifest = load(manifest_path)
        require(manifest.get('revision') == REVISION and manifest.get('files') == hashes
                and snapshot(backup) == hashes, 'Existing final snapshot differs from this installed project')
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
    ledger = load(root / 'BACKUP-INDEX-v35.json')
    ledger.update({'state': 'Completed and verified', 'completedUTC': manifest['createdAtUTC'],
                   'completedMoscow': manifest['createdAtMoscow'], 'snapshotFiles': len(hashes),
                   'snapshotBytes': manifest['bytes'], 'releaseBackup': str(backup),
                   'releaseManifestSHA256': sha(manifest_path), 'installedQAReceiptSHA256': sha(out / 'installed-run.json')})
    for entry in ledger['entries']:
        if entry.get('path') == str(backup):
            entry.update({'state': 'Final v35 snapshot fully verified by SHA-256', 'verifiedFiles': len(hashes),
                          'verifiedBytes': manifest['bytes'], 'manifestSHA256': sha(manifest_path),
                          'createdAtUTC': manifest['createdAtUTC'], 'createdAtMoscow': manifest['createdAtMoscow']})
    write_json(out / 'BACKUP-INDEX-v35-completed.json', ledger)
    names = sorted(set(release['changedFiles']) | {'RELEASE-v35.json', 'ATTRIBUTION.json'})
    for name in names:
        safe_name(name)
        require(not any(part in name.lower() for part in ('chrome-', '__pycache__', 'browser-profile', 'interaction-failure', 'screenshot')),
                'Temporary or private file in export: ' + name)
        if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            require(name == PLAN_PATH and sha(root / name) == PLAN_SHA256, 'Unreviewed image in export: ' + name)
    archive = out / 'RODINA-PEREDELKINO-v35-changes.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as exported:
        for name in names:
            exported.write(root / name, name)
        for name in checks:
            exported.write(out / ('installed-' + name + '.json'), 'tools/qa-v35/installed-' + name + '.json')
        exported.write(out / 'installed-run.json', 'tools/qa-v35/installed-run.json')
        exported.write(out / 'install.json', 'tools/qa-v35/install.json')
        exported.write(manifest_path, 'BACKUP-SHA256-v35.json')
        exported.write(out / 'BACKUP-INDEX-v35-completed.json', 'BACKUP-INDEX-v35-completed.json')
        exported.writestr('APPLY-v35.txt',
            'RODINA-PEREDELKINO v35. Apply changed paths over a COMPLETE v34 project after a full backup.\n'
            'The full reviewed Mac snapshot contains all original panoramas/assets. The archive adds the original developer plan PNG as a separately attributed reference.\n'
            'BACKUP-SHA256-v35.json and BACKUP-INDEX-v35-completed.json are export evidence, not application files to copy into the project.\n'
            'Author: @r_peredelkino; model ID RP-CONCEPT-2026-10-07. The garden, fitness fitout and restaurant amenities are authored concepts, not developer construction drawings.\n'
            'The source unit3/5 is105m2 on floor3; its fitness adaptation on floor2 is conceptual. Arena displacement is visually registered, not surveyed.\n')
        require(exported.testzip() is None, 'Export ZIP failed its CRC check')
    raw = archive.read_bytes()
    encoded = base64.b64encode(raw).decode('ascii')
    (out / 'release-v35.b64').write_text('\n'.join(encoded[i:i + 6000] for i in range(0, len(encoded), 6000)) + '\n', encoding='ascii')
    utc, moscow = clock()
    result = {'revision': REVISION, 'archive': str(archive), 'sha256': hashlib.sha256(raw).hexdigest(),
              'archiveBytes': len(raw), 'b64Lines': (len(encoded) + 5999) // 6000,
              'releaseBackup': str(backup), 'snapshotFiles': len(hashes), 'snapshotBytes': manifest['bytes'],
              'snapshotCompletedUTC': manifest['createdAtUTC'], 'snapshotCompletedMoscow': manifest['createdAtMoscow'],
              'exportedUTC': utc.isoformat(), 'exportedMoscow': moscow.isoformat(), 'snapshotReused': reused,
              'projectUnchangedDuringSnapshot': True, 'installedChecks': {n: len(r['checks']) for n, r in checks.items()},
              'checkCounts': release['checkCounts'], 'totalChecks': sum(release['checkCounts'].values()),
              'originalAssetsPreserved': release['originalAssetsUnchanged'], 'newSourceImages': 1,
              'changedFiles': len(names), 'completionLedger': str(out / 'BACKUP-INDEX-v35-completed.json')}
    write_json(out / 'final-result.json', result)
    print(json.dumps(result, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO')
    parser.add_argument('--out', default='/tmp/rodina-qa-v35')
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
