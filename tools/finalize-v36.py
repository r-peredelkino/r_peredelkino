#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare v36 after native QA, or atomically install the prepared files.

No command is executed on import. The complete installed project and its
pre-v36 snapshot must both match the recorded baseline before either action.
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

REVISION = 36
BASE_REVISION = 35
CHECK_NAMES = (
    'geometry', 'acceptance', 'interaction', 'lobby-cpu', 'club-cpu', 'parking-cpu',
    'fitness-cpu', 'fitness-context-cpu', 'cpu-activities',
)
PLAN_PATH = 'dist/assets/reference-office-v35/office-3-5-plan.png'
SOURCE_MANIFEST = 'references/source-amenities-v36.json'
EVIDENCE_MANIFEST = 'references/amenities-and-parking-v36.json'
SOURCE_PREFIX = 'dist/assets/reference-amenities-v36/'
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
    require(isinstance(name, str) and not p.is_absolute() and '..' not in p.parts
            and str(p) == name, 'Unsafe manifest path: ' + repr(name))
    return name


def snapshot(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob('*')) if p.is_file()}


def verify_checks(path, name):
    data = load(path)
    checks = data.get('checks')
    require(data.get('pass') is True and isinstance(checks, list) and len(checks) > 0,
            'Required QA is missing or failed: ' + name)
    require(all(isinstance(c, dict) and c.get('pass') is True for c in checks),
            'A QA assertion failed: ' + name)
    for key in ('errors', 'resources', 'bad'):
        require(not data.get(key), 'QA reported errors in ' + name + ': ' + key)
    return data


def reference_images(root):
    """Accept only twenty reviewed official image files with recorded hashes."""
    source = load(root / SOURCE_MANIFEST)
    require(source.get('revision') == REVISION, 'Reference manifest is not for v36')
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
                and sha(root / name) == digest, 'Reviewed official reference image changed: ' + name)
        result[name] = image
    actual = {str(p.relative_to(root)) for p in (root / SOURCE_PREFIX).rglob('*') if p.is_file()}
    require(actual == set(result), 'Unrecorded or missing amenity reference image')
    return source, result


def paired_performance(candidate, out, require_measured=False):
    path = out / 'performance-paired.json'
    qa = candidate / 'tools/qa-v36'
    if path.is_file():
        data, summary = performance(path)
        write_json(qa / 'performance-paired.json', data)
        summary.update({'measured': True, 'baseRevision': BASE_REVISION, 'revision': REVISION})
    else:
        require(not require_measured, 'A fresh paired v35/v36 benchmark was requested but is missing')
        summary = {'measured': False, 'baseRevision': BASE_REVISION, 'revision': REVISION,
                   'status': 'Not measured in v36; earlier revision measurements are not reused'}
    write_json(qa / 'performance-summary.json', summary)
    return summary


def guard(installed, baseline, expected, instructions_reviewed=False):
    for name in expected:
        safe_name(name)
    baseline_actual = {n: sha(baseline / n) for n in expected if (baseline / n).is_file()}
    require(baseline_actual == expected, 'Pre-v36 snapshot no longer matches its SHA-256 manifest')
    actual = snapshot(installed)
    differences = sorted(n for n in set(actual) | set(expected) if actual.get(n) != expected.get(n))
    require(actual == expected, 'Installed project changed since the pre-v36 backup: ' + repr(differences))
    if not instructions_reviewed:
        instructions = [str(p / 'AGENTS.md') for p in [installed, *installed.parents]
                        if (p / 'AGENTS.md').exists()]
        require(not instructions, 'Read applicable instructions, then use --instructions-reviewed: ' + repr(instructions))


