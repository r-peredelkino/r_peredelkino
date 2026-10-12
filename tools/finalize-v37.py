#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare v37 after native QA, or atomically install the prepared files.

No command is executed on import. The complete installed project and its
pre-v37 snapshot must both match the recorded baseline before either action.
"""
import argparse
import datetime as dt
import hashlib
import html
import json
import math
import os
import shutil
import subprocess
from pathlib import Path, PurePosixPath

REVISION = 37
BASE_REVISION = 36
CHECK_NAMES = (
    'geometry', 'acceptance', 'interaction', 'lobby-cpu', 'club-cpu', 'parking-cpu',
    'fitness-cpu', 'fitness-context-cpu', 'cpu-activities', 'watermark-cpu',
    'plans-cpu', 'apartment-geometry-cpu', 'apartment-actions-cpu',
)
PLAN_PATH = 'dist/assets/reference-office-v35/office-3-5-plan.png'
SOURCE_MANIFEST = 'references/source-amenities-v36.json'
EVIDENCE_MANIFEST = 'references/amenities-and-parking-v36.json'
SOURCE_PREFIX = 'dist/assets/reference-amenities-v36/'
APARTMENTS_MANIFEST = 'references/apartments-v37.json'
APARTMENT_SOURCE_PREFIXES = {'dist/assets/reference/apartment-plans/': ('.png', '!upload/t_lots/'),
                             'dist/assets/plans/': ('.svg', '!upload/t_blds/')}
SOURCE_SUFFIXES = ('.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf')
UI_CHECK_NAMES = ('geometry', 'acceptance', 'interaction')
PLAN_SHA256 = '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296'
LABELS = {
    'lobby-cpu': 'Входная группа, лифтовой и квартирный холлы',
    'club-cpu': 'Клубные помещения и внутренние маршруты',
    'parking-cpu': 'Паркинг, переходы и модельные проезды',
    'fitness-cpu': 'Контур фитнеса, оборудование и проходимость',
    'fitness-context-cpu': 'Вид из фитнеса и сохранение соседнего стилобата',
    'geometry': 'Прежние дорожки, проход 1–2 и террасы',
    'acceptance': 'Прежние функции приложения и источники',
    'interaction': 'Входы, прогулка, игры и новые действия',
    'cpu-activities': 'Таймеры и жизненный цикл мини-игр',
    'watermark-cpu': 'Встроенная пиксельная маркировка геометрии и текстур',
    'plans-cpu': 'Каталог квартир, первичные источники и ограничения точности',
    'apartment-geometry-cpu': 'Контуры квартир, мебель, окна и коллизии',
    'apartment-actions-cpu': 'Свет, телевизор и ракурсы бытовых действий',
}


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
    require(isinstance(name, str), 'Manifest path must be a string: ' + repr(name))
    p = PurePosixPath(name)
    require(bool(name) and name != '.' and not p.is_absolute() and '..' not in p.parts
            and str(p) == name, 'Unsafe manifest path: ' + repr(name))
    return name


def snapshot(root):
    result = {}
    for p in sorted(root.rglob('*')):
        require(not p.is_symlink(), 'Symlinks are not allowed in a sealed project: ' + str(p))
        if p.is_file():
            result[str(p.relative_to(root))] = sha(p)
    return result


def verify_checks(path, name):
    data = load(path)
    checks = data.get('checks')
    require(data.get('pass') is True and isinstance(checks, list) and len(checks) > 0,
            'Required QA is missing or failed: ' + name)
    require(all(isinstance(c, dict) and c.get('pass') is True for c in checks),
            'A QA assertion failed: ' + name)
    require(data.get('revision') == REVISION, 'QA belongs to another revision: ' + name)
    for key in ('errors', 'resources', 'bad'):
        require(not data.get(key), 'QA reported errors in ' + name + ': ' + key)
    return data


def reference_images(root):
    """Accept only twenty reviewed official image files with recorded hashes."""
    source = load(root / SOURCE_MANIFEST)
    require(source.get('revision') == 36, 'Retained amenity manifest is not the reviewed v36 source')
    images = source.get('images')
    require(isinstance(images, list) and len(images) == 20,
            'The twenty matched official reference images must be recorded')
    result = {}
    for image in images:
        name = safe_name(image.get('path'))
        require(name.startswith(SOURCE_PREFIX)
                and name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')),
                'Unexpected reference image path: ' + name)
        digest = image.get('sha256')
        require(isinstance(digest, str) and len(digest) == 64
                and all(c in '0123456789abcdef' for c in digest),
                'Invalid reference SHA-256: ' + name)
        require(name not in result, 'Duplicate reference path: ' + name)
        require((root / name).is_file() and not (root / name).is_symlink()
                and sha(root / name) == digest
                and (root / name).stat().st_size == image.get('bytes'),
                'Reviewed official reference image changed: ' + name)
        result[name] = image
    actual = {str(p.relative_to(root)) for p in (root / SOURCE_PREFIX).rglob('*') if p.is_file()}
    require(actual == set(result), 'Unrecorded or missing amenity reference image')
    return source, result


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


def paired_performance(candidate, out, require_measured=False):
    path = out / 'performance-paired.json'
    qa = candidate / 'tools/qa-v37'
    if path.is_file():
        data, summary = performance(path)
        write_json(qa / 'performance-paired.json', data)
        summary.update({'measured': True, 'baseRevision': BASE_REVISION, 'revision': REVISION})
    else:
        require(not require_measured, 'A fresh paired v36/v37 benchmark was requested but is missing')
        summary = {'measured': False, 'baseRevision': BASE_REVISION, 'revision': REVISION,
                   'status': 'Not measured in v37; earlier revision measurements are not reused'}
    write_json(qa / 'performance-summary.json', summary)
    return summary


def guard(installed, baseline, expected, instructions_reviewed=False):
    for name in expected:
        safe_name(name)
    baseline_actual = {n: sha(baseline / n) for n in expected if (baseline / n).is_file()}
    require(baseline_actual == expected, 'Pre-v37 snapshot no longer matches its SHA-256 manifest')
    require({n: h for n, h in snapshot(baseline).items() if n != 'BACKUP-SHA256.json'} == expected,
            'Pre-v37 snapshot contains extra, missing or changed project files')
    actual = snapshot(installed)
    differences = sorted(n for n in set(actual) | set(expected) if actual.get(n) != expected.get(n))
    require(actual == expected, 'Installed project changed since the pre-v37 backup: ' + repr(differences))
    if not instructions_reviewed:
        instructions = [str(p / 'AGENTS.md') for p in [installed, *installed.parents]
                        if (p / 'AGENTS.md').exists()]
        require(not instructions, 'Read applicable instructions, then use --instructions-reviewed: ' + repr(instructions))


def performance(path):
    data = load(path)
    samples = data.get('samples', [])
    require(data.get('pass') is True and len(samples) == 12 and not data.get('errors')
            and not data.get('resources'), 'Paired v36/v37 performance run is incomplete or failed')
    require(data.get('nodeArchitecture') == 'arm64', 'Performance run must use native ARM64 Node')
    method = data.get('method', {})
    require(method.get('viewport') == [1500, 1000] and method.get('dpr') == 1
            and method.get('pairedRepeats') == 2 and method.get('framesPerView') == 90
            and method.get('quality') == 'full' and method.get('order') == [36, 37, 36, 37],
            'Performance method differs from the reviewed paired comparison')
    summary = {'pass': True, 'method': data.get('method', {}), 'nodeArchitecture': 'arm64'}
    for action in ('courtyard', 'forecourt', 'facade'):
        by_version = {v: [s for s in samples if s.get('version') == v and s.get('action') == action]
                      for v in (BASE_REVISION, REVISION)}
        for version, group in by_version.items():
            require(len(group) == 2 and {s.get('pair') for s in group} == {1, 2},
                    'Invalid paired samples for ' + action + '/v' + str(version))
            for sample in group:
                mean = sample.get('meanMS', sample.get('mean'))
                require(isinstance(mean, (int, float)) and math.isfinite(mean) and mean > 0
                        and sample.get('glError') == 0 and sample.get('quality') == 'full'
                        and sample.get('frames') == 90,
                        'Invalid performance sample for ' + action)
        for pair in (1, 2):
            before = next(s for s in by_version[BASE_REVISION] if s['pair'] == pair)
            after = next(s for s in by_version[REVISION] if s['pair'] == pair)
            require(before.get('camera') and before['camera'] == after.get('camera'),
                    'Performance cameras differ: ' + action + '/pair ' + str(pair))
        means = {v: sum(s.get('meanMS', s.get('mean')) for s in group) / len(group)
                 for v, group in by_version.items()}
        summary[action] = {'beforeMeanMS': means[BASE_REVISION], 'afterMeanMS': means[REVISION],
                           'changePercent': 100 * (means[REVISION] / means[BASE_REVISION] - 1)}
    return data, summary


def existing_backup_entries(parent, baseline, expected):
    entries = []
    for folder in sorted(parent.glob('RODINA-PEREDELKINO-backup-*')):
        if not folder.is_dir():
            continue
        item = {'name': folder.name, 'path': str(folder), 'state': 'Historical snapshot retained; not rehashed in v37'}
        manifest = folder / 'BACKUP-SHA256.json'
        if manifest.is_file():
            previous = load(manifest)
            item.update({'manifestSHA256': sha(manifest), 'recordedFileCount': previous.get('fileCount'),
                         'recordedUTC': previous.get('createdAtUTC', previous.get('createdAt', previous.get('createdUTC')))})
        if folder == baseline:
            item.update({'state': 'Every recorded baseline file verified by SHA-256 in this preparation',
                         'verifiedFiles': len(expected)})
        entries.append(item)
    return entries


def report_html(base, backup, utc, moscow, counts, summary, assets, source, evidence, apartments):
    esc = html.escape
    rows = ''.join('<tr><td>' + esc(LABELS[n]) + '</td><td>' + str(counts[n])
                   + '</td><td>Пройдено</td></tr>' for n in CHECK_NAMES)
    plan_rows = ''.join('<tr><td>' + esc(str(p.get('id', ''))) + '</td><td>'
                       + esc(str(p.get('building', ''))) + '</td><td>'
                       + esc(str(p.get('floor', ''))) + '</td><td>'
                       + esc(str(p.get('area', p.get('areaM2', '')))) + '</td><td>'
                       + esc(str(p.get('sourceMethod', p.get('status', 'Источник указан в журнале'))))
                       + '</td></tr>' for p in apartments['layouts'])
    if summary.get('measured'):
        performance_text = '<p>Свежий парный замер v36/v37: Chrome и Node ARM64, полное качество, 1500 × 1000, DPR 1. Два прохода, три одинаковых ракурса по 90 кадров — 12 выборок.</p><table><tr><th>Ракурс</th><th>v36, мс</th><th>v37, мс</th><th>Изменение</th></tr>'
        for key, label in [('courtyard', 'Двор'), ('forecourt', 'Променад'), ('facade', 'Офис')]:
            item = summary[key]
            performance_text += '<tr><td>' + label + '</td><td>' + format(item['beforeMeanMS'], '.2f') + '</td><td>' + format(item['afterMeanMS'], '.2f') + '</td><td>' + format(item['changePercent'], '+.1f') + '%</td></tr>'
        performance_text += '</table><p>Это сравнение относится к указанным условиям; частота кадров на других устройствах не гарантируется.</p>'
    else:
        performance_text = '<p>Свежий парный замер v36/v37 не выполнен. Старые результаты не перенесены; ускорение и конкретная частота кадров не заявляются.</p>'
    return f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RODINA-PEREDELKINO · v37</title><style>
:root{{color-scheme:dark}}*{{box-sizing:border-box}}body{{margin:0;background:#151b1d;color:#f3eee4;font:16px/1.65 system-ui,sans-serif}}
main{{max-width:1040px;margin:auto;padding:48px 24px 64px}}small{{color:#d5b782;font-size:12px;letter-spacing:2px}}h1{{font-size:clamp(32px,5vw,48px);line-height:1.12;margin:16px 0 24px}}h2{{font-size:23px;margin:32px 0 12px}}p{{color:#c3c8c6}}a{{color:#f4d39b;text-underline-offset:3px}}code{{font-size:12px;overflow-wrap:anywhere}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}.card{{padding:22px;border:1px solid #49514e;border-radius:18px;background:#242e2c}}.card h2{{margin:0 0 10px;font-size:21px}}.card p{{margin:0}}.status{{padding:5px 12px;border-radius:30px;background:#344b40;color:#d7efdc;font-size:13px}}.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{padding:12px 10px;border-bottom:1px solid #414b46;text-align:left}}th{{color:#d5b782}}.note{{padding-left:18px;border-left:2px solid #c8b27a}}@media(max-width:620px){{main{{padding:30px 18px}}.grid{{grid-template-columns:1fr}}}}</style>
<main><small>@r_peredelkino / {esc(moscow.strftime('%d.%m.%Y'))} / v37</small>
<h1>Переделкино<br>3D-генплан и прогулки по квартирам</h1>
<p>Дополнение к v36: распределённые метки происхождения, расширенный каталог квартир, сопряжение их окон с фасадом и действия внутри меблированных помещений. Прежние 3D-функции комплекса сохраняются.</p>
<div class="grid"><section class="card"><h2>Встроенные пиксельные метки</h2><p>@r_peredelkino интегрирован в собственную геометрию и материалы небольшими пиксельными элементами. Маркировка связана с поверхностями модели, а не только с отдельной табличкой. Существующие скрытые подписи, идентификатор модели и хеши сохранены.</p></section>
<section class="card"><h2>Каталог и обстановка</h2><p>Добавлены варианты квартир, разобранные по исходным планам. Мебель, проходы и расположение окон проверены для прогулки. Неподтверждённые размеры и реконструированные элементы указаны отдельно в журнале источников.</p></section>
<section class="card"><h2>Бытовой интерактив</h2><p>Свет и телевизор управляются в квартире. Можно перейти в ракурс лёжа на кровати или диване, сидя за столом либо в санузле и затем вернуться к прогулке. Это демонстрационные действия визуализатора.</p></section>
<section class="card"><h2>Единый генплан</h2><p>Квартиры и прежние помещения связаны с основной 3D-сценой: двор, арена, офис, магазины, лобби, клуб жителей и паркинг. Панорамы и исходные изображения сохраняют права их авторов.</p></section></div>
<h2>Примеры квартир и первичные источники</h2><div class="scroll"><table><tr><th>План</th><th>Корпус</th><th>Этаж</th><th>Площадь</th><th>Метод</th></tr>{plan_rows}</table></div>
<p>Полные ссылки, исходные SHA-256 и ограничения записаны в <code>references/apartments-v37.json</code>. Этот каталог не заменяет официальный актуальный список продаж или рабочую проектную документацию.</p>
<p>В версии разобраны {len(apartments['layouts'])} индивидуальных 3D-примеров. Исходный каталог содержит {apartments.get('archivedCatalogCount', '—')} записей на дату {esc(str(apartments.get('snapshotAsOf', 'исходного снимка')))}. План квартиры 2-588 сохранён как архивный источник: новый адрес на текущей странице возвращал пустой файл, поэтому совпадение старого плана с новым не заявляется. Все использованные PNG и SVG уже входят в v36 и не изменены.</p>
<h2>Точность модели и права</h2><div class="note"><p>Планы показывают конфигурацию квартир, но не подтверждают все высоты, фасадные узлы и мебель. 3D-контуры, меблировка и интерактивные состояния реконструированы; неизвестные параметры не выдаются за обмеры. Внешние исходные контуры комплекса сохраняются.</p>
<p>Распределённая маркировка затрудняет удаление подписи и помогает установить происхождение. Она не способна сделать копирование технически невозможным и не устанавливает автоматический запрет для стороннего ИИ. Чужие планы, рендеры и панорамы не маркируются и исключены из перечня наших авторских файлов.</p></div>
<h2>Проверки на Mac</h2><p><span class="status">{sum(counts.values())} проверок пройдено</span></p><div class="scroll"><table><tr><th>Область</th><th>Проверки</th><th>Результат</th></tr>{rows}</table></div>
<p>Счётчики взяты из завершённых протоколов v37. {assets} прежних файлов ассетов и библиотек совпадают с v36 по SHA-256. Отдельная квитанция повторных проверок установленного приложения включена в итоговый архив.</p>
<h2>Производительность</h2>{performance_text}
<h2>Резервные копии</h2><p>До изменений: <code>{esc(str(base))}</code>. Полная итоговая копия: <code>{esc(str(backup))}</code>. Копирование каждого файла проверяется по SHA-256; завершение удостоверяют BACKUP-SHA256.json и BACKUP-INDEX-v37-completed.json.</p>
<p>Архив изменений предназначен для полной v36 после резервного копирования. Он содержит изменённый код, протоколы и сведения о происхождении. Новые файлы исходных изображений не добавляются; прежние планы и большие ассеты остаются в полных копиях на Mac. Личные изображения, профили браузера и снимки проверки не экспортируются.</p>
<p>Автор разработки: @r_peredelkino. Идентификатор: RP-CONCEPT-2026-10-07.</p>
<p><small>Подготовлено: {esc(moscow.isoformat())} · UTC {esc(utc.isoformat())}</small></p></main></html>'''


def prepare(args, candidate, installed, baseline, out, expected):
    qa = candidate / 'tools/qa-v37'
    qa.mkdir(parents=True, exist_ok=True)
    checks = {n: verify_checks(out / (n + '.json'), n) for n in CHECK_NAMES}
    for name in UI_CHECK_NAMES:
        require(checks[name].get('revision') == REVISION
                and checks[name].get('base', '').rstrip('/') == args.candidate_url.rstrip('/'),
                'Browser QA did not identify the candidate v37 application: ' + name)
    counts = {n: len(report['checks']) for n, report in checks.items()}
    for name, data in checks.items():
        write_json(qa / (name + '.json'), data)
    summary = paired_performance(candidate, out, args.require_performance)
    source, source_images = reference_images(candidate)
    apartments, apartment_images = apartment_sources(candidate, expected)
    source_images = dict(source_images, **apartment_images)
    evidence = load(candidate / EVIDENCE_MANIFEST)
    assets = sorted(n for n in expected if n.startswith(('dist/assets/', 'dist/vendor/')))
    require(len(assets) == args.expected_original_assets,
            'Original asset count differs from the reviewed baseline: ' + str(len(assets)))
    require(all((candidate / n).is_file() and sha(candidate / n) == expected[n] for n in assets),
            'An original image, asset or vendor file changed')
    for name in ('dist/complex-footprints.js', 'dist/public-realm-layout.js'):
        require(sha(candidate / name) == expected[name], 'Source layout changed: ' + name)
    require(sha(candidate / PLAN_PATH) == PLAN_SHA256, 'Source office-plan PNG changed')
    utc, moscow = clock()
    backup = installed.parent / ('RODINA-PEREDELKINO-backup-v37-' + moscow.strftime('%Y%m%d-%H%M%S'))
    require(not backup.exists(), 'Reserved final backup path already exists: ' + str(backup))
    entries = existing_backup_entries(installed.parent, baseline, expected)
    entries.append({'name': backup.name, 'path': str(backup), 'state': 'Reserved final v37 snapshot',
                    'completionEvidence': str(backup / 'BACKUP-SHA256.json')})
    write_json(candidate / 'BACKUP-INDEX-v37.json', {'revision': REVISION, 'recordedUTC': utc.isoformat(),
               'recordedMoscow': moscow.isoformat(), 'baselineBackup': str(baseline),
               'baselineVerifiedFiles': len(expected), 'releaseBackup': str(backup),
               'completionLedger': 'BACKUP-INDEX-v37-completed.json in the reviewed export', 'entries': entries})
    (candidate / 'REPORT-v37.html').write_text(report_html(baseline, backup, utc, moscow, counts, summary, len(assets), source, evidence, apartments), encoding='utf-8')
    excluded = {'ATTRIBUTION.json', 'RELEASE-v37.json'}
    files = {str(p.relative_to(candidate)): sha(p) for p in sorted(candidate.rglob('*'))
             if p.is_file() and '__pycache__' not in p.parts and str(p.relative_to(candidate)) not in excluded}
    require(set(expected).issubset(set(files) | excluded), 'No baseline file may be deleted')
    changed = {n: {'before': expected.get(n), 'after': h} for n, h in files.items() if expected.get(n) != h}
    for name in changed:
        safe_name(name)
        require(not any(part in name.lower() for part in ('chrome-', '__pycache__', 'browser-profile', 'interaction-failure', 'screenshot')),
                'Temporary or private artifact in release: ' + name)
        if name.lower().endswith(SOURCE_SUFFIXES) or name.startswith('dist/assets/'):
            require(name in source_images and sha(candidate / name) == source_images[name]['sha256'],
                    'Unreviewed or personal image in release: ' + name)
            require(name in expected, 'v37 must not introduce new source-image bytes: ' + name)
    release = {'revision': REVISION, 'baseRevision': BASE_REVISION, 'createdUTC': utc.isoformat(),
               'createdMoscow': moscow.isoformat(), 'author': '@r_peredelkino', 'modelId': 'RP-CONCEPT-2026-10-07',
               'baselineBackup': str(baseline), 'baselineManifestSHA256': sha(baseline / 'BACKUP-SHA256.json'),
               'baselineFileCount': len(expected), 'releaseBackup': str(backup),
               'originalAssetsUnchanged': len(assets), 'architecturalFootprintsUnchanged': True,
               'newSourceAssets': {n: {'sha256': image['sha256'],
                                     'uploadedSha256': image.get('uploadedSha256'),
                                     'rights': image.get('rights'), 'sourceUrl': image.get('sourceUrl')}
                                   for n, image in source_images.items() if n not in expected},
               'changedFiles': changed, 'checkCounts': counts, 'totalChecks': sum(counts.values()),
               'checks': ['tools/qa-v37/' + n + '.json' for n in CHECK_NAMES],
               'performance': 'tools/qa-v37/performance-summary.json', 'limitsFile': APARTMENTS_MANIFEST,
               'sourceStudy': SOURCE_MANIFEST, 'parkingEvidence': EVIDENCE_MANIFEST,
               'arenaPlacement': 'Preserved v36 arena registration; no new movement in v37',
               'apartmentStudy': APARTMENTS_MANIFEST, 'reviewedApartmentExamples': len(apartments['layouts']),
               'apartmentSourceAssets': len(apartment_images),
               'sourceImagesAdded': 0,
               'apartmentCatalogSnapshotAsOf': apartments.get('snapshotAsOf'),
               'apartmentCatalogArchivedRecords': apartments.get('archivedCatalogCount'),
               'apartmentGeometry': 'Source-based approximate reconstruction, matched facade registration, authored furniture and household poses; not construction drawings',
               'watermark': {'handle': '@r_peredelkino', 'integratedGeometry': True,
                             'existingTextureSignaturesRetained': True, 'technicalCopyPrevention': False,
                             'purpose': 'Distributed provenance marks; removal resistance is not a guarantee against copying'},
               'applicationScope': '3D masterplan and its existing linked interiors, catalog and interactive functions',
               'performanceMeasured': summary.get('measured', False)}
    write_json(candidate / 'RELEASE-v37.json', release)
    subprocess.run([args.python, str(candidate / 'tools/build-provenance-v37.py')], check=True)
    print(json.dumps({'preparedRevision': REVISION, 'files': len(changed) + 2, 'checkCounts': counts,
                      'totalChecks': sum(counts.values()), 'originalAssetsPreserved': len(assets),
                      'releaseBackup': str(backup), 'createdMoscow': moscow.isoformat(), 'performance': summary}, ensure_ascii=False))


def install(candidate, installed, baseline, out, expected):
    release = load(candidate / 'RELEASE-v37.json')
    require(release.get('revision') == REVISION and release.get('baseRevision') == BASE_REVISION,
            'Prepared release has an unexpected revision')
    require(release.get('baselineManifestSHA256') == sha(baseline / 'BACKUP-SHA256.json')
            and release.get('baselineFileCount') == len(expected), 'Prepared baseline identity changed')
    names = sorted(set(release['changedFiles']) | {'RELEASE-v37.json', 'ATTRIBUTION.json'})
    for name, data in release['changedFiles'].items():
        safe_name(name)
        require(data.get('before') == expected.get(name) and sha(candidate / name) == data['after'],
                'Prepared file changed: ' + name)
    manifest = load(candidate / 'ATTRIBUTION.json')
    _, source_images = reference_images(candidate)
    _, apartment_images = apartment_sources(candidate, expected)
    source_images = dict(source_images, **apartment_images)
    require(manifest.get('version') == REVISION
            and not ({PLAN_PATH} | set(source_images)) & set(manifest.get('files', {})),
            'Authorship manifest must retain the original source image rights')
    for name, digest in manifest['files'].items():
        safe_name(name)
        require(sha(candidate / name) == digest, 'Provenance hash changed: ' + name)
    require(sha(candidate / PLAN_PATH) == PLAN_SHA256, 'Source plan image changed after review')
    for name in CHECK_NAMES:
        report = verify_checks(candidate / ('tools/qa-v37/' + name + '.json'), name)
        require(len(report['checks']) == release.get('checkCounts', {}).get(name),
                'Prepared QA assertion count changed: ' + name)
    summary = load(candidate / 'tools/qa-v37/performance-summary.json')
    require(summary.get('revision') == REVISION and summary.get('baseRevision') == BASE_REVISION,
            'Performance summary belongs to another revision')
    if summary.get('measured'):
        performance(candidate / 'tools/qa-v37/performance-paired.json')
    require('dist/index.html' in names, 'Release must install its index cache revision last')
    expected_candidate = dict(expected)
    expected_candidate.update({n: sha(candidate / n) for n in names})
    require(snapshot(candidate) == expected_candidate,
            'Candidate contains unreviewed, changed or missing files after preparation')
    names = [n for n in names if n != 'dist/index.html'] + ['dist/index.html']
    completed, temporaries = [], []
    try:
        for name in names:
            source, destination = candidate / name, installed / name
            require(source.is_file() and not source.is_symlink(), 'Invalid prepared source: ' + name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(destination.name + '.v37-installing-' + str(os.getpid()))
            temporaries.append(temporary)
            shutil.copy2(source, temporary)
            os.replace(temporary, destination)
            completed.append(name)
        require(all(sha(installed / n) == sha(candidate / n) for n in names), 'Atomic install verification failed')
        expected_after = dict(expected)
        expected_after.update({n: sha(candidate / n) for n in names})
        require(snapshot(installed) == expected_after, 'Complete project differs after installation')
    except Exception:
        for name in reversed(completed):
            destination = installed / name
            if name in expected:
                temporary = destination.with_name(destination.name + '.v37-rollback-' + str(os.getpid()))
                shutil.copy2(baseline / name, temporary)
                os.replace(temporary, destination)
            else:
                destination.unlink(missing_ok=True)
        for temporary in temporaries:
            temporary.unlink(missing_ok=True)
        require(snapshot(installed) == expected, 'Install failed and rollback needs investigation')
        raise
    utc, moscow = clock()
    result = {'revision': REVISION, 'installedUTC': utc.isoformat(), 'installedMoscow': moscow.isoformat(),
              'files': names, 'sha256': {n: sha(installed / n) for n in names},
              'projectSHA256': snapshot(installed), 'releaseBackup': release['releaseBackup'],
              'baselineFileCount': len(expected), 'verifiedProjectFiles': len(expected_after), 'indexInstalledLast': True}
    write_json(out / 'install.json', result)
    print(json.dumps({'installedRevision': REVISION, 'verifiedFiles': len(names),
                      'verifiedProjectFiles': len(expected_after), 'releaseBackup': release['releaseBackup'],
                      'installedMoscow': moscow.isoformat()}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', action='store_true')
    parser.add_argument('--candidate', default='/tmp/rodina-v37-candidate')
    parser.add_argument('--project', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO')
    parser.add_argument('--baseline', default=None, help='Defaults to the verified backup in OUT/begin.json')
    parser.add_argument('--out', default='/tmp/rodina-qa-v37')
    parser.add_argument('--python', default='/usr/bin/python3')
    parser.add_argument('--expected-original-assets', type=int, default=1759)
    parser.add_argument('--candidate-url', default='http://127.0.0.1:8097')
    parser.add_argument('--require-performance', action='store_true')
    parser.add_argument('--instructions-reviewed', action='store_true')
    args = parser.parse_args()
    candidate, installed, out = map(lambda n: Path(getattr(args, n)).resolve(), ('candidate', 'project', 'out'))
    begin = load(out / 'begin.json')
    require(begin.get('revision') == REVISION and begin.get('baselineRevision') == BASE_REVISION
            and begin.get('verified') is True, 'Fresh verified v36-before-v37 baseline evidence is missing')
    if args.baseline:
        baseline = Path(args.baseline).resolve()
    else:
        baseline_name = begin.get('baselineBackup', begin.get('backup', begin.get('path')))
        require(isinstance(baseline_name, str), 'begin.json does not identify the verified baseline backup')
        baseline = Path(baseline_name).resolve()
    require(candidate != installed and baseline != installed, 'Candidate and baseline must be separate from the installed project')
    require(Path(begin['baselineBackup']).resolve() == baseline,
            'Requested baseline differs from the fresh backup receipt')
    if begin.get('project') is not None:
        require(Path(begin['project']).resolve() == installed, 'Baseline receipt identifies another project')
    if begin.get('candidate') is not None:
        require(Path(begin['candidate']).resolve() == candidate, 'Baseline receipt identifies another candidate')
    expected = load(baseline / 'BACKUP-SHA256.json')['files']
    require(begin.get('baselineFiles') == len(expected)
            and begin.get('baselineBytes') == sum((baseline / n).stat().st_size for n in expected),
            'Fresh backup count or byte total differs from its project files')
    guard(installed, baseline, expected, args.instructions_reviewed)
    out.mkdir(parents=True, exist_ok=True)
    if args.install:
        install(candidate, installed, baseline, out, expected)
    else:
        prepare(args, candidate, installed, baseline, out, expected)


if __name__ == '__main__':
    main()
