# -*- coding: utf-8 -*-
"""Prepare a reviewed v34 release, or install it with a complete v33 hash guard."""
import argparse,datetime,hashlib,html,json,os,shutil,subprocess
from pathlib import Path
candidate=Path('/tmp/rodina-v34-candidate')
installed=Path('/Users/n1estate/Downloads/RODINA-PEREDELKINO')
base=Path('/Users/n1estate/Downloads/RODINA-PEREDELKINO-backup-v33-before-v34-20261011-220059')
out=Path('/tmp/rodina-qa-v34');qa=candidate/'tools/qa-v34'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected=json.loads((base/'BACKUP-SHA256.json').read_text())['files']
parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');args=parser.parse_args()
def guard():
 actual={str(p.relative_to(installed)):sha(p) for p in installed.rglob('*') if p.is_file()}
 assert actual==expected,('Installed project changed since the pre-v34 backup',[n for n in set(actual)|set(expected) if actual.get(n)!=expected.get(n)])
 for parent in [installed,*installed.parents]:
  if (parent/'AGENTS.md').exists():raise RuntimeError('Read applicable instructions before installing: '+str(parent/'AGENTS.md'))
guard()
if args.install:
 release=json.loads((candidate/'RELEASE-v34.json').read_text())
 names=sorted(set(release['changedFiles'])|{'RELEASE-v34.json','ATTRIBUTION.json'})
 assert all(sha(candidate/n)==v['after'] for n,v in release['changedFiles'].items()),'Prepared files changed'
 manifest=json.loads((candidate/'ATTRIBUTION.json').read_text())
 assert manifest['version']==34 and all(sha(candidate/n)==h for n,h in manifest['files'].items())
 names=[n for n in names if n!='dist/index.html']+['dist/index.html'];completed=[]
 try:
  for n in names:
   source=candidate/n;dest=installed/n;dest.parent.mkdir(parents=True,exist_ok=True)
   temp=dest.with_name(dest.name+'.v34-installing');shutil.copy2(source,temp);os.replace(temp,dest);completed.append(n)
  assert all(sha(installed/n)==sha(candidate/n) for n in names)
 except Exception:
  for n in reversed(completed):
   if n in expected:shutil.copy2(base/n,installed/n)
   else:(installed/n).unlink(missing_ok=True)
  raise
 result={'revision':34,'installedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':names,'sha256':{n:sha(installed/n) for n in names},'releaseBackup':release['releaseBackup']}
 (out/'install.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'installedRevision':34,'verifiedFiles':len(names),'releaseBackup':release['releaseBackup']},ensure_ascii=False));raise SystemExit(0)
checks={n:json.loads((out/(n+'.json')).read_text()) for n in ['architecture-geometry','interior-cpu','cpu-activities','geometry','acceptance','interaction']}
assert all(c['pass'] and c['checks'] and all(x['pass'] for x in c['checks']) for c in checks.values()),'Required QA failed'
for n,data in checks.items():(qa/(n+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
perf=json.loads((out/'performance-paired.json').read_text());assert len(perf['samples'])==12 and not perf['errors'] and all(s['glError']==0 for s in perf['samples'])
summary={}
for action in ['courtyard','forecourt','facade']:
 means={v:sum(s['mean'] for s in perf['samples'] if s['version']==v and s['action']==action)/2 for v in [33,34]}
 summary[action]={'beforeMeanMS':means[33],'afterMeanMS':means[34],'changePercent':100*(means[34]/means[33]-1)}
(qa/'performance-paired.json').write_text(json.dumps(perf,ensure_ascii=False,indent=2)+'\n')
(qa/'performance-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
assets=[n for n in expected if n.startswith('dist/assets/') or n.startswith('dist/vendor/')]
assert all(sha(candidate/n)==expected[n] for n in assets)
for n in ['dist/complex-footprints.js','dist/public-realm-layout.js']:assert sha(candidate/n)==expected[n]
counts={n:len(c['checks']) for n,c in checks.items()}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
backup=installed.parent/('RODINA-PEREDELKINO-backup-v34-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
ledger={'recordedUTC':now,'revision':34,'baselineBackup':str(base),'baselineVerifiedFiles':len(expected),'releaseBackup':str(backup),'releaseBackupVerification':'Full snapshot is created after installed acceptance; BACKUP-SHA256.json inside that directory is the completion evidence','entries':[{'name':p.name,'verification':'All '+str(len(expected))+' baseline files verified with SHA-256' if p==base else 'Existing historical backup retained; not reverified in v34'} for p in sorted(installed.parent.glob('RODINA-PEREDELKINO-backup-*')) if p.is_dir()]}
ledger['entries'].append({'name':backup.name,'verification':'Final v34 snapshot; see its BACKUP-SHA256.json'})
(candidate/'BACKUP-INDEX-v34.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
rows=''.join('<tr><td>'+label+'</td><td>'+format(summary[key]['beforeMeanMS'],'.2f')+'</td><td>'+format(summary[key]['afterMeanMS'],'.2f')+'</td><td>'+format(summary[key]['changePercent'],'+.1f')+'%</td></tr>' for key,label in [('courtyard','Двор'),('forecourt','Променад'),('facade','Фасад офиса')])
checkrows=''.join('<tr><td>'+label+'</td><td>'+str(counts[key])+'</td><td>Пройдено</td></tr>' for key,label in [('architecture-geometry','Примыкание арены, верхний веер и исходные фасады'),('interior-cpu','Проходимость и геометрия новых интерьеров'),('cpu-activities','Таймеры, клавиатура и жизненный цикл игр'),('geometry','Прежние дорожки, проход 1–2 и терраса'),('acceptance','Прежние функции и источники'),('interaction','Входы, игры, камера и мобильное управление')])
report='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RODINA-PEREDELKINO · v34</title><style>body{margin:0;background:#111b19;color:#e8efea;font:16px/1.65 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:44px 24px}small{color:#9accc3;letter-spacing:2px}h1{font-size:38px;line-height:1.15}h2{font-size:23px;margin-top:32px}p{color:#c1cec8}a{color:#a8e4d9}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:11px;border-bottom:1px solid #344740;text-align:left}code{font-size:12px;overflow-wrap:anywhere}.card{padding:18px 22px;border:1px solid #344740;border-radius:16px;background:#1b2c26}.scroll{overflow-x:auto}</style><main><small>@r_peredelkino / 11 ОКТЯБРЯ 2026</small><h1>Переделкино · v34<br>Кибердвор и входы</h1><p>Дополнение установленной v33 по десяти новым изображениям. Озеленение, архитектурные контуры башен и нижние фасады сохранены. Новая мебель и внутренние пространства — авторское предложение для интерактивной модели.</p><div class="card"><ul><li>Три изогнутые скамьи из дерева и светлого минерального материала: «Орбита», «Команда», «Пауза». Можно сесть, осмотреться и встать.</li><li>Два командных стола и стойка реакции у арены. Игры «Командная память» и «Световая реакция»: последовательности, пять сигналов, проверка фальстарта и личный рекорд в браузере.</li><li>Отключаемый авторский слой двора и режим «Вечер турнира». При выключении мебели её коллизии тоже выключаются.</li><li>11 переходов из прогулки: подъезды корпусов 1–5, офисный центр, офис продаж, три магазина и киберарена. После выхода восстанавливаются место и направление взгляда.</li><li>В первом подъезде лифт открывает уже существующие виды со 2-го и 30-го этажей. Магазин сохранил два уровня и лестницу. В арене доступны рабочие места комментаторов и переключение режимов экранов.</li><li>Зазор второго яруса у арены устранён по фактическому круглому профилю оболочки. Крайние верхние витрины сохранены частично. Нижние 248 витрин и 48 дверей не перепланировались.</li><li>Кромка и подсветка верхнего веера между корпусами 4–5 следуют исходному контуру. Убраны восемь вырожденных треугольников, все пять архитектурных отверстий сохранены.</li></ul></div><h2>Как посмотреть</h2><p>Обновите страницу проекта и откройте «Кибердвор» или «Прогулка». Список «Входы и места» переносит к нужной точке. Клавиша E или кнопка действия открывает помещение, игру или посадку на скамью. Esc поднимает со скамьи; следующее отдельное нажатие завершает прогулку. Свет можно переключать на день, вечер и ночь. «Авторский двор · выкл» позволяет сравнить результат с прежним двором.</p><h2>Проверки</h2><p>'''+str(sum(counts.values()))+''' проверок на реальном Mac, включая настоящие события клавиатуры, таймеры игр, коллизии, возврат камеры, мобильный экран и освобождение ресурсов. Подробные протоколы приложены к проекту. Итоговая установленная версия дополнительно проверяется перед резервным копированием.</p><div class="scroll"><table><tr><th>Область</th><th>Проверки</th><th>Результат</th></tr>'''+checkrows+'''</table></div><p>'''+str(len(assets))+''' прежних файлов ассетов, исходных изображений и библиотек совпадают с полной копией v33 по SHA-256.</p><h2>Производительность · Apple M2</h2><p>Chrome и Node arm64, ANGLE Metal; 1500 × 1000, DPR 1, полное качество, 15 июля / 12:00. Два парных прохода, по 90 кадров на ракурс; ниже среднее время кадра. Это измерение в указанных условиях, а не гарантия частоты кадров на всех устройствах.</p><div class="scroll"><table><tr><th>Ракурс</th><th>v33, мс</th><th>v34, мс</th><th>Изменение</th></tr>'''+rows+'''</table></div><h2>Точность и авторский вклад</h2><p>Мебель и внутренние пространства не представлены как утверждённый проект застройщика. Входы связаны с существующими дверями модели; интерьеры открываются отдельными шоурумами. У корпуса 1 переход доступен с дорожки примерно в 5 м перед дверью: прежняя посадочная полоса сохранена. Это виртуальный вход, не новый физический проход через клумбу.</p><p>Реконструкция по изображениям не подтверждает размеры каждого куста, блока мощения или скрытого элемента. Миллиметровое совпадение с будущим построенным комплексом не заявляется. Названия, авторский идентификатор, дата и SHA-256 сохранены; метки не создают автоматического запрета на редактирование для любых ИИ. Права на архитектуру, исходные фотографии, OSM и сторонние библиотеки остаются отдельными.</p><h2>Резервные копии и источники</h2><p>Полная проверенная копия до работы: <code>'''+html.escape(str(base))+'''</code>.</p><p>Полная итоговая копия: <code>'''+html.escape(str(backup))+'''</code>. Факт её завершения подтверждает BACKUP-SHA256.json внутри папки. Список — BACKUP-INDEX-v34.json.</p><p><a href="https://rodina-peredelkino.ru/genplan/">Официальный генплан</a> · <a href="https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/">Исходная панорама</a> · <a href="https://peredelkino-offices.ru/">Офисный проект</a>. История сверки: tools/reference-study-v33.md и tools/reference-study-v34.md. Имена и хеши десяти новых изображений: tools/qa-v34/new-reference-evidence.json.</p><p>Архив изменений применяется поверх полной v33 после резервного копирования. Он содержит код, протоколы и манифест; исходные большие изображения в архиве не дублируются.</p></main></html>'''
(candidate/'REPORT-v34.html').write_text(report)
excluded={'ATTRIBUTION.json','RELEASE-v34.json'}
files={str(p.relative_to(candidate)):sha(p) for p in candidate.rglob('*') if p.is_file() and '__pycache__' not in p.parts and str(p.relative_to(candidate)) not in excluded}
assert set(expected).issubset(set(files)|excluded),'No baseline file may be deleted'
changed={n:{'before':expected.get(n),'after':h} for n,h in files.items() if expected.get(n)!=h}
assert not any('chrome-' in n or '__pycache__' in n or n.endswith('.png') for n in changed)
release={'revision':34,'createdUTC':now,'author':'@r_peredelkino','modelId':'RP-CONCEPT-2026-10-07','baseRevision':33,'baselineBackup':str(base),'baselineManifestSHA256':sha(base/'BACKUP-SHA256.json'),'baselineFileCount':len(expected),'releaseBackup':str(backup),'originalAssetsUnchanged':len(assets),'architecturalFootprintsUnchanged':True,'changedFiles':changed,'checkCounts':counts,'checks':['tools/qa-v34/'+n+'.json' for n in checks],'performance':'tools/qa-v34/performance-summary.json','limitsFile':'tools/reference-study-v34.md','newCourtAndInteriors':'Optional authored concept; not developer execution documentation'}
(candidate/'RELEASE-v34.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
subprocess.run(['/usr/bin/python3',str(candidate/'tools/build-provenance.py')],check=True)
print(json.dumps({'preparedRevision':34,'files':len(changed)+2,'checks':counts,'assetsPreserved':len(assets),'releaseBackup':str(backup),'performance':summary},ensure_ascii=False))
