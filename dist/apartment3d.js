// @r_peredelkino · private apartment, shared solar clock and real complex shadows.
import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {mountSceneAttribution} from './attribution.js?v=references37';
import {apartmentPlans} from './apartment-plans.js?v=references37';
import {createApartment} from './apartment-model.js?v=references37';
import {createApartmentTour} from './apartment-tour.js?v=references37';
import {createApartmentActions} from './apartment-actions-v37.js?v=references37';
import {apartmentCatalog} from './apartment-catalog-v37.js?v=references37';
import {cutApartmentOpenings,apartmentApertures,apartmentApertureProfile} from './apartment-apertures.js?v=references37';
import {bendPaneMaterial} from './facade-detail.js?v=references37';
import {createArchitecturalLighting} from './architectural-lighting.js?v=references37';
import {solarState,getSolarSnapshot,setSolarSelection,solarReferenceLinks,monthDate} from './solar-clock.js?v=references37';
import {location,daylight,timeLabel,moscowParts} from './solar.js?v=references37';

const months=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
let dispose=()=>{},generation=0;

function solarPanelHTML(){return `<div class="apt-solar-anchor"><section class="apt-solar-panel" aria-labelledby="apt-solar-title">
 <header><div><h3 id="apt-solar-title">Солнце в квартире</h3><span>Дата и время общие с картой · Москва</span></div><button type="button" data-solar-close hidden aria-label="Закрыть настройки солнца">×</button></header>
 <div class="apt-solar-months" aria-label="Месяц выбранного года">${months.map((name,i)=>`<button type="button" data-month="${i}" aria-pressed="false">${name}</button>`).join('')}</div>
 <div class="apt-solar-date"><label>Дата<input type="date" min="1900-01-01" max="2100-12-31" data-date></label><label>Время МСК<input type="time" data-time></label><button type="button" data-now>Сейчас</button></div>
 <label class="apt-solar-timeline">Время суток <output data-hour></output><input type="range" min="0" max="1439" step="1" data-range></label>
 <div class="apt-solar-events"><button type="button" data-solar-event="rise">Восход</button><button type="button" data-solar-event="noon">Солнечный полдень</button><button type="button" data-solar-event="set">Закат</button></div>
 <div class="apt-solar-angles"><span>Азимут <b data-azimuth></b></span><span>Видимая высота <b data-elevation></b></span></div>
 <p class="apt-solar-day" data-daylight></p><p class="apt-solar-day" data-horizon></p>
 <label class="apt-solar-lamp"><input type="checkbox" data-lamp>Лампа для осмотра · искусственный свет</label>
 <p class="apt-solar-context" data-context-status role="status">Загружаем здания для учёта внешних теней…</p><button type="button" data-context-retry hidden>Повторить загрузку окружения</button>
 <p class="apt-solar-note">Ясное небо. В разрезе стены и потолок скрыты, но продолжают отбрасывать тени. Стекло пропускает прямой солнечный свет. Точность зависит от геометрии зданий и окон.</p>
 <div class="apt-solar-links"><a data-compare-suncalc target="_blank" rel="noopener">Сверить в SunCalc ↗</a><a data-compare-shademap target="_blank" rel="noopener">Сверить в ShadeMap ↗</a></div>
 </section></div>`;}

