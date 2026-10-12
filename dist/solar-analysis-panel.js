import {stampGeometry} from './baked-authorship.js?v=community38';
import {attribution} from './attribution.js?v=community38';
import * as THREE from './vendor/three.module.js';
import {createSolarExposure} from './solar-exposure.js?v=community38';
import {timeLabel,daylight} from './solar.js?v=community38';

const hoursText=minutes=>{const value=Math.round(minutes);return `${Math.floor(value/60)} ч ${value%60} мин`};

// A point query uses structural triangles, independently of the visual shadow
// map resolution. All times are Moscow civil time, shared with the 3D light.
export function createSolarAnalysisPanel({panel,scene,model,canvas,getCamera,getSnapshot,setDate}){
 const element=document.createElement('section');element.className='env-analysis';
 element.innerHTML=`<h3>Прямое солнце в выбранной точке</h3>
  <p>Выберите поверхность здания или место на участке. Можно посмотреть выбранный день и сравнить месяцы.</p>
  <div class="env-analysis-actions"><button type="button" data-solar-pick aria-pressed="false">Выбрать точку на 3D-карте</button><button type="button" data-solar-clear hidden>Убрать точку</button></div>
  <p class="env-point-name" data-point-name>Точка ещё не выбрана.</p>
  <p class="env-point-status" data-point-status role="status"></p>
  <div class="env-analysis-actions"><button type="button" data-solar-day disabled>Рассчитать день</button><button type="button" data-solar-year disabled>Сравнить 12 месяцев</button><button type="button" data-solar-cancel hidden>Отменить расчёт</button></div>
  <p data-solar-progress role="status" aria-live="polite"></p>
  <div data-solar-day-result hidden></div><div data-solar-year-result hidden></div>
  <p class="env-solar-note">Учитываются непрозрачные объёмы зданий этой 3D-модели, в том числе скрытое окружение. Расчёт — для ясного неба, без деревьев и рельефа. Это оценка по реконструкции, а не нормативный расчёт инсоляции квартиры.</p>`;
 panel.querySelector('.env-reference-links').before(element);
 const $=selector=>element.querySelector(selector),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.6,14,10),new THREE.MeshBasicMaterial({color:0xffda78,depthTest:false,depthWrite:false}));
 stampGeometry(marker.geometry,{label:'solar-analysis-point'});marker.material.userData.attribution={...attribution};marker.userData.attribution={...attribution};marker.name='Selected sunlight analysis point';marker.userData.excludeFromSolarShadow=true;marker.renderOrder=10000;marker.visible=false;scene.add(marker);
 const banner=document.createElement('div');banner.className='solar-pick-banner';banner.hidden=true;banner.innerHTML='<span>Выберите поверхность здания или место на участке.</span><button type="button">Отмена</button>';canvas.parentElement.append(banner);
 let engine=null,selected=null,selecting=false,selectionCallback=null,down=null,job=null,dead=false,lastStatusKey='',latestDay=null,latestYear=null,sequence=0,jobDay=null;
 const ready=()=>engine??=(createSolarExposure(model));
 const busy=value=>{element.toggleAttribute('aria-busy',value);$('[data-solar-cancel]').hidden=!value;$('[data-solar-day]').disabled=value||!selected;$('[data-solar-year]').disabled=value||!selected;};
 function cancel(){sequence++;job?.abort();job=null;jobDay=null;busy(false);}
 function selectionMode(value){selecting=!!value;banner.hidden=!selecting;canvas.classList.toggle('solar-picking',selecting);canvas.dataset.solarPicking=String(selecting);$('[data-solar-pick]').setAttribute('aria-pressed',String(selecting));$('[data-solar-pick]').textContent=selecting?'Отменить выбор точки':'Выбрать точку на 3D-карте';selectionCallback?.(selecting);if(selecting)canvas.scrollIntoView({block:'center',behavior:'instant'});}
 function clearResults(){latestDay=latestYear=null;$('[data-solar-day-result]').hidden=true;$('[data-solar-year-result]').hidden=true;$('[data-solar-progress]').textContent='';}
 function selectPoint(hit){
  if(!hit?.point?.every(Number.isFinite))throw new TypeError('A finite surface point is required');
  cancel();selectionMode(false);selected={...hit,point:hit.point.slice()};clearResults();lastStatusKey='';
  marker.position.fromArray(hit.point);if(hit.normal)marker.position.addScaledVector(new THREE.Vector3(...hit.normal),.06);marker.visible=true;
  $('[data-point-name]').textContent=hit.fallbackGround?'Точка на условной плоскости участка':`Поверхность: ${hit.category||hit.objectName||'здание'}`;
  $('[data-solar-clear]').hidden=false;busy(false);update(getSnapshot());return selected;
 }
 function clear(){cancel();selectionMode(false);selected=null;marker.visible=false;clearResults();$('[data-point-name]').textContent='Точка ещё не выбрана.';$('[data-point-status]').textContent='';$('[data-solar-clear]').hidden=true;busy(false);}
 function dayMarkup(result){
  const dl=daylight(result.day),sunBars=result.intervals.map(({start,end})=>`<rect x="${start/4}" y="8" width="${(end-start)/4}" height="20" rx="1" fill="#f4c66e"/>`).join('');
  const skyBar=dl.rise===null?'':`<rect x="${dl.rise/4}" y="8" width="${(dl.set-dl.rise)/4}" height="20" fill="#46556b"/>`;
  const ticks=[0,6,12,18,24].map(hour=>`<text x="${hour*15}" y="48" text-anchor="${hour===0?'start':hour===24?'end':'middle'}">${String(hour).padStart(2,'0')}:00</text>`).join('');
  return `<h4>${result.day.split('-').reverse().join('.')} · около ${hoursText(result.sunlightMinutes)}</h4>
   <svg class="env-sunlight-chart" data-sunlight-chart viewBox="0 0 360 54" role="img" aria-label="Прямое солнце в течение суток. Золотые отрезки — солнце, серые — нет прямого солнца, тёмные — ночь."><rect x="0" y="8" width="360" height="20" rx="3" fill="#182435"/>${skyBar}${sunBars}${ticks}</svg>
   <p class="env-chart-key">Золотой — прямое солнце · серый — нет прямого солнца · тёмный — ночь. Нажмите на шкалу, чтобы изменить время в 3D.</p>
   <p>${result.intervals.length?result.intervals.map(({start,end})=>`${timeLabel(start)}–${timeLabel(end)}`).join(' · '):'Прямого солнца в этой точке за выбранный день не найдено.'}</p>
   <p class="env-solar-note">Проверка через ${result.stepMinutes} мин, уточнение найденных границ до 30 с. Короткие интервалы между пробами могут быть пропущены.</p>`;
 }
 function showDay(result){
  latestDay=result;const host=$('[data-solar-day-result]');host.innerHTML=dayMarkup(result);host.hidden=false;
  host.querySelector('[data-sunlight-chart]').onclick=e=>{const bounds=e.currentTarget.getBoundingClientRect(),minutes=Math.round(1440*Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)));setDate(result.day,Math.min(1439,minutes));};
  const chart=host.querySelector('[data-sunlight-chart]');chart.tabIndex=0;chart.setAttribute('role','slider');chart.setAttribute('aria-label','Время в 3D, минуты московских суток');chart.setAttribute('aria-valuemin','0');chart.setAttribute('aria-valuemax','1439');chart.setAttribute('aria-valuenow',String(getSnapshot().parts.minutes));chart.setAttribute('aria-valuetext',getSnapshot().parts.time);
  chart.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const value=e.key==='Home'?0:e.key==='End'?1439:Math.max(0,Math.min(1439,getSnapshot().parts.minutes+(e.key==='ArrowRight'?5:-5)));setDate(result.day,value);};
  element.dataset.sunlightDay=result.day;element.dataset.sunlightMinutes=String(result.sunlightMinutes);
 }
 function showYear(result){
  latestYear=result;const host=$('[data-solar-year-result]');
  host.innerHTML=`<h4>${result.year} · сравнение 12 дней</h4><p>По ${result.requestedDayOfMonth}-му числу каждого месяца; если такого числа нет, взят последний день. Это часы за выбранный день, не сумма за месяц.</p><table class="env-month-results"><thead><tr><th>Дата</th><th>Прямое солнце</th></tr></thead><tbody>${result.months.map((m,i)=>`<tr><th><button type="button" data-result-month="${i}">${m.day.slice(8,10)}.${m.day.slice(5,7)}</button></th><td><span class="env-month-bar"><i style="width:${m.sunlightMinutes/1440*100}%"></i></span><span>${hoursText(m.sunlightMinutes)}</span></td></tr>`).join('')}</tbody></table><p class="env-solar-note">Шаг проверки — 10 минут. Выберите строку, чтобы увидеть этот день в 3D и на шкале.</p>`;
  host.hidden=false;for(const b of host.querySelectorAll('[data-result-month]'))b.onclick=()=>{const resultDay=result.months[Number(b.dataset.resultMonth)];setDate(resultDay.day,getSnapshot().parts.minutes);showDay(resultDay);};
 }
 async function calculate(kind){
  if(!selected||dead)return null;cancel();selectionMode(false);const id=sequence,controller=new AbortController();job=controller;busy(true);
  const sample=getSnapshot(),day=sample.parts.date,point=selected.point.slice();jobDay=day;let progressTime=0;
  const onProgress=event=>{if(dead||id!==sequence||performance.now()-progressTime<120)return;progressTime=performance.now();$('[data-solar-progress]').textContent=event.phase==='prepare'?'Подготавливаем геометрию зданий…':`Считаем ${kind==='year'?'12 дней':'день'} · ${Math.round(event.fraction*100)}%`;};
  $('[data-solar-progress]').textContent='Подготавливаем геометрию зданий…';
  try{
   await ready().prepare({signal:controller.signal,onProgress});
   const result=kind==='year'?await engine.year({point,year:Number(day.slice(0,4)),dayOfMonth:Number(day.slice(8,10)),stepMinutes:10,signal:controller.signal,onProgress}):await engine.day({point,day,stepMinutes:5,signal:controller.signal,onProgress});
   if(dead||id!==sequence)return null;
   if(kind==='year')showYear(result);else showDay(result);$('[data-solar-progress]').textContent='Расчёт завершён.';return result;
  }catch(error){if(!dead&&id===sequence)$('[data-solar-progress]').textContent=error.name==='AbortError'?'Расчёт отменён.':'Не удалось рассчитать точку. Попробуйте выбрать другую поверхность.';if(error.name!=='AbortError')console.error('Sunlight analysis',error);return null;}
  finally{if(!dead&&id===sequence){job=null;busy(false);}}
 }
 function update(sample=getSnapshot()){
  if(dead||!selected)return;
  if(job&&jobDay&&jobDay!==sample.parts.date){cancel();$('[data-solar-progress]').textContent='Дата изменилась. Запустите расчёт для выбранного дня.';}
  const key=`${sample.parts.date}:${sample.parts.time}:${selected.point.join(',')}`;if(key===lastStatusKey)return;lastStatusKey=key;
  const result=ready().sunlightAt({point:selected.point,date:sample.date});
  $('[data-point-status]').textContent=result.reason==='below-horizon'?'В выбранное время Солнце за горизонтом.':result.sunlit?'В выбранное время в точке есть прямое солнце.':`В выбранное время точка в тени: ${result.blocker?.category||'здание'}.`;
  element.dataset.sunlightState=result.reason;
  const chart=element.querySelector('[data-sunlight-chart]');if(chart){chart.setAttribute('aria-valuenow',String(sample.parts.minutes));chart.setAttribute('aria-valuetext',sample.parts.time);}
  if(latestDay&&latestDay.day!==sample.parts.date)$('[data-solar-day-result]').hidden=true;
  if(latestYear&&latestYear.year!==Number(sample.parts.date.slice(0,4)))$('[data-solar-year-result]').hidden=true;
 }
 const onDown=e=>{if(!selecting)return;down=[e.clientX,e.clientY];e.stopImmediatePropagation();e.preventDefault();};
 const onUp=async e=>{
  if(!selecting)return;e.stopImmediatePropagation();e.preventDefault();if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8)return;down=null;
  const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,getCamera());
  cancel();const id=sequence,controller=new AbortController();job=controller;busy(true);$('[data-solar-progress]').textContent='Определяем поверхность…';
  try{await ready().prepare({signal:controller.signal});if(dead||id!==sequence)return;const hit=engine.pick(ray);if(hit){selectPoint(hit);element.scrollIntoView({block:'nearest',behavior:'instant'});}else{$('[data-solar-progress]').textContent='Здесь нет поверхности. Выберите здание или участок.';busy(false);}}
  catch(error){if(!dead&&id===sequence){$('[data-solar-progress]').textContent='Выбор точки отменён.';busy(false);}}
  finally{if(id===sequence)job=null;}
 };
 canvas.addEventListener('pointerdown',onDown,true);canvas.addEventListener('pointerup',onUp,true);
 $('[data-solar-pick]').onclick=()=>{cancel();selectionMode(!selecting);$('[data-solar-progress]').textContent=selecting?'Нажмите на нужное место в 3D-сцене. Для поворота вида сначала отмените выбор.':'';};
 $('[data-solar-clear]').onclick=clear;$('[data-solar-day]').onclick=()=>calculate('day');$('[data-solar-year]').onclick=()=>calculate('year');$('[data-solar-cancel]').onclick=()=>{cancel();$('[data-solar-progress]').textContent='Расчёт отменён.';};
 banner.querySelector('button').onclick=()=>{cancel();selectionMode(false);};
 return{element,update,selectPoint,calculateDay:()=>calculate('day'),calculateYear:()=>calculate('year'),getSelected:()=>selected,getResults:()=>({day:latestDay,year:latestYear}),getEngine:ready,setInteraction(callback){selectionCallback=callback;},dispose(){dead=true;cancel();selectionMode(false);canvas.removeEventListener('pointerdown',onDown,true);canvas.removeEventListener('pointerup',onUp,true);engine?.dispose();scene.remove(marker);marker.geometry.dispose();marker.material.dispose();banner.remove();element.remove();}};
}
