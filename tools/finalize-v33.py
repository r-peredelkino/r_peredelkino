# -*- coding: utf-8 -*-
"""Prepare/review v33, then atomically install changed files against a full v32 guard."""
import argparse,datetime,hashlib,html,json,os,shutil,subprocess
from pathlib import Path
candidate=Path('/tmp/rodina-v33-candidate')
installed=Path('/Users/n1estate/Downloads/RODINA-PEREDELKINO')
base=Path('/Users/n1estate/Downloads/RODINA-PEREDELKINO-backup-v32-before-v33-20261011-193940')
qa=candidate/'tools/qa-v33'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected=json.loads((base/'BACKUP-SHA256.json').read_text())['files']
parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');args=parser.parse_args()
def guard():
 diff=[name for name,h in expected.items() if not (installed/name).is_file() or sha(installed/name)!=h]
 extra=[str(p.relative_to(installed)) for p in installed.rglob('*') if p.is_file() and str(p.relative_to(installed)) not in expected]
 assert not diff and not extra,('Project changed since verified v32 backup',diff,extra)
 for p in [installed/'AGENTS.md',installed.parent/'AGENTS.md']:
  if p.exists():raise RuntimeError('Read applicable instructions before install: '+str(p))
guard()
checks={name:json.loads((qa/(name+'.json')).read_text()) for name in ['geometry','acceptance','original-regression','tour-ui']}
assert all(c['pass'] for c in checks.values())
performance=json.loads((qa/'performance-summary.json').read_text())
assert len(json.loads((qa/'performance-paired.json').read_text())['samples'])==12
asset_names=[name for name in expected if name.startswith('dist/assets/') or name.startswith('dist/vendor/')]
assert all(sha(candidate/name)==expected[name] for name in asset_names)
assert sha(candidate/'dist/complex-footprints.js')==expected['dist/complex-footprints.js']
counts={name:len(data['checks']) for name,data in checks.items()}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
backup_name='RODINA-PEREDELKINO-backup-v33-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup_path=installed.parent/backup_name
ledger={'recordedUTC':now,'revision':33,'baselineBackup':str(base),'baselineVerifiedFiles':len(expected),'releaseBackup':str(backup_path),'releaseBackupVerification':'Must be created and SHA-256 verified after installed acceptance; BACKUP-SHA256.json is the completion evidence','entries':[{'name':p.name,'verification':'Full pre-v33 snapshot; SHA-256 matched all '+str(len(expected))+' project files' if p==base else 'Existing historical backup retained; not reverified in this revision'} for p in sorted(installed.parent.glob('RODINA-PEREDELKINO-backup-*')) if p.is_dir()]}
ledger['entries'].append({'name':backup_name,'verification':'See the completed release snapshot BACKUP-SHA256.json; directory created after installed acceptance'})
(candidate/'BACKUP-INDEX-v33.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
rows=''.join('<tr><td>'+label+'</td><td>'+format(performance[key]['beforeMeanMS'],'.2f')+'</td><td>'+format(performance[key]['afterMeanMS'],'.2f')+'</td><td>−'+format(performance[key]['frameTimeReductionPercent'],'.1f')+'%</td></tr>' for key,label in [('courtyard','Двор'),('forecourt','Променад'),('facade','Фасад офиса')])
report='''<!doctype html>
<html lang="ru">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RODINA-PEREDELKINO · v33</title>
<style>body{margin:0;background:#101813;color:#e8eee9;font:16px/1.65 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:48px 24px}small{letter-spacing:2px;color:#c9eb93}h1{font-size:38px;line-height:1.15;margin:16px 0}h2{font-size:22px;margin-top:36px}p{color:#bdc9c0}a{color:#d6ff63}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:12px;border-bottom:1px solid #344638;text-align:left}th{color:#c9eb93}code{font-size:12px;overflow-wrap:anywhere}.card{background:#1c2a20;border:1px solid #344638;border-radius:16px;padding:20px;margin:20px 0}</style>
<main>
<small>@r_peredelkino / 11 ОКТЯБРЯ 2026</small>
<h1>Родина Переделкино<br>Двор, офис и променад · v33</h1>
<p>Обновление установленной v32 по 11 присланным изображениям, пяти ракурсам исходной панорамы node3 и физическому макету из офиса продаж.</p>
<div class="card">
<ul>
<li>Детская и спортивная зоны перенесены к исходным ориентирам; овальный навес и его внутренние сиденья приведены к новой поперечной форме.</li>
<li>Посадки и дорожки используют общие плавные границы с коллизиями прогулки. 29 якорей деревьев, плотные низкие посадки, узкие дорожки и тонкие белые вставки.</li>
<li>Убраны повторявшиеся панели перед башнями и пять крупных неподтверждённых навесов/выступающих входных порталов. Входы вдоль фасада сохранены.</li>
<li>Сквозной проход 1–2 прорезан в нижнем стилобате и нижних фасадах. Верхний этаж над ним сохранён. Путь проходим в обе стороны.</li>
<li>Над коммерцией офиса — светлая озеленённая терраса, столики, зонты и отдельный пункт прогулки. Техническое оборудование исключено из занятого крыла.</li>
<li>Группа кафе у выхода освобождает проём после оценочной коррекции привязки; исходные изображения и данные сохранены.</li>
<li>Променад, два уровня витрин, башни и веер проверены в новых видах. Пять отверстий и исходные развороты архитектурных контуров сохранены.</li>
</ul>
</div>
<h2>Как посмотреть</h2>
<p>Обновите страницу проекта, откройте интерактивную 3D-карту и режим «Прогулка». Новые пункты: «Проход 1–2» и «Терраса офиса». «Оригинал» открывает исходные изображения застройщика.</p>
<h2>Проверки</h2>
<p>'''+str(sum(counts.values()))+''' проверок: геометрия и проходимость, прежние функции, панорамы, каталог планов, погода, режимы качества, шоурумы, мобильное управление и настоящая прогулка с клавиатуры. В финальных протоколах нет ошибок ресурсов или WebGL.</p>
<p>'''+str(len(asset_names))+''' прежних файлов изображений, ассетов и библиотек совпадают с полной резервной копией по SHA-256. Архитектурные контуры не изменены.</p>
<h2>Производительность на Apple M2</h2>
<p>arm64 Chrome/Node, ANGLE Metal; 1500 × 1000, DPR 1, полное качество, 15 июля / 12:00. Два парных прохода, 90 кадров на ракурс. Значения — среднее время кадра в этих условиях.</p>
<table>
<tr>
<th>Ракурс</th>
<th>v32, мс</th>
<th>v33, мс</th>
<th>Время кадра</th>
</tr>'''+rows+'''</table>
<h2>Границы точности</h2>
<p>Это реконструкция по изображениям. Номинальные GPS, высота панорамной камеры и существующая архитектурная регистрация приблизительны. Закрытые деревьями/корпусами границы, каждый куст и фонарь, отдельные блоки мощения, скрытая часть прохода, мебель и размеры террасы не подтверждены размерными рабочими чертежами. Точность каждого миллиметра и полное совпадение всех элементов не заявляются. Соседнее служебное здание, реальные технические блоки на кровле и видимая в источнике газонная решётка сохраняются.</p>
<h2>Авторство и резервные копии</h2>
<p>@r_peredelkino, идентификатор модели, дата и SHA-256 зафиксированы в проекте. Отметки сохраняются в интерфейсе, собственных геометриях, материалах и текстурах. Лицензия собственных вкладов требует разрешения автора на изменения и удаление отметок; она не является автоматическим техническим запретом для ИИ. Права на архитектуру, исходные панорамы/планы, OSM и MIT-библиотеку остаются отдельными.</p>
<p>Полный проверенный snapshot до изменения: <code>'''+html.escape(str(base))+'''</code>
</p>
<p>Полный итоговый snapshot: <code>'''+html.escape(str(backup_path))+'''</code>. Его завершение подтверждается файлом BACKUP-SHA256.json внутри этой папки. Список резервных копий — BACKUP-INDEX-v33.json.</p>
<h2>Источники и детали</h2>
<ul>
<li>
<a href="https://rodina-peredelkino.ru/genplan/">Официальный генплан</a>
</li>
<li>
<a href="https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/">Исходная панорама</a>
</li>
<li>
<a href="https://peredelkino-offices.ru/">Официальный офисный проект</a>
</li>
</ul>
<p>Имена/контрольные суммы 11 изображений, исходные ракурсы и оценочные поправки: tools/qa-v33/reference-evidence.json. Подробная сверка: tools/reference-study-v33.md. Изменения: CHANGELOG-EXTERIOR-v33.md. Архив изменений накладывается на полную v32; исходные фотоматериалы застройщика в архив изменений не дублируются.</p>
</main>
</html>'''
(candidate/'REPORT-v33.html').write_text(report)
excluded={'ATTRIBUTION.json','RELEASE-v33.json'}
files={str(p.relative_to(candidate)):sha(p) for p in candidate.rglob('*') if p.is_file() and '__pycache__' not in p.parts and str(p.relative_to(candidate)) not in excluded}
changed={name:{'before':expected.get(name),'after':h} for name,h in files.items() if expected.get(name)!=h}
release={'revision':33,'createdUTC':now,'author':'@r_peredelkino','modelId':'RP-CONCEPT-2026-10-07','baseRevision':32,'baselineBackup':str(base),'baselineManifestSHA256':sha(base/'BACKUP-SHA256.json'),'baselineFileCount':len(expected),'releaseBackup':str(backup_path),'originalAssetsUnchanged':len(asset_names),'architecturalFootprintsUnchanged':True,'changedFiles':changed,'checkCounts':counts,'limitsFile':'tools/reference-study-v33.md','checks':['tools/qa-v33/'+name+'.json' for name in checks],'performance':'tools/qa-v33/performance-summary.json'}
(candidate/'RELEASE-v33.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['/usr/bin/python3',str(candidate/'tools/build-provenance.py')],check=True)
install_names=sorted(set(changed)|{'RELEASE-v33.json','ATTRIBUTION.json'})
install_names=[n for n in install_names if n!='dist/index.html']+['dist/index.html']
if not args.install:
 print(json.dumps({'preparedRevision':33,'files':len(install_names),'checks':counts,'assetsPreserved':len(asset_names),'releaseBackup':str(backup_path)},ensure_ascii=False));raise SystemExit(0)
guard()
completed=[]
try:
 for name in install_names:
  source=candidate/name;dest=installed/name;dest.parent.mkdir(parents=True,exist_ok=True);temporary=dest.with_name(dest.name+'.v33-installing');shutil.copy2(source,temporary);os.replace(temporary,dest);completed.append(name)
 assert all(sha(installed/name)==sha(candidate/name) for name in install_names)
except Exception:
 for name in reversed(completed):
  dest=installed/name
  if name in expected:shutil.copy2(base/name,dest)
  else:dest.unlink(missing_ok=True)
 raise
Path('/tmp/rodina-qa-v33/install.json').write_text(json.dumps({'revision':33,'installedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':install_names,'sha256':{n:sha(installed/n) for n in install_names},'releaseBackup':str(backup_path)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'installedRevision':33,'changedFiles':len(install_names),'verifiedFiles':len(install_names),'releaseBackup':str(backup_path)},ensure_ascii=False))