// The visual facade cut also has to exist in the directional/point-light depth
// shaders. Otherwise the colour pass shows an opening while the original solid
// shell still blocks every incoming sun ray. Other floors are not removed.
export function cutApartmentShadowOpenings(tower,apartment){
 if(tower.apartmentShadowOpenings)return tower.apartmentShadowOpenings;
 const {data,metrics}=apartment,p=metrics.placement,apertures=apartmentApertures(data,metrics,apartment.facadeRegistration),profile=apartmentApertureProfile(apartment),materials=[],previous=[];
 function shadowMaterial(original,distance,bent){
  const material=original?original.clone():distance?new T.MeshDistanceMaterial():new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
  if(original){material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey.bind(original);}
  if(bent&&!original)bendPaneMaterial(material);
  const before=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   shader.uniforms.rpApertures={value:apertures};shader.uniforms.rpApartment={value:new T.Vector4(p.x,p.y,p.z,p.angle)};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rpOpeningWorld;').replace('#include <project_vertex>',`#include <project_vertex>
    vec4 rpOpeningP=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
    rpOpeningP=instanceMatrix*rpOpeningP;
    #endif
    rpOpeningWorld=(modelMatrix*rpOpeningP).xyz;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 rpOpeningWorld;uniform vec4 rpApartment;uniform vec4 rpApertures[${apertures.length}];`).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    vec3 rpDelta=rpOpeningWorld-rpApartment.xyz;float rpC=cos(rpApartment.w),rpS=sin(rpApartment.w);
    vec2 rpLocal=vec2(rpC*rpDelta.x-rpS*rpDelta.z,rpS*rpDelta.x+rpC*rpDelta.z);
    if(rpDelta.y>${profile.sill.toFixed(4)}&&rpDelta.y<${profile.head.toFixed(4)}){
     for(int rpI=0;rpI<${apertures.length};rpI++){vec4 rpA=rpApertures[rpI];vec2 rpD=rpA.zw-rpA.xy;float rpL=length(rpD);vec2 rpQ=rpLocal-rpA.xy;float rpU=dot(rpQ,rpD)/rpL;float rpV=dot(rpQ,vec2(-rpD.y,rpD.x))/rpL;if(rpU>-${profile.edgeAllowance.toFixed(4)}&&rpU<rpL+${profile.edgeAllowance.toFixed(4)}&&abs(rpV)<${profile.halfDepth.toFixed(4)})discard;}}
   `);
  };
  material.customProgramCacheKey=()=>cacheKey()+'-apartment-shadow-apertures37-'+String(data.id||data.slot)+'-'+apertures.length;
  material.name='Finite apartment window openings · '+(distance?'distance':'depth');materials.push(material);return material;
 }
 tower.group.traverse(o=>{
  if(!o.isMesh||!o.castShadow)return;
  const surface=Array.isArray(o.material)?o.material:[o.material];
  if(surface.every(m=>m.transparent||m.transmission>0)){o.castShadow=false;return;}
  previous.push({mesh:o,depth:o.customDepthMaterial,distance:o.customDistanceMaterial});
  o.customDepthMaterial=shadowMaterial(o.customDepthMaterial,false,!!o.geometry.attributes.paneBend);
  o.customDistanceMaterial=shadowMaterial(o.customDistanceMaterial,true,!!o.geometry.attributes.paneBend);
 });
 let released=false;
 const result={apertures,materials,dispose(){if(released)return;released=true;for(const r of previous){r.mesh.customDepthMaterial=r.depth;r.mesh.customDistanceMaterial=r.distance;}materials.forEach(m=>m.dispose());delete tower.apartmentShadowOpenings;}};
 tower.apartmentShadowOpenings=result;return result;
}

// Hide context only in the colour pass. Keeping the real meshes visible to
// Three's shadow traversal also keeps off-screen neighboring buildings active.
// Draw-local write masks preserve seasonal/night controllers and materials
// selected later by the planting LOD; no material state survives a colour draw.
export function retainApartmentContextShadows(model,colorVisible){
 const records=[],seen=new Set();
 function bind(mesh){
  if(!mesh.material||seen.has(mesh))return;seen.add(mesh);
  const before=mesh.onBeforeRender,after=mesh.onAfterRender;let saved=null;
  function restore(){if(saved){saved.material.colorWrite=saved.colorWrite;saved.material.depthWrite=saved.depthWrite;saved=null;}}
  mesh.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
   restore();before.call(this,renderer,scene,camera,geometry,material,group);
   if(!colorVisible()){saved={material,colorWrite:material.colorWrite,depthWrite:material.depthWrite};material.colorWrite=false;material.depthWrite=false;}
  };
  mesh.onAfterRender=function(...args){restore();after.apply(this,args);};
  records.push(()=>{restore();mesh.onBeforeRender=before;mesh.onAfterRender=after;});
 }
 model.root.traverse(bind);
 // These children are attached on the first camera LOD update, before rendering.
 for(const batch of [...(model.publicRealm?.forecourt?.landscape?.spatialInstances??[]),...(model.publicRealm?.spatialInstances??[])])for(const low of batch.lowChunks??[])bind(low);
 return{meshes:seen.size,dispose(){records.splice(0).forEach(fn=>fn());}};
}

