// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
/* Public architectural reference. Exactly two mock residence grants; not production authorization. */
const residences=Object.freeze([{id:'1-59',building:1,floor:6,slot:'7',number:'59',area:'24,7',rooms:'Студия',title:'Моя студия',image:'assets/plans/apartment-59.png'},{id:'1-81',building:1,floor:8,slot:'3',number:'81',area:'82,7',rooms:'3 комнаты',title:'Семейная квартира',image:'assets/plans/apartment-81.png'}]);
if(!residences.some(a=>a.id===state.residenceId))state.residenceId=residences[0].id;
const myResidence=()=>residences.find(a=>a.id===state.residenceId)||residences[0];
let mapBuilding=1,mapFloor=6,mapView='district',mapZoom=1,mapRequest=0,mapSelectedApartment=null;const planCache=new Map();
// Approach each facade from the outside of the site, so a neighbouring tower
// cannot occupy the close-up camera position (notably beside building 4).
function buildingFacadeView(spec){const radius=Math.hypot(spec.x,spec.z)||1;return{position:[spec.x+spec.x/radius*46,24,spec.z+spec.z/radius*46],target:[spec.x,18,spec.z]}}
const originalRender=render,originalNavigate=navigate,originalSheet=openSheet;
render=function(){if(page!=='map'){window.disposeClusterMap?.();originalRender();const a=myResidence();const main=document.querySelector('#main');main.innerHTML=main.innerHTML.replaceAll('КОРПУС 3 · КВ. 128',`КОРПУС ${a.building} · КВ. ${a.number}`).replaceAll('Корпус 3 · Квартира 128',`Корпус ${a.building} · Квартира ${a.number}`).replaceAll('128 · 18 этаж',`${a.number} · ${a.floor} этаж`).replaceAll('Квартира 128',`Квартира ${a.number}`);if(page==='home'){const banner=document.createElement('button');banner.className='map-entry';banner.onclick=()=>navigate('map');banner.innerHTML=`<span class="map-entry-icon">${icon('grid')}</span><span><b>Мой кластер</b><small>3D · официальный генплан · 203 планировки</small></span><span>↗</span>`;main.querySelector('.greeting').after(banner);const walk=document.createElement('button');walk.className='home-walk-entry';walk.onclick=openClusterWalk;walk.innerHTML=`<span class="home-walk-icon">${icon('user')}</span><span><strong>3D-прогулка</strong><small>Пройтись по двору от первого лица</small></span>`;banner.after(walk)}return}renderMap()};
navigate=function(p){document.body.classList.toggle('spatial-map-open',p==='map');mapRequest++;if(p==='map'){closeSheet();page='map';room=null;mapZoom=1;render();window.scrollTo(0,0)}else originalNavigate(p)};
openSheet=function(type){if(type==='residence'){document.querySelector('#sheet-body').innerHTML=`<h2>Мои пространства</h2><p>В демо вам доступны две квартиры.</p>${residences.map(a=>`<button class="property-row ${a.id===state.residenceId?'selected':''}" onclick="selectResidence('${a.id}')"><span class="property-number">${a.number}</span><span><b>${a.title}</b><small>Корпус ${a.building} · ${a.floor} этаж · ${a.area} м²</small></span><span>${a.id===state.residenceId?'✓':'›'}</span></button>`).join('')}<button class="primary" onclick="navigate('map')">Открыть генплан</button><p class="map-footnote">Привязка квартир к вашему профилю вымышлена для демонстрации.</p>`;const dialog=document.querySelector('#sheet');if(!dialog.open)dialog.showModal();return}originalSheet(type);const a=myResidence(),el=document.querySelector('#sheet-body');el.innerHTML=el.innerHTML.replaceAll('Квартира 128',`Квартира ${a.number}`).replaceAll('Корпус 3 · 18 этаж',`Корпус ${a.building} · ${a.floor} этаж`).replaceAll('Корпус 3',`Корпус ${a.building}`)};
function openClusterWalk(){mapView='district';navigate('map');if(window.clusterCamera)window.clusterCamera('walk');else toast('3D ещё загружается. Нажмите «3D-прогулка» на генплане.')}
function selectResidence(id){const a=residences.find(a=>a.id===id);if(!a){toast('Эта квартира не добавлена в ваш профиль');return false}state.residenceId=id;save();closeSheet();render();toast(`Выбрана квартира ${a.number}`);return true}
function goApartment(id){const a=residences.find(a=>a.id===id);if(!a){toast('Откройте планировку в публичном каталоге');return false}mapBuilding=a.building;mapFloor=a.floor;mapSelectedApartment=a;mapView='floor';navigate('map');return true}
function chooseBuilding(b){if(Number(b)===0){if(window.clusterCamera)window.clusterCamera('facade',0);else toast('0 · Офисный центр. Жилых квартир нет.');return}if(!floorSources[b])return;mapBuilding=Number(b);const own=residences.find(a=>a.building===mapBuilding);mapFloor=own?.floor||Math.min(...Object.keys(floorSources[b]).map(Number));mapSelectedApartment=null;mapView='floor';mapZoom=1;renderMap()}
function chooseFloor(f){if(!floorSources[mapBuilding]?.[f])return;mapFloor=Number(f);mapSelectedApartment=null;mapZoom=1;renderMap()}
function setMapView(v){mapView=v;mapZoom=1;renderMap()}
function mapTools(){return `<div class="map-tools"><button aria-label="Уменьшить карту" onclick="zoomMap(-.35)">−</button><span id="map-scale">100%</span><button aria-label="Увеличить карту" onclick="zoomMap(.35)">+</button><button aria-label="Сбросить масштаб" onclick="zoomMap(0)">⤢</button></div>`}
function zoomMap(d){mapZoom=d===0?1:Math.max(1,Math.min(3,mapZoom+d));const el=document.querySelector('.map-canvas');if(el){el.style.width=(mapZoom*100)+'%';el.style.maxWidth='none';document.querySelector('#map-scale').textContent=Math.round(mapZoom*100)+'%'}}
function renderMap(){
  if(page!=='map')return;
  if(mapSelectedApartment&&(Number(mapSelectedApartment.building)!==mapBuilding||Number(mapSelectedApartment.floor)!==mapFloor))mapSelectedApartment=null;
  window.disposeClusterMap?.();mapRequest++;
  document.querySelector('#nav').innerHTML='';
  const views=[['district','3D-генплан'],['floor','Этажи'],['catalog','Все планировки'],['masterplan','План застройщика'],['original','Панорамы']];
  let content='';
  if(mapView==='original')content=originalMapMarkup();
  else if(mapView==='district')content=districtMarkup();
  else if(mapView==='masterplan')content='<section id="official-genplan" aria-label="Официальный генплан"></section>';
  else if(mapView==='catalog')content='<section id="published-catalog" aria-label="Опубликованные планировки"></section>';
  else content=`<div class="building-tabs">${Object.keys(floorSources).map(b=>`<button class="${+b===mapBuilding?'active':''}" onclick="chooseBuilding(${b})">Корпус ${b}</button>`).join('')}</div>
    <div class="floor-bar"><div><span>ЭТАЖ</span><strong>${mapFloor}<small> / ${Math.max(...Object.keys(floorSources[mapBuilding]).map(Number))}</small></strong></div><label>Перейти к этажу<select aria-label="Выбрать этаж" onchange="chooseFloor(this.value)">${Object.keys(floorSources[mapBuilding]).map(Number).sort((a,b)=>b-a).map(f=>`<option value="${f}" ${f===mapFloor?'selected':''}>${f} этаж</option>`).join('')}</select></label></div>
    <div class="floor-strip" aria-label="Этажи корпуса">${Object.keys(floorSources[mapBuilding]).map(Number).sort((a,b)=>a-b).map(f=>`<button class="${f===mapFloor?'active':''}" onclick="chooseFloor(${f})" aria-label="Этаж ${f}">${f}</button>`).join('')}</div>
    ${floorSelectionMarkup()}<section class="map-stage floor-stage"><div class="map-caption"><span>КОРПУС ${mapBuilding} / ЭТАЖ ${mapFloor}</span><span>ОФИЦИАЛЬНЫЙ ПЛАН</span></div><div class="map-scroll" id="floor-plan"><div class="plan-loading">Загружаем план этажа…</div></div>${mapTools()}</section>
    <div class="map-legend ref-floor-legend"><span><i class="published"></i>Опубликованная планировка</span><span><i class="available"></i>Есть 3D-пример</span><span><i class="unpublished"></i>Контур</span></div><div id="published-floor-lots"></div>`;
  document.body.dataset.mapView=mapView;
  document.querySelector('#main').innerHTML=`<header class="genplan-header"><button class="genplan-brand" onclick="setMapView('district')"><span>РОДИНА</span><small>ПЕРЕДЕЛКИНО / 3D</small></button><nav class="map-segment" aria-label="Режим генплана">${views.map(([value,label])=>`<button class="${mapView===value?'active':''}" aria-pressed="${mapView===value}" onclick="setMapView('${value}')">${label}</button>`).join('')}<button type="button" class="genplan-about" onclick="openPublicationAbout()">О проекте ↗</button></nav><div class="genplan-plan-picker" data-plan-picker><label>3D-квартиры<select data-plan-catalog aria-label="Выбрать 3D-планировку"><option value="">Загрузка планировок…</option></select></label><button data-open-plan disabled>Открыть</button></div></header><div class="genplan-content">${content}</div>`;
  window.mountPublicApartmentPicker?.();
  if(mapView==='district')window.mountClusterMap?.();
  if(mapView==='masterplan')ReferenceCatalog.mountGenplan(document.querySelector('#official-genplan'),mapBuilding);
  if(mapView==='catalog')ReferenceCatalog.mountCatalog(document.querySelector('#published-catalog'));
  if(mapView==='floor'){loadFloor(mapRequest);ReferenceCatalog.mountFloorList(document.querySelector('#published-floor-lots'),mapBuilding,mapFloor);document.querySelector('.floor-strip .active')?.scrollIntoView({block:'nearest',inline:'center'});}
}
function districtMarkup(){return `<section class="map-stage district-stage cluster-stage"><div class="map-caption"><span>ПЕРЕДЕЛКИНО / LIVE 3D</span><span>5 БАШЕН + ОФИС 0</span></div><div id="cluster-map" aria-label="Трёхмерный интерактивный генплан"></div><div class="cluster-tools"><button onclick="clusterCamera?.('in')" aria-label="Приблизить">+</button><button onclick="clusterCamera?.('out')" aria-label="Отдалить">−</button><button onclick="clusterCamera?.('top')">Сверху</button><button onclick="clusterCamera?.('reset')">Объём</button><button onclick="clusterCamera?.('context')">Район</button><button id="cluster-walk" onclick="clusterCamera?.('walk')" aria-pressed="false">3D-прогулка</button><button id="cluster-reference" onclick="clusterCamera?.('reference')" aria-pressed="false">Чертёж</button><button onclick="clusterCamera?.('fan')">Веер</button><button onclick="clusterCamera?.('arena')">Арена</button><button onclick="clusterCamera?.('courtyard')">Двор</button><button id="cluster-life" onclick="clusterCamera?.('life')" aria-pressed="true">Жизнь · вкл</button><button data-open-original="forecourt">Панорамы ↗</button></div></section>`}
function floorSelectionMarkup(){
  const a=mapSelectedApartment;if(!a)return '';
  const missing=a.positionInFloorSource===false;
  return `<div class="ref-selected-plan ${missing?'is-unmapped':''}" data-selected-plan="${esc(a.id)}" role="status" aria-live="polite"><strong>Квартира № ${esc(a.number)} <small>· корпус ${mapBuilding} · ${mapFloor} этаж</small></strong><p class="ref-selected-plan-details">${missing?'В официальной схеме этажа контур этой квартиры не отмечен.':'Находим контур выбранной квартиры на схеме…'}</p></div>`;
}
function propertyCard(a){return `<button class="plan-property" onclick="showApartment('${a.id}')"><span class="property-number">${a.number}</span><span><small>ДОСТУПНА ВАМ</small><h3>${a.rooms} · ${a.area} м²</h3><p>Открыть 3D-планировку</p></span><span>↗</span></button>`}
async function loadFloor(token){
  const host=document.querySelector('#floor-plan'),url=floorSources[mapBuilding][mapFloor],b=mapBuilding,f=mapFloor;
  try{
    const [raw,publicData]=await Promise.all([
      (async()=>{let source=planCache.get(url);if(!source){const response=await fetch(url);if(!response.ok)throw Error('Floor source unavailable');source=await response.text();planCache.set(url,source)}return source})(),
      ReferenceCatalog.load().catch(()=>null)
    ]);
    if(token!==mapRequest||page!=='map'||mapView!=='floor')return;
    const doc=new DOMParser().parseFromString(raw,'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('Invalid floor SVG');
    const svg=doc.documentElement;
    svg.querySelectorAll('script,foreignObject,image,use,a').forEach(el=>el.remove());
    svg.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(at=>{if(at.name.toLowerCase().startsWith('on')||at.name==='href'||at.name==='xlink:href')el.removeAttribute(at.name)})});
    svg.classList.add('map-canvas','floor-svg');svg.removeAttribute('width');svg.removeAttribute('height');
    const lots=[...svg.querySelectorAll('[alt]')];
    for(const el of lots){
      const slot=el.getAttribute('alt'),own=residences.find(x=>x.building===b&&x.floor===f&&String(x.slot)===slot),published=publicData?.apartments.find(x=>x.building===b&&x.floor===f&&String(x.slot)===slot);
      const overlay=el.cloneNode(true);overlay.removeAttribute('class');overlay.removeAttribute('style');
      overlay.classList.add(own?'owned-unit':published?'published-unit':'unpublished-unit');
      overlay.setAttribute('fill',own?'#d6ff6380':published?'#8cabef50':'#d8dcd540');
      overlay.setAttribute('stroke',own?'#789b31':published?'#536baf':'#b4bcb0');
      overlay.setAttribute('stroke-width',own||published?'2':'0.6');
      if(own||published){
        const a=own||published;
        const selected=mapSelectedApartment?.id===a.id&&mapSelectedApartment.positionInFloorSource!==false;
        if(selected){overlay.classList.add('selected-unit');overlay.setAttribute('aria-current','true');overlay.setAttribute('vector-effect','non-scaling-stroke');}
        overlay.setAttribute('tabindex','0');overlay.setAttribute('role','button');
        overlay.setAttribute('data-plan-id',a.id);
        overlay.setAttribute('aria-label',`Квартира ${a.number}, ${String(a.area).replace('.',',')} м²${own?', 3D демо-планировка':''}${selected?', выбрана на схеме':''}`);
      }else overlay.setAttribute('aria-label','Контур квартиры. В снимке каталога нет опубликованной карточки.');
      let layer=overlay;
      for(let parent=el.parentElement;parent&&parent!==svg;parent=parent.parentElement){if(parent.hasAttribute('transform')){const g=doc.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform',parent.getAttribute('transform'));g.appendChild(layer);layer=g}}
      svg.appendChild(layer);
    }
    host.replaceChildren(document.importNode(svg,true));
    const selected=host.querySelector('.selected-unit'),selection=document.querySelector('.ref-selected-plan');
    if(selection){
      selection.classList.toggle('is-unmapped',!selected);
      selection.querySelector('.ref-selected-plan-details').textContent=selected?'Контур этой квартиры выделен оранжевой обводкой.':'В официальной схеме этажа контур этой квартиры не отмечен. Индивидуальная планировка доступна в списке ниже.';
      selected?.focus({preventScroll:true});
    }
    host.querySelectorAll('.owned-unit,.published-unit').forEach(el=>{
      const open=()=>el.classList.contains('owned-unit')?showApartment(el.dataset.planId):ReferenceCatalog.openPlan(el.dataset.planId);
      el.onclick=open;
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
    });
    host.querySelectorAll('.unpublished-unit').forEach(el=>el.onclick=()=>toast('В снимке каталога нет опубликованной карточки этой квартиры'));
  }catch{
    if(token===mapRequest&&host.isConnected)host.innerHTML='<div class="plan-loading">Не удалось загрузить план.<button class="secondary" onclick="loadFloor(mapRequest)">Повторить</button></div>';
  }
}
function showApartment(id){const a=residences.find(a=>a.id===id);if(!a){toast('Откройте планировку в публичном каталоге');return false}document.querySelector('#sheet-body').innerHTML=`<div class="apartment-topline"><span class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span><span>ДЕМО-ДОСТУП</span></div><h2>Квартира ${a.number}</h2><p>Корпус ${a.building} · ${a.floor} этаж · ${a.rooms}</p><div class="apartment-plan"><img src="${a.image}" alt="Планировка квартиры ${a.number} с официального сайта" onerror="this.parentElement.innerHTML='Изображение планировки недоступно'"></div><div class="apartment-specs"><div><strong>${a.area}<small> м²</small></strong><span>Общая площадь</span></div><div><strong>${a.floor}<small> этаж</small></strong><span>Корпус ${a.building}</span></div></div><button class="primary" onclick="selectResidence('${a.id}');navigate('smart')">Выбрать квартиру и перейти в мой дом</button><button class="secondary" onclick="closeSheet();goApartment('${a.id}')">Показать на этаже</button><p class="map-footnote">Реальная публичная планировка застройщика. Принадлежность квартиры резиденту смоделирована. Устройство умного дома пока общее для демонстрации.</p>`;const d=document.querySelector('#sheet');if(!d.open)d.showModal();d.scrollTop=0;return true}
render();

function originalMapMarkup(){return `<section class="map-original-card"><button data-open-original="forecourt" aria-label="Открыть оригинальную панораму площади"><img src="assets/reference/selector-new.webp" alt="Визуализация Родина Переделкино из материалов застройщика"><span class="map-original-caption"><b>Родина Переделкино в оригинале</b><small>Осмотрите проект с опубликованных панорамных точек. Внутри — метки объектов, дневной и вечерний виды, исходная съёмка участка и переход к планам корпусов.</small></span></button><button class="original-entry" data-open-original="forecourt"><span><strong>Открыть панорамную карту</strong><small>Исходные изображения застройщика</small></span><span>↗</span></button></section><div class="map-source-actions"><button data-open-original="forecourt">Площадь и галерея</button><button data-open-original="arena">Арена</button><button data-open-original="courtyard">Двор</button><button data-open-original="forest">Лес и дороги</button><button data-open-original="metro">Метро</button></div><p class="map-footnote">Это панорамные точки обзора. Свободное перемещение по реконструированной объёмной сцене доступно во вкладке «3D-карта».</p>`}
