// Interactive reconstruction: @r_peredelkino · RP-CONCEPT-2026-10-07
// Published developer plans are a public reference; they do not change demo residence grants.
(() => {
  'use strict';
  const assetVersion = 'references37';
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const area = value => Number(value).toLocaleString('ru-RU', {maximumFractionDigits: 2});
  const roomLabel = value => Number(value) === 0 ? 'Студия' : `${value}-комнатная`;
  const shortDate = value => value.split('-').reverse().join('.');
  let catalogPromise, genplanPromise, catalog, genplan, currentDialog;
  const filters = {building:'', floor:'', rooms:'', min:'', max:'', number:'', sort:'building', page:1};
  const pageSize = 12;

  async function json(path) {
    const response = await fetch(`${path}?v=${assetVersion}`);
    if (!response.ok) throw new Error(`Не удалось загрузить данные (${response.status})`);
    return response.json();
  }
  function load() {
    if (!catalogPromise) catalogPromise = json('assets/reference/catalog.json').then(data => {
      if (!Array.isArray(data.apartments) || !data.apartments.length) throw new Error('Каталог пуст');
      catalog = data;
      return data;
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function loadGenplan() {
    if (!genplanPromise) genplanPromise = json('assets/reference/genplan.json').then(data => {
      if (data.buildings.length !== 5 || data.viewBox.length !== 4) throw new Error('Схема не загружена');
      genplan = data;
      return data;
    }).catch(error => { genplanPromise = null; throw error; });
    return genplanPromise;
  }
  function fail(host, retry) {
    if (!host.isConnected) return;
    host.innerHTML = '<div class="ref-empty"><h3>Не удалось открыть материалы</h3><p>Проверьте, что проект запущен через локальный сервер.</p><button type="button">Повторить загрузку</button></div>';
    host.querySelector('button').onclick = retry;
  }
  function loading(host, text) {
    host.innerHTML = `<div class="ref-loading" role="status">${h(text)}</div>`;
  }
  function configure(next = {}) {
    Object.assign(filters, next);
    filters.page = 1;
  }
  function filteredApartments() {
    const query = filters.number.trim().toLowerCase();
    const list = catalog.apartments.filter(a =>
      (!filters.building || a.building === Number(filters.building)) &&
      (!filters.floor || a.floor === Number(filters.floor)) &&
      (filters.rooms === '' || a.rooms === Number(filters.rooms)) &&
      (filters.min === '' || a.area >= Number(filters.min)) &&
      (filters.max === '' || a.area <= Number(filters.max)) &&
      (!query || String(a.number).includes(query) || a.id.toLowerCase().includes(query))
    );
    const sorts = {
      building: (a,b) => a.building-b.building || a.floor-b.floor || a.number-b.number,
      area: (a,b) => a.area-b.area || a.building-b.building || a.number-b.number,
      areaDesc: (a,b) => b.area-a.area || a.building-b.building || a.number-b.number,
      floor: (a,b) => a.floor-b.floor || a.building-b.building || a.number-b.number
    };
    return list.sort(sorts[filters.sort] || sorts.building);
  }
  function options(values, selected, label = v => v) {
    return values.map(value => `<option value="${h(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${h(label(value))}</option>`).join('');
  }
  function floorsForBuilding() {
    return [...new Set(catalog.apartments.filter(a => !filters.building || a.building === +filters.building).map(a => a.floor))].sort((a,b) => a-b);
  }
  function planCard(a) {
    return `<button class="ref-plan-card" type="button" data-public-plan="${h(a.id)}" aria-label="${h(`${roomLabel(a.rooms)}, ${area(a.area)} м², корпус ${a.building}, квартира ${a.number}`)}">
      <span class="ref-card-image"><img src="${h(a.image2d)}" alt="Планировка квартиры ${h(a.number)}" loading="lazy" decoding="async"></span>
      <span class="ref-card-kicker">КОРПУС ${a.building} · ${a.floor} ЭТАЖ</span>
      <strong>${area(a.area)} <small>м²</small><span aria-hidden="true">↗</span></strong>
      <span class="ref-card-bottom">${roomLabel(a.rooms)}<b>№ ${a.number}</b></span>
      ${a.reserved ? '<span class="ref-reserved">Бронь на дату публикации</span>' : ''}
    </button>`;
  }
  function wireCards(host) {
    host.querySelectorAll('[data-public-plan]').forEach(button => button.onclick = () => openPlan(button.dataset.publicPlan));
    host.querySelectorAll('.ref-card-image img').forEach(img => img.onerror = () => {
      img.parentElement.textContent = 'Открыть планировку';
    });
  }
  async function mountCatalog(host, next) {
    if (next) configure(next);
    loading(host, 'Загружаем опубликованные планировки…');
    try {
      await load();
      if (!host.isConnected) return;
      host.innerHTML = `<div class="ref-intro"><span class="ref-kicker">ПЛАНИРОВКИ ЗАСТРОЙЩИКА</span><h3>Найдите свой ракурс</h3><p>Изучите квартиры, сравните площади и откройте расположение на этаже.</p></div>
        <form class="ref-filters" aria-label="Фильтры планировок">
          <label>Корпус<select name="building"><option value="">Все корпуса</option>${options([1,2,3,4,5], filters.building, v => `Корпус ${v}`)}</select></label>
          <label>Этаж<select name="floor"><option value="">Все этажи</option>${options(floorsForBuilding(), filters.floor, v => `${v} этаж`)}</select></label>
          <label>Комнаты<select name="rooms"><option value="">Любое число</option>${options([0,2,3,4], filters.rooms, roomLabel)}</select></label>
          <label>Квартира<input name="number" type="search" placeholder="Номер или 1-59" value="${h(filters.number)}" autocomplete="off"></label>
          <fieldset><legend>Площадь, м²</legend><div><input name="min" type="number" min="0" max="200" step="0.1" placeholder="От 24,1" aria-label="Минимальная площадь" value="${h(filters.min)}"><span>—</span><input name="max" type="number" min="0" max="200" step="0.1" placeholder="До 96,9" aria-label="Максимальная площадь" value="${h(filters.max)}"></div></fieldset>
          <label>Порядок<select name="sort">${options(['building','area','areaDesc','floor'], filters.sort, v => ({building:'По корпусу',area:'Площадь ↑',areaDesc:'Площадь ↓',floor:'По этажу'}[v]))}</select></label>
        </form><div class="ref-result-bar"><p role="status" aria-live="polite"></p><button class="ref-reset" type="button">Сбросить</button></div><div class="ref-catalog-results"></div>
        <p class="ref-source">${catalog.apartments.length} опубликованные карточки · ${shortDate(catalog.asOf)}.<br><a href="${h(catalog.sourceUrl)}" target="_blank" rel="noopener noreferrer">Каталог на сайте застройщика ↗</a></p>`;
      const form = host.querySelector('form');
      form.onsubmit = event => event.preventDefault();
      const update = event => {
        const input = event.target;
        if (!(input.name in filters)) return;
        filters[input.name] = input.value;
        filters.page = 1;
        if (input.name === 'building') {
          filters.floor = '';
          form.elements.floor.innerHTML = `<option value="">Все этажи</option>${options(floorsForBuilding(), '')}`;
        }
        drawResults(host);
      };
      form.querySelectorAll('select').forEach(input => input.onchange = update);
      form.querySelectorAll('input').forEach(input => input.oninput = update);
      host.querySelector('.ref-reset').onclick = () => mountCatalog(host, {building:'',floor:'',rooms:'',min:'',max:'',number:'',sort:'building'});
      drawResults(host);
    } catch { fail(host, () => mountCatalog(host)); }
  }
  function drawResults(host) {
    const list = filteredApartments(), pageCount = Math.max(1, Math.ceil(list.length/pageSize));
    filters.page = Math.min(filters.page, pageCount);
    const start = (filters.page-1)*pageSize, visible = list.slice(start, start+pageSize);
    host.querySelector('.ref-result-bar p').textContent = `${list.length} из ${catalog.apartments.length} планировок`;
    const results = host.querySelector('.ref-catalog-results');
    results.innerHTML = list.length ? `<div class="ref-plan-grid">${visible.map(planCard).join('')}</div><div class="ref-pagination"><button type="button" data-page="prev" ${filters.page===1?'disabled':''} aria-label="Предыдущая страница">←</button><span>${start+1}–${start+visible.length} из ${list.length}<small>Страница ${filters.page} / ${pageCount}</small></span><button type="button" data-page="next" ${filters.page===pageCount?'disabled':''} aria-label="Следующая страница">→</button></div>` : '<div class="ref-empty"><h3>Таких планировок в каталоге нет</h3><p>Попробуйте другой этаж или расширьте диапазон площади.</p></div>';
    wireCards(results);
    results.querySelectorAll('[data-page]').forEach(button => button.onclick = () => {
      filters.page += button.dataset.page === 'next' ? 1 : -1;
      drawResults(host);
      host.querySelector('.ref-result-bar').scrollIntoView({block:'start',behavior:'instant'});
    });
  }
  function showFloor(a) {
    currentDialog?.close();
    mapBuilding = Number(a.building);
    mapFloor = Number(a.floor);
    mapSelectedApartment = a;
    mapView = 'floor';
    mapZoom = 1;
    navigate('map');
  }
  function dialog(title) {
    currentDialog?.close();
    const element = document.createElement('dialog');
    element.className = 'reference-dialog';
    element.setAttribute('aria-label', title);
    element.innerHTML = '<button type="button" class="ref-dialog-close" aria-label="Закрыть">×</button><div class="ref-dialog-content"></div>';
    document.body.append(element);
    element.querySelector('.ref-dialog-close').onclick = () => element.close();
    element.addEventListener('click', event => { if (event.target === element) element.close(); });
    element.addEventListener('close', () => { element.remove(); if (currentDialog === element) currentDialog = null; });
    currentDialog = element;
    element.showModal();
    return element;
  }
  async function openPlan(id) {
    try {
      await load();
      const a = catalog.apartments.find(item => item.id === id);
      if (!a) { window.toast?.('В опубликованном каталоге нет этой карточки'); return; }
      const element = dialog(`Планировка: корпус ${a.building}, квартира ${a.number}`);
      const content = element.querySelector('.ref-dialog-content');
      content.innerHTML = `<header class="ref-plan-header"><span class="ref-kicker">КОРПУС ${a.building} · ${a.floor} ЭТАЖ</span><h2>${roomLabel(a.rooms)} <span>${area(a.area)} м²</span></h2><p>Квартира № ${a.number}${a.reserved?' · Бронь на дату публикации':''}</p></header>
        <div class="ref-plan-image"><img src="${h(a.image2d)}" alt="Официальная планировка: корпус ${a.building}, квартира ${a.number}, ${area(a.area)} квадратных метров"></div>
        <div class="ref-image-tools"><button type="button" data-scale="minus" aria-label="Уменьшить план">−</button><span>100%</span><button type="button" data-scale="plus" aria-label="Увеличить план">+</button><button type="button" data-scale="reset">По размеру окна</button></div>
        ${a.positionInFloorSource===false?'<p class="ref-floor-empty">В официальной схеме этажа контур этой квартиры не отмечен. Её индивидуальная планировка показана выше.</p>':''}
        <div class="ref-plan-actions"><button type="button" class="primary" data-show-floor>${a.positionInFloorSource===false?'Открыть план этажа':'Показать на этаже'} →</button><a href="${h(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">Карточка застройщика ↗</a></div>
        <p class="ref-source">Официальная 2D-планировка · данные на ${shortDate(catalog.asOf)}. Текущий статус квартиры — на сайте застройщика.</p>`;
      window.mountReferenceApartment3D?.(content,id,element);
      const img = content.querySelector('.ref-plan-image img');
      img.onerror = () => { img.parentElement.innerHTML = '<p class="ref-image-error">Изображение не загрузилось. Откройте карточку застройщика по ссылке ниже.</p>'; };
      let zoom = 1;
      const imageViewport = content.querySelector('.ref-plan-image');
      const fitImage = () => { img.style.width = `${Math.min(imageViewport.clientWidth, imageViewport.clientHeight)*zoom}px`; img.style.maxWidth = 'none'; };
      const imageObserver = new ResizeObserver(fitImage);
      imageObserver.observe(imageViewport);
      element.addEventListener('close', () => imageObserver.disconnect(), {once:true});
      fitImage();
      content.querySelectorAll('[data-scale]').forEach(button => button.onclick = () => {
        zoom = button.dataset.scale === 'reset' ? 1 : Math.max(1, Math.min(4, zoom + (button.dataset.scale === 'plus' ? .5 : -.5)));
        fitImage();
        content.querySelector('.ref-image-tools span').textContent = `${Math.round(zoom*100)}%`;
      });
      content.querySelector('[data-show-floor]').onclick = () => showFloor(a);
    } catch { window.toast?.('Не удалось загрузить каталог планировок'); }
  }
  async function mountFloorList(host, building, floor) {
    try {
      await load();
      if (!host.isConnected) return;
      const lots = catalog.apartments.filter(a => a.building === +building && a.floor === +floor);
      host.innerHTML = lots.length ? `<div class="section-title"><h3>Планировки этажа</h3><span class="access-count">${lots.length} опубликовано</span></div><div class="ref-floor-lots">${lots.map(a => `<button type="button" data-public-plan="${h(a.id)}" ${mapSelectedApartment?.id===a.id?'class="is-selected" aria-current="true"':''}><span>№ ${a.number}<small>${roomLabel(a.rooms)}${a.positionInFloorSource===false?' · без контура на схеме':''}</small></span><strong>${area(a.area)} м² <b>↗</b></strong></button>`).join('')}</div>` : '<div class="ref-floor-empty">В снимке каталога нет опубликованных квартир этого этажа. Контуры показаны по официальному плану.</div>';
      wireCards(host);
    } catch { fail(host, () => mountFloorList(host, building, floor)); }
  }
  function genplanMarkup(data, selected) {
    const [,,w,hg] = data.viewBox;
    return `<div class="ref-masterplan-scroll"><svg class="ref-masterplan-svg" viewBox="${data.viewBox.join(' ')}" xmlns="http://www.w3.org/2000/svg" aria-label="Официальный генплан. Выберите жилой корпус">
      <image href="${h(data.image)}" x="0" y="0" width="${w}" height="${hg}" preserveAspectRatio="xMidYMid slice"/>
      ${data.buildings.map(b => `<g class="ref-building ${b.id===selected?'is-selected':''}" data-reference-building="${b.id}" role="button" tabindex="0" aria-label="${h(b.label)}, ${b.count} опубликованных планировок" aria-pressed="${b.id===selected}"><path d="${h(b.path)}"/><g class="ref-building-label" transform="translate(${b.anchor[0]} ${b.anchor[1]})"><circle r="19"/><text y="7" text-anchor="middle">${b.id}</text></g></g>`).join('')}
      </svg></div><div class="ref-building-picker" aria-label="Жилые корпуса">${data.buildings.map(b => `<button type="button" data-reference-building="${b.id}" class="${b.id===selected?'is-selected':''}">Корпус ${b.id}<small>${b.count} планировок</small></button>`).join('')}</div><div class="ref-building-info"></div>`;
  }
  function wireGenplan(host, selected) {
    const select = id => {
      selected = Number(id);
      const b = genplan.buildings.find(item => item.id === selected);
      if (!b) return;
      host.querySelectorAll('[data-reference-building]').forEach(el => {
        const active = +el.dataset.referenceBuilding === selected;
        el.classList.toggle('is-selected', active);
        el.setAttribute('aria-pressed', String(active));
      });
      const info = host.querySelector('.ref-building-info');
      info.innerHTML = `<div><span class="ref-kicker">ЖИЛОЙ КОРПУС ${b.id}</span><h3>${b.count} планировок</h3><p>Официальные планы этажей: ${Math.min(...b.floors)}–${Math.max(...b.floors)}</p></div><div class="ref-building-actions"><button type="button" data-building-catalog>Смотреть квартиры →</button><button type="button" data-building-floor>Поэтажный план</button></div>`;
      info.querySelector('[data-building-catalog]').onclick = () => {
        currentDialog?.close();
        configure({building:String(b.id),floor:'',rooms:'',min:'',max:'',number:''});
        mapBuilding = b.id;
        mapView = 'catalog';
        navigate('map');
      };
      info.querySelector('[data-building-floor]').onclick = () => { currentDialog?.close(); chooseBuilding(b.id); };
    };
    host.querySelectorAll('[data-reference-building]').forEach(el => {
      el.onclick = () => select(el.dataset.referenceBuilding);
      if (el.tagName.toLowerCase() === 'g') el.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(el.dataset.referenceBuilding); } };
    });
    select(selected);
  }
  async function mountGenplan(host, selected = 1, expanded = false) {
    loading(host, 'Открываем официальный генплан…');
    try {
      await loadGenplan();
      if (!host.isConnected) return;
      host.classList.toggle('ref-genplan-expanded', expanded);
      host.innerHTML = `<div class="ref-intro"><span class="ref-kicker">ПЛАН КОМПЛЕКСА</span><h3>Пять корпусов. Весь двор.</h3><p>Выберите башню на официальном рендере, затем откройте этаж или планировку.</p></div>${expanded?'':'<div class="ref-genplan-open-row"><button type="button" data-expand-genplan>Развернуть генплан ⤢</button></div>'}${genplanMarkup(genplan, selected)}
        <div class="ref-genplan-tools"><a href="https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/" target="_blank" rel="noopener noreferrer">Официальная 3D-панорама ↗</a></div><p class="ref-source"><a href="${h(genplan.sourceUrl)}" target="_blank" rel="noopener noreferrer">Генплан застройщика ↗</a> · ${shortDate(genplan.asOf)}</p>`;
      wireGenplan(host, selected);
      const expand = host.querySelector('[data-expand-genplan]');
      if (expand) expand.onclick = () => {
        const selectedId = +(host.querySelector('.ref-building.is-selected')?.dataset.referenceBuilding || selected);
        const element = dialog('Официальный генплан Родина Переделкино');
        element.classList.add('reference-map-dialog');
        mountGenplan(element.querySelector('.ref-dialog-content'), selectedId, true);
      };
    } catch { fail(host, () => mountGenplan(host, selected, expanded)); }
  }
  window.ReferenceCatalog = Object.freeze({load, loadGenplan, configure, mountCatalog, mountGenplan, mountFloorList, openPlan, roomLabel});
})();