def performance(path):
    data = load(path)
    samples = data.get('samples', [])
    require(data.get('pass') is True and len(samples) == 12 and not data.get('errors')
            and not data.get('resources'), 'Paired v35/v36 performance run is incomplete or failed')
    require(data.get('nodeArchitecture') == 'arm64', 'Performance run must use native ARM64 Node')
    method = data.get('method', {})
    require(method.get('viewport') == [1500, 1000] and method.get('dpr') == 1
            and method.get('pairedRepeats') == 2 and method.get('framesPerView') == 90
            and method.get('quality') == 'full' and method.get('order') == [35, 36, 35, 36],
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
        item = {'name': folder.name, 'path': str(folder), 'state': 'Historical snapshot retained; not rehashed in v36'}
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


def report_html(base, backup, utc, moscow, counts, summary, assets, source, evidence):
    esc = html.escape
    fact_translations = {
        'lobbies': 'Дизайнерские лобби с местами отдыха и коворкингом в каждом жилом корпусе.',
        'resident-club': 'ТВ-гостиная с кухней и баром, тренировки, детская и кофейный коворкинг родителей.',
        'lobby-utility': 'Хранение колясок, велосипедов и самокатов, гостевой санузел и лапомойка.',
        'lounge-use': 'Соседские встречи в гостиной с ТВ, кухней и баром.',
        'individual-training': 'Большой экран, отдельный вход, индивидуальные тренировки; без тренажёров.',
        'kids-access': 'Вход в детскую только через кофейный коворкинг родителей.',
        'parking': 'Места для велосипедов и мотоциклов, подготовка к электрозарядке; кладовые на −1.',
        'ev-installation': 'Предусмотрена возможность установки зарядки; число установленных устройств не подтверждено.',
    }
    rows = ''.join('<tr><td>' + esc(LABELS[n]) + '</td><td>' + str(counts[n])
                   + '</td><td>Пройдено</td></tr>' for n in CHECK_NAMES)
    images = ''.join('<tr><td>' + esc(str(i.get('originalName', i['path']))) + '</td><td>'
                     + esc(str(i.get('subject', 'Референс интерьера'))) + '</td><td>'
                     + ('<a href="' + esc(i['sourceUrl'], quote=True) + '">Источник</a>'
                        if str(i.get('sourceUrl', '')).startswith('https://') else 'Загружено пользователем')
                     + '</td></tr>' for i in source['images'])
    facts = ''.join('<tr><td>' + esc(str(f.get('label', ''))) + '</td><td>'
                    + esc(str(fact_translations.get(f.get('id'), f.get('value', '')))) + '</td><td>'
                    + ('<a href="' + esc(f['sourceUrl'], quote=True) + '">Источник</a>'
                       if str(f.get('sourceUrl', '')).startswith('https://') else 'Материал исследования')
                    + '</td></tr>' for f in evidence.get('verifiedFacts', [])
                    if f.get('status') in ('verified', 'advertised'))
    if summary.get('measured'):
        performance_text = '<p>Свежий парный замер v35/v36: нативные Chrome и Node ARM64, полное качество, 1500 × 1000, DPR 1. Два парных прохода, три одинаковых ракурса по 90 кадров — 12 выборок. Ниже среднее время кадра.</p><div class="scroll"><table><tr><th>Ракурс</th><th>v35, мс</th><th>v36, мс</th><th>Изменение</th></tr>'
        for key, label in [('courtyard', 'Двор'), ('forecourt', 'Променад'), ('facade', 'Офис')]:
            item = summary[key]
            performance_text += '<tr><td>' + label + '</td><td>' + format(item['beforeMeanMS'], '.2f') + '</td><td>' + format(item['afterMeanMS'], '.2f') + '</td><td>' + format(item['changePercent'], '+.1f') + '%</td></tr>'
        performance_text += '</table></div><p>Измерение относится только к этим условиям и не гарантирует ту же частоту кадров на других устройствах.</p>'
    else:
        performance_text = '<p>Свежий парный замер v35/v36 не выполнен. Результаты предыдущих версий сюда не перенесены; ускорение или конкретная частота кадров не заявляются.</p>'
    return f'''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RODINA-PEREDELKINO · v36</title><style>
:root{{color-scheme:dark}}*{{box-sizing:border-box}}body{{margin:0;background:#151b1d;color:#f3eee4;font:16px/1.65 system-ui,sans-serif}}
main{{max-width:1040px;margin:auto;padding:48px 24px 64px}}small{{color:#d5b782;font-size:12px;letter-spacing:2px}}h1{{font-size:clamp(32px,5vw,48px);line-height:1.12;margin:16px 0 24px}}h2{{font-size:23px;margin:32px 0 12px}}p{{color:#c3c8c6}}a{{color:#f4d39b;text-underline-offset:3px}}code{{font-size:12px;overflow-wrap:anywhere}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}.card{{padding:22px;border:1px solid #49514e;border-radius:18px;background:#242e2c}}.card h2{{margin:0 0 10px;font-size:21px}}.card p{{margin:0}}.status{{padding:5px 12px;border-radius:30px;background:#344b40;color:#d7efdc;font-size:13px}}.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}td,th{{padding:12px 10px;border-bottom:1px solid #414b46;text-align:left}}th{{color:#d5b782}}.note{{padding-left:18px;border-left:2px solid #c8b27a}}@media(max-width:620px){{main{{padding:30px 18px}}.grid{{grid-template-columns:1fr}}}}</style>
<main><small>@r_peredelkino / {esc(moscow.strftime('%d.%m.%Y'))} / v36</small>
<h1>Переделкино<br>Входные группы и клубные пространства</h1>
<p>Дополнение к v35 по двадцати новым референсам: внутренние помещения, маршруты между ними и галерея исходных изображений. Двор, фасады, веер, арена и ресторанная терраса предыдущей версии сохранены.</p>
<div class="grid"><section class="card"><h2>Входная группа</h2><p>Прогулка по лобби, лифтовому и квартирному холлам. Переходы к клубным помещениям, колясочной и зоне мойки. Материалы, свет, мебель и характер пространства изучены по предоставленным рендерам.</p></section>
<section class="card"><h2>Комнаты для жителей</h2><p>Детская игровая, кухня и кофейная зона, лаунж, тренировки и йога. Предметы и действия дополнены для интерактивной демонстрации, с возможностью вернуться во двор.</p></section>
<section class="card"><h2>Фитнес · первый этаж</h2><p>Фитнес перенесён на первый этаж по новому запросу. Авторские тренажёры предыдущей версии и прогулка сохранены. Йога и клубные занятия дополнены по новым референсам; оборудование и распределение комнат остаются реконструкцией.</p></section>
<section class="card"><h2>Подземный паркинг</h2><p>Внутренний просмотр паркинга, навигация и переход к холлу. Документированные сведения и демонстрационные решения разделены; невыданные рабочие размеры рамп и мест не считаются подтверждёнными.</p></section></div>
<h2>Что подтверждено источниками</h2>
<div class="scroll"><table><tr><th>Сведение</th><th>Значение в источнике</th><th>Ссылка</th></tr>{facts or '<tr><td colspan="3">Подробные сведения и ограничения собраны в references/amenities-and-parking-v36.json.</td></tr>'}</table></div>
<p>В таблице приведены опубликованные сведения с указанием источника. Они не означают, что конструктивные размеры или все расположения нашей 3D-сцены подтверждены рабочей документацией.</p>
<h2>Двадцать новых изображений</h2><p>Для приложения найдены более лёгкие официальные версии двадцати загруженных рендеров. Их соответствие проверено по изображению, а опубликованные файлы — по SHA-256. Загруженные пользователем оригиналы не изменялись; исходные и рабочие хеши разделены в журнале источников. Галерея позволяет открыть официальный рендер и сравнить его с реконструкцией. Права на изображения принадлежат их авторам; они исключены из перечня наших авторских текстур.</p>
<div class="scroll"><table><tr><th>Файл</th><th>Содержание</th><th>Происхождение</th></tr>{images}</table></div>
<h2>Планировки и предел точности</h2><div class="note"><p>Рендеры показывают интерьер и стиль, но не заменяют планы помещений с размерами и однозначной привязкой к корпусам. Распределение клубных комнат, служебные проходы, часть парковочных решений и оснащение реконструированы для визуализатора. Их нельзя выдавать за утверждённый рабочий проект.</p>
<p>Прежний контур офиса №3/5 — приблизительная трассировка <a href="https://peredelkino-offices.ru/offices/3-5/">официального растрового плана 105 м² с третьего этажа</a>. Размещение фитнеса на первом этаже — новая авторская адаптация; этот растровый план не доказывает его действительное расположение там. Фасады и окружающие объёмы основной внешней модели сохраняются.</p></div>
<h2>Как посмотреть</h2><p>Обновите страницу. Откройте входную группу и выберите нужное помещение или используйте экранные действия. Оригинальные изображения доступны в галерее источников. Для просмотра первого этажа выбирайте фитнес; для нижнего уровня — паркинг. После закрытия интерьерной сцены возвращается сохранённый внешний вид.</p>
<h2>Проверки на Mac</h2><p><span class="status">{sum(counts.values())} проверок пройдено</span></p>
<div class="scroll"><table><tr><th>Область</th><th>Проверки</th><th>Результат</th></tr>{rows}</table></div>
<p>Счётчики взяты из завершённых протоколов. {assets} прежних файлов ассетов и библиотек совпадают с v35 по SHA-256. Подготовка дополнена повторными проверками установленного приложения; их отдельная квитанция входит в итоговый архив.</p>
<h2>Производительность</h2>{performance_text}
<h2>Резервные копии и происхождение</h2><p>До изменений: <code>{esc(str(base))}</code>. Полная итоговая копия: <code>{esc(str(backup))}</code>. Её создание удостоверяет BACKUP-SHA256.json; полный журнал завершения включён в архив как BACKUP-INDEX-v36-completed.json.</p>
<p>Архив изменений предназначен для полной v35 после резервного копирования. Он включает новые оригинальные референсы; большие прежние панорамы остаются в полных копиях на Mac. Временные снимки проверки и профили браузера не входят в архив.</p>
<p>Метки @r_peredelkino, исходный идентификатор RP-CONCEPT-2026-10-07 и SHA-256 фиксируют происхождение нашей разработки. Они не обеспечивают автоматический запрет редактирования сторонними ИИ.</p>
<p><small>Подготовлено: {esc(moscow.isoformat())} · UTC {esc(utc.isoformat())}</small></p></main></html>'''


def prepare(args, candidate, installed, baseline, out, expected):
    qa = candidate / 'tools/qa-v36'
    qa.mkdir(parents=True, exist_ok=True)
    checks = {n: verify_checks(out / (n + '.json'), n) for n in CHECK_NAMES}
    for name in UI_CHECK_NAMES:
        require(checks[name].get('revision') == REVISION
                and checks[name].get('base', '').rstrip('/') == args.candidate_url.rstrip('/'),
                'Browser QA did not identify the candidate v36 application: ' + name)
    counts = {n: len(report['checks']) for n, report in checks.items()}
    for name, data in checks.items():
        write_json(qa / (name + '.json'), data)
    summary = paired_performance(candidate, out, args.require_performance)
    source, source_images = reference_images(candidate)
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
    backup = installed.parent / ('RODINA-PEREDELKINO-backup-v36-' + moscow.strftime('%Y%m%d-%H%M%S'))
    require(not backup.exists(), 'Reserved final backup path already exists: ' + str(backup))
    entries = existing_backup_entries(installed.parent, baseline, expected)
    entries.append({'name': backup.name, 'path': str(backup), 'state': 'Reserved final v36 snapshot',
                    'completionEvidence': str(backup / 'BACKUP-SHA256.json')})
    write_json(candidate / 'BACKUP-INDEX-v36.json', {'revision': REVISION, 'recordedUTC': utc.isoformat(),
               'recordedMoscow': moscow.isoformat(), 'baselineBackup': str(baseline),
               'baselineVerifiedFiles': len(expected), 'releaseBackup': str(backup),
               'completionLedger': 'BACKUP-INDEX-v36-completed.json in the reviewed export', 'entries': entries})
    (candidate / 'REPORT-v36.html').write_text(report_html(baseline, backup, utc, moscow, counts, summary, len(assets), source, evidence), encoding='utf-8')
    excluded = {'ATTRIBUTION.json', 'RELEASE-v36.json'}
    files = {str(p.relative_to(candidate)): sha(p) for p in sorted(candidate.rglob('*'))
             if p.is_file() and '__pycache__' not in p.parts and str(p.relative_to(candidate)) not in excluded}
    require(set(expected).issubset(set(files) | excluded), 'No baseline file may be deleted')
    changed = {n: {'before': expected.get(n), 'after': h} for n, h in files.items() if expected.get(n) != h}
    for name in changed:
        safe_name(name)
        require(not any(part in name.lower() for part in ('chrome-', '__pycache__', 'browser-profile', 'interaction-failure', 'screenshot')),
                'Temporary or private artifact in release: ' + name)
        if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            require(name in source_images and sha(candidate / name) == source_images[name]['sha256'],
                    'Unreviewed or personal image in release: ' + name)
    release = {'revision': REVISION, 'baseRevision': BASE_REVISION, 'createdUTC': utc.isoformat(),
               'createdMoscow': moscow.isoformat(), 'author': '@r_peredelkino', 'modelId': 'RP-CONCEPT-2026-10-07',
               'baselineBackup': str(baseline), 'baselineManifestSHA256': sha(baseline / 'BACKUP-SHA256.json'),
               'baselineFileCount': len(expected), 'releaseBackup': str(backup),
               'originalAssetsUnchanged': len(assets), 'architecturalFootprintsUnchanged': True,
               'newSourceAssets': {n: {'sha256': image['sha256'],
                                     'uploadedSha256': image.get('uploadedSha256'),
                                     'rights': image.get('rights'), 'sourceUrl': image.get('sourceUrl')}
                                   for n, image in source_images.items()},
               'changedFiles': changed, 'checkCounts': counts, 'totalChecks': sum(counts.values()),
               'checks': ['tools/qa-v36/' + n + '.json' for n in CHECK_NAMES],
               'performance': 'tools/qa-v36/performance-summary.json', 'limitsFile': 'tools/reference-study-v36.md',
               'sourceStudy': SOURCE_MANIFEST, 'parkingEvidence': EVIDENCE_MANIFEST,
               'arenaPlacement': 'Preserved v35 arena registration; no new movement in v36',
               'fitnessPlan': {'unit': '3/5', 'advertisedAreaM2': 105.0, 'sourceFloor': 3,
                               'adaptedFloor': 1, 'adaptedFloorElevationScene': 0.24,
                               'status': 'Approximate raster contour; authored fitout and floor adaptation, not a confirmed developer gym floor plan'},
               'fitnessContext': {'module': 'dist/fitness-context-cut-v35.js', 'scope': 'Clone-only office0 section and local frame suppression',
                                  'exteriorUnchanged': True, 'neighbouringPodiumPreserved': True,
                                  'viewLimit': 'Street view is partial because neighbouring two-storey podium remains visible'},
               'newInteriors': 'Render-inspired authored room placements; missing working-drawing floor registration remains explicit',
               'performanceMeasured': summary.get('measured', False)}
    write_json(candidate / 'RELEASE-v36.json', release)
    subprocess.run([args.python, str(candidate / 'tools/build-provenance-v36.py')], check=True)
    print(json.dumps({'preparedRevision': REVISION, 'files': len(changed) + 2, 'checkCounts': counts,
                      'totalChecks': sum(counts.values()), 'originalAssetsPreserved': len(assets),
                      'releaseBackup': str(backup), 'createdMoscow': moscow.isoformat(), 'performance': summary}, ensure_ascii=False))


def install(candidate, installed, baseline, out, expected):
    release = load(candidate / 'RELEASE-v36.json')
    require(release.get('revision') == REVISION and release.get('baseRevision') == BASE_REVISION,
            'Prepared release has an unexpected revision')
    require(release.get('baselineManifestSHA256') == sha(baseline / 'BACKUP-SHA256.json')
            and release.get('baselineFileCount') == len(expected), 'Prepared baseline identity changed')
    names = sorted(set(release['changedFiles']) | {'RELEASE-v36.json', 'ATTRIBUTION.json'})
    for name, data in release['changedFiles'].items():
        safe_name(name)
        require(data.get('before') == expected.get(name) and sha(candidate / name) == data['after'],
                'Prepared file changed: ' + name)
    manifest = load(candidate / 'ATTRIBUTION.json')
    _, source_images = reference_images(candidate)
    require(manifest.get('version') == REVISION
            and not ({PLAN_PATH} | set(source_images)) & set(manifest.get('files', {})),
            'Authorship manifest must retain the original source image rights')
    for name, digest in manifest['files'].items():
        safe_name(name)
        require(sha(candidate / name) == digest, 'Provenance hash changed: ' + name)
    require(sha(candidate / PLAN_PATH) == PLAN_SHA256, 'Source plan image changed after review')
    for name in CHECK_NAMES:
        verify_checks(candidate / ('tools/qa-v36/' + name + '.json'), name)
    summary = load(candidate / 'tools/qa-v36/performance-summary.json')
    require(summary.get('revision') == REVISION and summary.get('baseRevision') == BASE_REVISION,
            'Performance summary belongs to another revision')
    if summary.get('measured'):
        performance(candidate / 'tools/qa-v36/performance-paired.json')
    require('dist/index.html' in names, 'Release must install its index cache revision last')
    names = [n for n in names if n != 'dist/index.html'] + ['dist/index.html']
    completed, temporaries = [], []
    try:
        for name in names:
            source, destination = candidate / name, installed / name
            require(source.is_file() and not source.is_symlink(), 'Invalid prepared source: ' + name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(destination.name + '.v36-installing-' + str(os.getpid()))
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
                temporary = destination.with_name(destination.name + '.v36-rollback-' + str(os.getpid()))
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
    parser.add_argument('--candidate', default='/tmp/rodina-v36-candidate')
    parser.add_argument('--project', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO')
    parser.add_argument('--baseline', default=None, help='Defaults to the verified backup in OUT/begin.json')
    parser.add_argument('--out', default='/tmp/rodina-qa-v36')
    parser.add_argument('--python', default='/usr/bin/python3')
    parser.add_argument('--expected-original-assets', type=int, default=1739)
    parser.add_argument('--candidate-url', default='http://127.0.0.1:8096')
    parser.add_argument('--require-performance', action='store_true')
    parser.add_argument('--instructions-reviewed', action='store_true')
    args = parser.parse_args()
    candidate, installed, out = map(lambda n: Path(getattr(args, n)).resolve(), ('candidate', 'project', 'out'))
    if args.baseline:
        baseline = Path(args.baseline).resolve()
    else:
        begin = load(out / 'begin.json')
        baseline_name = begin.get('baselineBackup', begin.get('backup', begin.get('path')))
        require(isinstance(baseline_name, str), 'begin.json does not identify the verified baseline backup')
        baseline = Path(baseline_name).resolve()
    require(candidate != installed and baseline != installed, 'Candidate and baseline must be separate from the installed project')
    expected = load(baseline / 'BACKUP-SHA256.json')['files']
    guard(installed, baseline, expected, args.instructions_reviewed)
    out.mkdir(parents=True, exist_ok=True)
    if args.install:
        install(candidate, installed, baseline, out, expected)
    else:
        prepare(args, candidate, installed, baseline, out, expected)


if __name__ == '__main__':
    main()