window.showApartment=function(id){
 const a=apartmentCatalog.find(x=>x.id===id);if(!a||!apartmentPlans[id]){toast('Для этой планировки пока доступен исходный чертёж');return false;}dispose();const token=++generation;
 document.querySelector('#sheet-body').innerHTML=`<div class="apartment-topline"><span class="eyebrow">3D-ПЛАНИРОВКА / РОДИНА ПЕРЕДЕЛКИНО</span></div><h2>Квартира ${a.number}</h2><p>Корпус ${a.building} · ${a.floor} этаж · ${a.area} м²</p><div class="model-tabs"><button class="active" data-mode="3d">3D-планировка</button><button data-mode="2d">Исходный план</button></div><div id="model-viewport"><div class="model-loading">Создаём объёмную модель…</div></div><div id="model-source" hidden><img src="${a.image}" alt="Исходная планировка квартиры ${a.number}"></div><div class="model-controls"><button id="model-walk" class="apt-walk-primary">Прогулка внутри ↗</button><button id="model-furniture" aria-pressed="true">Без мебели</button><button id="model-top">Сверху</button><button id="model-reset">Ракурс 3D</button><button id="model-walls" aria-pressed="false">Полные стены</button><button id="model-context" aria-pressed="false">Окружение ЖК</button></div>${solarPanelHTML()}<div class="model-rooms">${apartmentPlans[id].rooms.map((r,i)=>`<button data-room="${i}">${r.name}<small>${r.area}</small></button>`).join('')}</div><p class="model-hint">Поверните модель пальцем · два пальца — масштаб.<br>«Прогулка внутри» — вид на уровне глаз и управление двумя стиками.</p><div class="model-note">Контуры и комнаты восстановлены по опубликованному изображению этой квартиры. Расстановка мебели и отделка — авторский вариант. Остекление согласовано с геометрией выбранной башни и этажа. Точные профили и размеры проёмов требуют рабочих чертежей. Солнце и тени показаны для реконструированной модели.</div><button class="secondary" onclick="closeSheet();goApartment('${a.id}')">Показать на этаже</button>`;
 const d=document.querySelector('#sheet');d.classList.add('model-sheet');if(!d.open)d.showModal();d.scrollTop=0;requestAnimationFrame(()=>{if(token===generation)mount(id);});return true;
};
const dialog=document.querySelector('#sheet');
dialog.addEventListener('close',()=>{++generation;dispose();dialog.classList.remove('model-sheet','apartment-immersive');});

