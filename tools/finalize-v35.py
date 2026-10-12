#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepare v35 after native QA, or atomically install the prepared files.

No command is executed on import. The complete installed project and its
pre-v35 snapshot must both match the recorded baseline before either action.
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

REVISION = 35
BASE_REVISION = 34
CHECK_NAMES = (
    'architecture-geometry', 'fitness-cpu', 'fitness-context-cpu', 'garden-cpu', 'geometry',
    'acceptance', 'interaction', 'cpu-activities',
)
PLAN_PATH = 'dist/assets/reference-office-v35/office-3-5-plan.png'
PLAN_SHA256 = '70642a16e21b15e0b1820607bdab0a0454022a8502f9fe43a394c89d0ee85296'
LABELS = {
    'architecture-geometry': 'Арена, сопряжения и исходная архитектура',
    'fitness-cpu': 'Контур фитнеса, оборудование и проходимость',
    'fitness-context-cpu': 'Вид из фитнеса и сохранение соседнего стилобата',
    'garden-cpu': 'Озеленение, арт-объект и ресторанная терраса',
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


def guard(installed, baseline, expected, instructions_reviewed=False):
    for name in expected:
        safe_name(name)
    baseline_actual = {n: sha(baseline / n) for n in expected if (baseline / n).is_file()}
    require(baseline_actual == expected, 'Pre-v35 snapshot no longer matches its SHA-256 manifest')
    actual = snapshot(installed)
    differences = sorted(n for n in set(actual) | set(expected) if actual.get(n) != expected.get(n))
    require(actual == expected, 'Installed project changed since the pre-v35 backup: ' + repr(differences))
    if not instructions_reviewed:
        instructions = [str(p / 'AGENTS.md') for p in [installed, *installed.parents]
                        if (p / 'AGENTS.md').exists()]
        require(not instructions, 'Read applicable instructions, then use --instructions-reviewed: ' + repr(instructions))


def performance(path):
    data = load(path)
    samples = data.get('samples', [])
    require(data.get('pass') is True and len(samples) == 12 and not data.get('errors')
            and not data.get('resources'), 'Paired v34/v35 performance run is incomplete or failed')
    require(data.get('nodeArchitecture') == 'arm64', 'Performance run must use native ARM64 Node')
    method = data.get('method', {})
    require(method.get('viewport') == [1500, 1000] and method.get('dpr') == 1
            and method.get('pairedRepeats') == 2 and method.get('framesPerView') == 90
            and method.get('quality') == 'full' and method.get('order') == [34, 35, 34, 35],
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
        item = {'name': folder.name, 'path': str(folder), 'state': 'Historical snapshot retained; not rehashed in v35'}
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


def report_html(base, backup, utc, moscow, counts, summary, assets):
    esc = html.escape
    checks = ''.join('<tr><td>' + LABELS[n] + '</td><td>' + str(counts[n]) + '</td><td>Пройдено</td></tr>'
                     for n in CHECK_NAMES)
    perf = ''.join('<tr><td>' + label + '</td><td>' + format(summary[key]['beforeMeanMS'], '.2f')
                   + '</td><td>' + format(summary[key]['afterMeanMS'], '.2f') + '</td><td>'
                   + format(summary[key]['changePercent'], '+.1f') + '%</td></tr>'
                   for key, label in [('courtyard', 'Двор'), ('forecourt', 'Променад'), ('facade', 'Офис')])
    return '''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RODINA-PEREDELKINO · v35</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101a18;color:#eef3ed;font:16px/1.65 system-ui,sans-serif}
main{max-width:940px;margin:auto;padding:48px 24px 64px}small,.eyebrow{color:#92c8b9;font-size:12px;letter-spacing:2px}
h1{font-size:clamp(32px,5vw,48px);line-height:1.12;letter-spacing:-1.3px;margin:16px 0 24px}h2{font-size:23px;margin:32px 0 12px}
p{color:#becdc5}a{color:#b5e7ce;text-underline-offset:3px}code{font-size:12px;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{padding:22px;border:1px solid #344a3e;border-radius:18px;background:#192b23}.card h2{margin:0 0 10px;font-size:21px}.card p{margin:0}
.status{display:inline-block;padding:5px 12px;border-radius:30px;background:#264536;color:#bfeacd;font-size:13px}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px 10px;border-bottom:1px solid #34483c;text-align:left}th{color:#a5c2b3}
li{margin:6px 0}.note{padding-left:18px;border-left:2px solid #c8b27a}@media(max-width:620px){main{padding:30px 18px}.grid{grid-template-columns:1fr}}</style>
<main><small>@r_peredelkino / ''' + esc(moscow.strftime('%d.%m.%Y')) + ''' / v35</small>
<h1>Переделкино<br>Живой сад · арена · фитнес</h1>
<p>Дополнение к v34: корректировка положения арены по новому сравнению, более насыщенное озеленение и новые способы пользоваться двором и офисной террасой. Исходные контуры башен, веера и дорожек сохранены.</p>
<div class="grid"><section class="card"><h2>Арена снаружи</h2><p>Капсула выдвинута к внешнему углу стилобата на 8,4 единицы сцены по направлению двух торговых крыльев. Нижние и верхние сопряжения, остекление, освещение и коллизии используют единый центр. Размер и форма капсулы сохранены.</p></section>
<section class="card"><h2>Живой авторский двор</h2><p>В существующих посадках добавлены злаки, низкая листва, цветущие многолетники и мягкое движение. Кинетический объект «Дыхание сада» меняет характер движения. Прежние клумбы и мощение сохранены; новые элементы можно отключить.</p></section>
<section class="card"><h2>Ресторанная терраса</h2><p>На существующей террасе офиса — сервировка, новые многолетники в прежних посадочных карманах и регулируемый ламельный навес. Можно выбрать вид с места гостя, открыть концепцию меню и настроить тень.</p></section>
<section class="card"><h2>Фитнес · второй этаж</h2><p>Прогулочный шоурум с кардио, силовыми рамами, свободными весами, функциональной зоной и сервисными помещениями. Узлы авторских тренажёров анимируются; параметры меняют демонстрацию, без расчёта реальных медицинских показателей.</p></section></div>
<h2>Планировка и источники</h2><p>Для фитнеса изучена <a href="https://peredelkino-offices.ru/offices/3-5/">официальная планировка офиса №3/5</a>: 105 м², исходный третий этаж; основной зал 85 м² и сервисные помещения 8,4 / 7,6 / 4,0 м². Контур сохранён как приблизительная трассировка растрового плана с масштабом по рекламной площади. Перенос на второй этаж и оснащение — авторская адаптация по запросу пользователя.</p>
<p>Визуальные принципы тренировочных зон изучены по <a href="https://lomovgym.ru/lomov-gym/about/">LOMOV Gym</a> и <a href="https://lomovgym.ru/lomov-gym/zones/">официальным фотографиям зон</a>. Зоны и модели созданы для нашего проекта; логотипы и фирменные тренажёры клуба не копируются. Идеи технологичного благоустройства рассмотрены по <a href="https://bigd.es/en/mas-proyectos/dubai-smart-palm/">Dubai Smart Palm</a> и <a href="https://www.ahr.co.uk/projects/al-bahr-towers">адаптивным солнцезащитным элементам Al Bahr Towers в Абу-Даби</a>.</p>
<p>В фитнес-шоуруме исправлено перекрытие обзора непрозрачным объёмом самого офиса. Окружение подготавливается отдельно для этой внутренней сцены; внешняя модель сохраняется. Соседний двухэтажный стилобат остаётся на месте, поэтому вид улицы со второго этажа местами перекрыт реальным соседним объёмом — полностью свободная панорама не обещается.</p>
<h2>Как посмотреть</h2><p>Обновите страницу и откройте прогулку. Выбирайте места в списке и используйте E или экранную кнопку действия. Внешняя позиция и направление взгляда сохраняются после возвращения из шоурума. Новые действия доступны у арт-объекта, тренажёров и на ресторанной террасе. Управление авторским слоем позволяет сравнить дополнение с исходным двором.</p>
<h2>Проверки на вашем Mac</h2><p><span class="status">''' + str(sum(counts.values())) + ''' проверок пройдено</span></p>
<div class="scroll"><table><tr><th>Область</th><th>Проверки</th><th>Результат</th></tr>''' + checks + '''</table></div>
<p>Количество взято из завершённых протоколов, а не из плана работ. ''' + str(assets) + ''' прежних файлов ассетов и библиотек совпадают с v34 по SHA-256. Новый исходный PNG планировки отдельно отмечен как материал застройщика. После установки требуется повторная проверка основного локального адреса; её завершение удостоверяется в итоговой копии.</p>
<h2>Производительность · Apple M2</h2><p>Нативные Chrome и Node ARM64; полное качество, 1500 × 1000, DPR 1, 15 июля / 12:00. Два парных прохода v34/v35, три ракурса по 90 кадров — 12 выборок. В таблице среднее время кадра; отрицательное изменение означает меньшее время.</p>
<div class="scroll"><table><tr><th>Ракурс</th><th>v34, мс</th><th>v35, мс</th><th>Изменение</th></tr>''' + perf + '''</table></div>
<p>Измерение относится к этим условиям и не гарантирует ту же частоту кадров на других устройствах.</p>
<h2>Предел точности</h2><div class="note"><p>Сдвиг арены — визуальная регистрация по изображениям с разными ракурсами, не обмерный размер. Отметки, скрытые конструкции, отдельные растения и каждый блок мощения не подтверждены рабочей документацией. Фитнес, оборудование, ресторанная сервировка, новый навес и арт-объект — авторские концепции; они не объявляются утверждёнными обещаниями застройщика.</p></div>
<p>Исходные планы и фотографии сохраняют права своих авторов. Метки @r_peredelkino и SHA-256 фиксируют происхождение нашей разработки, но не гарантируют запрет редактирования сторонними ИИ. Реконструкция не заменяет конструктивный расчёт фитнес-оборудования или проект террасы.</p>
<h2>Резервные копии</h2><p>До изменений: <code>''' + esc(str(base)) + '''</code>.</p>
<p>Итоговая полная копия: <code>''' + esc(str(backup)) + '''</code>. Подтверждение создания — её BACKUP-SHA256.json. Полный журнал завершения входит в архив как BACKUP-INDEX-v35-completed.json.</p>
<p>Архив изменений применяется поверх полной v34 после резервного копирования. Большие исходные панорамы сохраняются в полных копиях на Mac. Временные изображения проверки и пользовательские снимки рабочего стола в архив не входят.</p>
<p class="eyebrow">Подготовлено: ''' + esc(moscow.isoformat()) + ''' · UTC ''' + esc(utc.isoformat()) + '''</p></main></html>'''


def prepare(args, candidate, installed, baseline, out, expected):
    qa = candidate / 'tools/qa-v35'
    qa.mkdir(parents=True, exist_ok=True)
    checks = {n: verify_checks(out / (n + '.json'), n) for n in CHECK_NAMES}
    counts = {n: len(report['checks']) for n, report in checks.items()}
    for name, data in checks.items():
        write_json(qa / (name + '.json'), data)
    perf, summary = performance(out / 'performance-paired.json')
    write_json(qa / 'performance-paired.json', perf)
    write_json(qa / 'performance-summary.json', summary)
    assets = sorted(n for n in expected if n.startswith(('dist/assets/', 'dist/vendor/')))
    require(len(assets) == args.expected_original_assets,
            'Original asset count differs from the reviewed baseline: ' + str(len(assets)))
    require(all((candidate / n).is_file() and sha(candidate / n) == expected[n] for n in assets),
            'An original image, asset or vendor file changed')
    for name in ('dist/complex-footprints.js', 'dist/public-realm-layout.js'):
        require(sha(candidate / name) == expected[name], 'Source layout changed: ' + name)
    require(sha(candidate / PLAN_PATH) == PLAN_SHA256, 'Source office-plan PNG changed')
    utc, moscow = clock()
    backup = installed.parent / ('RODINA-PEREDELKINO-backup-v35-' + moscow.strftime('%Y%m%d-%H%M%S'))
    require(not backup.exists(), 'Reserved final backup path already exists: ' + str(backup))
    entries = existing_backup_entries(installed.parent, baseline, expected)
    entries.append({'name': backup.name, 'path': str(backup), 'state': 'Reserved final v35 snapshot',
                    'completionEvidence': str(backup / 'BACKUP-SHA256.json')})
    write_json(candidate / 'BACKUP-INDEX-v35.json', {'revision': REVISION, 'recordedUTC': utc.isoformat(),
               'recordedMoscow': moscow.isoformat(), 'baselineBackup': str(baseline),
               'baselineVerifiedFiles': len(expected), 'releaseBackup': str(backup),
               'completionLedger': 'BACKUP-INDEX-v35-completed.json in the reviewed export', 'entries': entries})
    (candidate / 'REPORT-v35.html').write_text(report_html(baseline, backup, utc, moscow, counts, summary, len(assets)), encoding='utf-8')
    excluded = {'ATTRIBUTION.json', 'RELEASE-v35.json'}
    files = {str(p.relative_to(candidate)): sha(p) for p in sorted(candidate.rglob('*'))
             if p.is_file() and '__pycache__' not in p.parts and str(p.relative_to(candidate)) not in excluded}
    require(set(expected).issubset(set(files) | excluded), 'No baseline file may be deleted')
    changed = {n: {'before': expected.get(n), 'after': h} for n, h in files.items() if expected.get(n) != h}
    for name in changed:
        safe_name(name)
        require(not any(part in name.lower() for part in ('chrome-', '__pycache__', 'browser-profile', 'interaction-failure', 'screenshot')),
                'Temporary or private artifact in release: ' + name)
        if name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            require(name == PLAN_PATH and sha(candidate / name) == PLAN_SHA256,
                    'Unreviewed or personal image in release: ' + name)
    release = {'revision': REVISION, 'baseRevision': BASE_REVISION, 'createdUTC': utc.isoformat(),
               'createdMoscow': moscow.isoformat(), 'author': '@r_peredelkino', 'modelId': 'RP-CONCEPT-2026-10-07',
               'baselineBackup': str(baseline), 'baselineManifestSHA256': sha(baseline / 'BACKUP-SHA256.json'),
               'baselineFileCount': len(expected), 'releaseBackup': str(backup),
               'originalAssetsUnchanged': len(assets), 'architecturalFootprintsUnchanged': True,
               'newSourceAssets': {PLAN_PATH: {'sha256': PLAN_SHA256, 'rights': 'Official developer reference; not authored by us',
                                             'url': 'https://peredelkino-offices.ru/!upload/t_lots/4d71f717a5c5ec3e31cabbda6c588b44.png'}},
               'changedFiles': changed, 'checkCounts': counts, 'totalChecks': sum(counts.values()),
               'checks': ['tools/qa-v35/' + n + '.json' for n in CHECK_NAMES],
               'performance': 'tools/qa-v35/performance-summary.json', 'limitsFile': 'tools/reference-study-v35.md',
               'sourceStudy': 'references/source-office-and-gym-v35.json',
               'arenaVisualRegistration': {'distanceSceneUnits': 8.4, 'method': 'Outward bisector of two retained retail wings',
                                           'magnitudeStatus': 'Visual estimate from differing camera views, not a measured dimension'},
               'fitnessPlan': {'unit': '3/5', 'advertisedAreaM2': 105.0, 'sourceFloor': 3, 'adaptedFloor': 2,
                               'status': 'Approximate raster contour, source scale1; authored fitout and floor adaptation'},
               'fitnessContext': {'module': 'dist/fitness-context-cut-v35.js', 'scope': 'Clone-only office0 section and local frame suppression',
                                  'exteriorUnchanged': True, 'neighbouringPodiumPreserved': True,
                                  'viewLimit': 'Street view is partial because neighbouring two-storey podium remains visible'},
               'newCourtAndInteriors': 'Optional authored concepts; not developer execution documentation'}
    write_json(candidate / 'RELEASE-v35.json', release)
    subprocess.run([args.python, str(candidate / 'tools/build-provenance.py')], check=True)
    print(json.dumps({'preparedRevision': REVISION, 'files': len(changed) + 2, 'checkCounts': counts,
                      'totalChecks': sum(counts.values()), 'originalAssetsPreserved': len(assets),
                      'releaseBackup': str(backup), 'createdMoscow': moscow.isoformat(), 'performance': summary}, ensure_ascii=False))


def install(candidate, installed, baseline, out, expected):
    release = load(candidate / 'RELEASE-v35.json')
    require(release.get('revision') == REVISION and release.get('baseRevision') == BASE_REVISION,
            'Prepared release has an unexpected revision')
    require(release.get('baselineManifestSHA256') == sha(baseline / 'BACKUP-SHA256.json')
            and release.get('baselineFileCount') == len(expected), 'Prepared baseline identity changed')
    names = sorted(set(release['changedFiles']) | {'RELEASE-v35.json', 'ATTRIBUTION.json'})
    for name, data in release['changedFiles'].items():
        safe_name(name)
        require(data.get('before') == expected.get(name) and sha(candidate / name) == data['after'],
                'Prepared file changed: ' + name)
    manifest = load(candidate / 'ATTRIBUTION.json')
    require(manifest.get('version') == REVISION and PLAN_PATH not in manifest.get('files', {}),
            'Authorship manifest must retain the original source image rights')
    for name, digest in manifest['files'].items():
        safe_name(name)
        require(sha(candidate / name) == digest, 'Provenance hash changed: ' + name)
    require(sha(candidate / PLAN_PATH) == PLAN_SHA256, 'Source plan image changed after review')
    for name in CHECK_NAMES:
        verify_checks(candidate / ('tools/qa-v35/' + name + '.json'), name)
    performance(candidate / 'tools/qa-v35/performance-paired.json')
    require('dist/index.html' in names, 'Release must install its index cache revision last')
    names = [n for n in names if n != 'dist/index.html'] + ['dist/index.html']
    completed, temporaries = [], []
    try:
        for name in names:
            source, destination = candidate / name, installed / name
            require(source.is_file() and not source.is_symlink(), 'Invalid prepared source: ' + name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(destination.name + '.v35-installing-' + str(os.getpid()))
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
                temporary = destination.with_name(destination.name + '.v35-rollback-' + str(os.getpid()))
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
    parser.add_argument('--candidate', default='/tmp/rodina-v35-candidate')
    parser.add_argument('--project', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO')
    parser.add_argument('--baseline', default='/Users/n1estate/Downloads/RODINA-PEREDELKINO-backup-v34-before-v35-20261011-235859')
    parser.add_argument('--out', default='/tmp/rodina-qa-v35')
    parser.add_argument('--python', default='/usr/bin/python3')
    parser.add_argument('--expected-original-assets', type=int, default=1738)
    parser.add_argument('--instructions-reviewed', action='store_true')
    args = parser.parse_args()
    candidate, installed, baseline, out = map(lambda n: Path(getattr(args, n)).resolve(), ('candidate', 'project', 'baseline', 'out'))
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
