const projectUrl='https://rodina-peredelkino.ru/';
const groupUrl='https://rodinagroup.com/';
const repoUrl='https://github.com/r-peredelkino/r_peredelkino';
let about;
window.openPublicationAbout=()=>{
 if(!about){
  about=document.createElement('dialog');about.className='publication-about';
  about.setAttribute('aria-labelledby','publication-title');
  about.innerHTML=`<header><span>Группа создателей концепта @r_peredelkino</span><button type="button" aria-label="Закрыть описание">×</button></header><h2 id="publication-title">Родина Переделкино:<br>пространство, которое можно исследовать</h2><p>Любительская 3D-реконструкция, вдохновлённая жилым комплексом Группы Родина. Здесь можно самостоятельно пройти по двору, осмотреть общественные пространства и исследовать 17 меблированных квартир.</p><p>Меблировка и интерактивные сценарии — предложения авторов. Планировки восстановлены по опубликованным изображениям; каталог сохраняет снимок от 9 октября 2026 года. Утверждённые характеристики и актуальные предложения уточняйте у застройщика.</p><div class="publication-links"><a href="${projectUrl}" target="_blank" rel="noopener noreferrer">Официальный сайт ЖК ↗</a><a href="${groupUrl}" target="_blank" rel="noopener noreferrer">Группа Родина ↗</a><a href="${repoUrl}" target="_blank" rel="noopener noreferrer">Проект, исходники и Issues ↗</a></div><p class="publication-note">«Сделано тремя программистами за булку хлеба и двадцать кофейных стаканов» — так начиналась эта инициатива. После публикации на GitHub к команде присоединились программисты, которые тоже приобрели здесь квартиры. Мы хотим, чтобы самостоятельная прогулка становилась привычной частью знакомства с будущим жильём.</p><p class="publication-note">В планах — карты для Unity, Unreal Engine 5 и следующих версий, Valve Source / Source 2 и других движков, а также возможные многопользовательские проекты.</p>`;
  about.querySelector('button').addEventListener('click',()=>about.close());
  about.addEventListener('click',event=>{if(event.target===about){const r=about.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)about.close();}});
  document.body.append(about);
 }
 if(!about.open)about.showModal();
};