function mount(id){
 const host=document.querySelector('#model-viewport');if(!host||!dialog.open)return;let renderer;const mobile=matchMedia('(pointer:coarse)').matches;
 try{renderer=new T.WebGLRenderer({antialias:!mobile,alpha:false});}catch{host.innerHTML='<p class="model-fallback">3D не запустилось. Исходный план доступен в соседней вкладке.</p>';wireTabs(null);return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.replaceChildren(renderer.domElement);mountSceneAttribution(host);
 const scene=new T.Scene(),shadowModels=new T.Group(),apt=createApartment(id),actions=createApartmentActions({apartment:apt,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches}),size=Math.max(apt.metrics.width,apt.metrics.depth),placement=apt.metrics.placement;
 shadowModels.name='Apartment and surrounding solar occluders';scene.add(shadowModels);shadowModels.add(apt.root);apt.root.position.set(placement.x,placement.y,placement.z);apt.root.rotation.y=placement.angle;apt.root.updateMatrixWorld(true);
 const worldPoint=(x,y,z)=>apt.root.localToWorld(new T.Vector3(x,y,z));
 const receiverBounds=new T.Box3();for(const point of apt.data.outline){const [x,z]=apt.metrics.coord(...point);receiverBounds.expandByPoint(worldPoint(x,0,z));receiverBounds.expandByPoint(worldPoint(x,apt.data.ceilingHeight,z));}receiverBounds.expandByScalar(.25);
 const camera=new T.PerspectiveCamera(42,1,.035,1400),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=size*.35;controls.maxDistance=size*3;controls.maxPolarAngle=Math.PI*.49;
 const rig=createArchitecturalLighting(scene,renderer,{mobile,modelRoot:shadowModels,receiverBounds});
 const lamp=new T.PointLight(0xffe2b4,0,9,2);lamp.name='Optional artificial inspection lamp';
 const lampRoom=Math.max(0,apt.data.rooms.findIndex(r=>/Кухня|Гостиная/.test(r.name))),lampPoint=apt.metrics.coord(...apt.data.roomSpawns[lampRoom]);lamp.position.copy(worldPoint(lampPoint[0],2.50,lampPoint[1]));scene.add(lamp);
 const solarAnchor=document.querySelector('.apt-solar-anchor'),panel=solarAnchor.querySelector('.apt-solar-panel'),$=s=>panel.querySelector(s),dayCache=new Map();
 let dead=false,frame,complex=null,context=false,full=false,pending=null,clock=0,artificialLight=false,previousMonth=null,lastSolarKey='',contextState='loading',contextMask=null,facadeShadows=null,colorFacadeOpenings=null,solarButton=null;
 // A single deterministic time is easier to inspect than a background map's
 // running day animation. Manual selections persist when returning to the map.
 solarState.play=false;

 function setSolarOverlay(open){
  if(!tour?.enabled)return;panel.hidden=!open;solarButton?.setAttribute('aria-expanded',String(open));
  if(open)$('[data-date]').focus({preventScroll:true});else solarButton?.focus({preventScroll:true});
 }
 const editingKey=e=>{
  const editing=e.target instanceof Element&&panel.contains(e.target),overlay=tour?.enabled&&panel.classList.contains('apt-solar-overlay')&&!panel.hidden;
  if(overlay&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();setSolarOverlay(false);return;}
  if(editing||(overlay&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)))e.stopImmediatePropagation();
 };
 // Install before the tour's capture listener so arrows in date/time controls
 // edit their values instead of moving the camera or cancelling the dialog.
 window.addEventListener('keydown',editingKey,true);
 let tour=createApartmentTour({host,canvas:renderer.domElement,camera,controls,apartment:apt,actions,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,onLighting:on=>{artificialLight=on;applySolar();},onChange:on=>{
  if(on){host.append(panel);panel.classList.add('apt-solar-overlay');panel.hidden=true;$('[data-solar-close]').hidden=false;}
  else{solarAnchor.append(panel);panel.classList.remove('apt-solar-overlay');panel.hidden=false;$('[data-solar-close]').hidden=true;}
  solarButton?.setAttribute('aria-expanded','false');host.querySelector('.scene-attribution')?.classList.toggle('apt-author-hidden',on);lastSolarKey='';
 },onFurniture:toggleFurniture});
 solarButton=document.createElement('button');solarButton.type='button';solarButton.textContent='Солнце и время';solarButton.setAttribute('aria-expanded','false');solarButton.onclick=()=>setSolarOverlay(panel.hidden);tour.hud.querySelector('.apt-tour-actions').append(solarButton);
 $('[data-solar-close]').onclick=()=>setSolarOverlay(false);
 for(const event of ['pointerdown','pointerup','wheel','dblclick'])panel.addEventListener(event,e=>e.stopPropagation());

 function fitPlanView(){
  camera.aspect=Math.max(1,host.clientWidth)/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();
  const points=apt.data.outline.flatMap(p=>{const [x,z]=apt.metrics.coord(...p);return[worldPoint(x,0,z),worldPoint(x,apt.data.ceilingHeight,z)];});
  for(let attempt=0;attempt<4;attempt++){camera.lookAt(controls.target);camera.updateMatrixWorld(true);let ratio=1;for(const point of points){const projected=point.clone().project(camera);ratio=Math.max(ratio,Math.abs(projected.x)/.84,Math.abs(projected.y)/.84);}if(ratio<=1.001)break;camera.position.sub(controls.target).multiplyScalar(ratio*1.025).add(controls.target);}
  controls.maxDistance=Math.max(size*3,camera.position.distanceTo(controls.target)*1.15);controls.update();
 }
 function overview(){tour.exit();controls.maxDistance=size*3;camera.fov=42;camera.updateProjectionMatrix();camera.position.copy(worldPoint(size*.48,size*(id==='1-59'?1.1:.9),size*(id==='1-59'?-.93:.93)));controls.target.copy(worldPoint(0,.35,0));controls.update();fitPlanView();apt.highlight(-1);}
 overview();
 function toggleFurniture(){tour.stand?.();apt.setFurniture(!apt.withFurniture);tour.refreshWorld();const b=document.querySelector('#model-furniture');b.textContent=apt.withFurniture?'Без мебели':'С мебелью';b.setAttribute('aria-pressed',String(apt.withFurniture));}
 function applySection(){if(!complex)return;const own=complex.towers.get(placement.building);if(own){colorFacadeOpenings=cutApartmentOpenings(own,apt);facadeShadows=cutApartmentShadowOpenings(own,apt);}}
 function applySolar(sample=getSolarSnapshot()){
  const p=sample.parts,solar=sample.position,elevation=sample.elevation,visible=context||tour.enabled,day=T.MathUtils.clamp((elevation+7)/12,0,1),sky=new T.Color(0x132337).lerp(new T.Color(0xb0cede),day);
  renderer.setClearColor(sky,1);scene.fog=visible?new T.Fog(sky,720,1800):null;
  rig.set({elevation,azimuth:solar.azimuth,direction:sample.direction,cloudCover:8});rig.focus(camera);
  if(complex){
   const month=p.monthIndex,winter=[11,0,1].includes(month);
   if(previousMonth!==month){complex.neighborhood.setSeason(winter,month);complex.setSeason(winter,month);previousMonth=month;}
   complex.lighting.setAtmosphere({elevation,hour:p.minutes/60,weather:'clear'});complex.life.setWeather({cloudCover:8,windDirection:225,windSpeed:2});complex.life.setSkyVisible(false);
  }
  lamp.intensity=0;actions.setAction('apt-lights',artificialLight);apt.setArtificialLight(artificialLight);
  $('[data-hour]').textContent=p.time;$('[data-azimuth]').textContent=`${solar.azimuth.toFixed(2)}°`;$('[data-elevation]').textContent=`${elevation.toFixed(2)}°`;
  if(!dayCache.has(p.date))dayCache.set(p.date,daylight(p.date));const dl=dayCache.get(p.date);
  $('[data-daylight]').textContent=`Восход ${timeLabel(dl.rise)} · полдень ${timeLabel(dl.noon)} · закат ${timeLabel(dl.set)}`;
  $('[data-horizon]').textContent=elevation>0?'Солнце над горизонтом':'Солнце за горизонтом · прямого солнечного света нет';
  for(const key of ['date','time','range']){const field=$(`[data-${key}]`);if(document.activeElement!==field)field.value=key==='date'?p.date:key==='time'?p.time:Math.floor(p.minutes);}
  panel.querySelectorAll('[data-month]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.month)===p.monthIndex)));
  panel.querySelectorAll('[data-solar-event]').forEach(b=>b.disabled=dl[b.dataset.solarEvent]==null);
  $('[data-now]').setAttribute('aria-pressed',String(solarState.mode==='now'));$('[data-lamp]').checked=artificialLight;
  const links=solarReferenceLinks(p.date,solarState.minutes);$('[data-compare-suncalc]').href=links.suncalc;$('[data-compare-shademap]').href=links.shademap;
  $('[data-context-status]').textContent=contextState==='ready'?'Геометрия корпусов и окружающей застройки участвует в тенях.':contextState==='error'?'Окружение не загрузилось. Пока показаны только тени самой квартиры.':'Загружаем здания для учёта внешних теней…';
  $('[data-context-retry]').hidden=contextState!=='error';panel.dataset.contextState=contextState;
  panel.dataset.solarDate=p.date;panel.dataset.solarTime=p.time;panel.dataset.solarAzimuth=String(solar.azimuth);panel.dataset.solarElevation=String(elevation);panel.dataset.geometricElevation=String(solar.geometricElevation);
  scene.userData.solar={date:p.date,time:p.time,timeZone:location.timeZone,latitude:location.latitude,longitude:location.longitude,azimuth:solar.azimuth,apparentElevation:elevation,geometricElevation:solar.geometricElevation,direction:sample.direction,contextReady:contextState==='ready',clearSky:true,artificialLight};
  lastSolarKey=`${Math.floor(sample.date.getTime()/1000)}:${contextState}:${visible}:${artificialLight}`;
 }
 function selectSolar(day,minutes){try{setSolarSelection(day,minutes);applySolar();}catch{toast('Проверьте дату и время.');}}
 $('[data-date]').onchange=e=>{if(e.target.value&&e.target.validity.valid)selectSolar(e.target.value,solarState.minutes);};
 $('[data-time]').onchange=e=>{if(!e.target.value||!e.target.validity.valid)return;const [hour,minute]=e.target.value.split(':').map(Number);selectSolar(solarState.date,hour*60+minute);};
 $('[data-range]').oninput=e=>selectSolar(solarState.date,Number(e.target.value));
 $('[data-now]').onclick=()=>{const p=moscowParts();setSolarSelection(p.date,p.minutes,{mode:'now'});applySolar();};
 for(const b of panel.querySelectorAll('[data-month]'))b.onclick=()=>selectSolar(monthDate(solarState.date,Number(b.dataset.month)),solarState.minutes);
 for(const b of panel.querySelectorAll('[data-solar-event]'))b.onclick=()=>{const value=daylight(solarState.date)[b.dataset.solarEvent];if(value!=null)selectSolar(solarState.date,value);};
 $('[data-lamp]').onchange=e=>{artificialLight=e.target.checked;applySolar();};
 $('[data-context-retry]').onclick=()=>environment();

 async function environment(){
  if(complex)return complex;if(pending)return pending;contextState='loading';applySolar();
  pending=(async()=>{
   const {createComplex}=await import('./complex-model.js?v=references37');if(dead)return null;const model=createComplex();if(dead){model.dispose();return null;}
   complex=model;shadowModels.add(model.root);model.root.visible=true;
   model.root.traverse(o=>{if(!o.isMesh||!o.material)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>(m.transparent||m.transmission>0)&&!m.alphaTest))o.castShadow=false;});
   applySection();contextMask=retainApartmentContextShadows(model,()=>context||tour.enabled);model.life.setSkyVisible(false);shadowModels.updateMatrixWorld(true);rig.refreshBounds(shadowModels,receiverBounds);
   contextState='ready';applySolar();return model;
  })().catch(error=>{
   if(!dead){contextState='error';applySolar();toast('Окружение не загрузилось. Доступны тени самой квартиры.');}
   console.warn('Apartment environment:',error);return null;
  }).finally(()=>pending=null);return pending;
 }
 document.querySelector('#model-walk').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Готовим вид из окон…';await environment();if(dead)return;b.disabled=false;b.textContent='Прогулка внутри ↗';tour.enter();applySolar();resize();};
 document.querySelector('#model-context').onclick=async e=>{const b=e.currentTarget;b.disabled=true;context=!context;await environment();if(dead)return;b.disabled=false;b.textContent=context?'Скрыть окружение':'Окружение ЖК';b.setAttribute('aria-pressed',String(context));applySolar();};
 document.querySelector('#model-furniture').onclick=toggleFurniture;
 document.querySelector('#model-walls').onclick=e=>{full=!full;apt.setFull(full);e.currentTarget.textContent=full?'Низкие стены':'Полные стены';e.currentTarget.setAttribute('aria-pressed',String(full));};
 document.querySelector('#model-top').onclick=()=>{tour.exit();camera.position.copy(worldPoint(0,size*1.5,.01));controls.target.copy(worldPoint(0,0,0));controls.update();fitPlanView();};document.querySelector('#model-reset').onclick=overview;
 document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>{const i=+b.dataset.room;if(tour.enabled){tour.teleport(i);return;}apt.highlight(i);document.querySelectorAll('[data-room]').forEach(x=>x.classList.toggle('active',x===b));const [x,z]=apt.metrics.coord(...apt.data.labels[i]);controls.target.copy(worldPoint(x,.2,z));controls.update();});
 function resize(){if(dead||host.hidden)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();wireTabs(resize);
 function render(ms=performance.now()){
  if(dead)return;clock=ms/1000;
  if(tour.enabled){if(panel.hidden)tour.update(clock);}else controls.update();
  const sample=getSolarSnapshot(),key=`${Math.floor(sample.date.getTime()/1000)}:${contextState}:${context||tour.enabled}:${artificialLight}`;if(key!==lastSolarKey)applySolar(sample);
  actions.update(clock,{paused:host.hidden||document.hidden,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches});if(complex){complex.update(clock);complex.life.setViewer?.(camera);complex.life.setSkyVisible(false);complex.lighting.update(complex.life.time,camera);}
  rig.focus(camera);if(!host.hidden)renderer.render(scene,camera);
 }
 function draw(ms=0){if(dead)return;render(ms);frame=requestAnimationFrame(draw);}draw();
 // Context is required for sunlight, even when the user prefers an isolated plan.
 const contextRequest=setTimeout(()=>{if(!dead)environment();},0);
 const lost=e=>{e.preventDefault();host.insertAdjacentHTML('beforeend','<p class="apt-context-error">3D приостановлено браузером. Закройте модель и откройте её снова.</p>');};renderer.domElement.addEventListener('webglcontextlost',lost);
 host.userData={apartment:apt,actions,tour,renderer,scene,camera};host.apartmentViewer={id,apt,actions,tour,camera,renderer,scene,controls,environment,render,worldPoint,rig,receiverBounds,solarPanel:panel,getSolar:getSolarSnapshot,setSolar:selectSolar,get complex(){return complex;},get contextState(){return contextState;}};
 dispose=()=>{
  dead=true;clearTimeout(contextRequest);cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',editingKey,true);tour.dispose();controls.dispose();contextMask?.dispose();facadeShadows?.dispose();colorFacadeOpenings?.dispose();complex?.dispose();actions.dispose();apt.dispose();rig.dispose();renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();delete host.apartmentViewer;delete host.userData;dispose=()=>{};
 };
}

function wireTabs(resize){document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{
 const model=b.dataset.mode==='3d';document.querySelector('#model-viewport').hidden=!model;document.querySelector('#model-source').hidden=model;document.querySelector('.model-controls').hidden=!model;document.querySelector('.model-rooms').hidden=!model;document.querySelector('.apt-solar-anchor').hidden=!model;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));if(model)resize?.();
});}
