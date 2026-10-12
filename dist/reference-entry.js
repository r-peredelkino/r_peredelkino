import {createReferenceExplorer} from './reference-explorer.js?v=community38';

let active=null,surfaces=[],opener=null;
function restore(){
 document.body.classList.remove('reference-open');
 for(const [element,inert] of surfaces)if(element.isConnected)element.inert=inert;
 const previous=opener;
 surfaces=[];active=null;opener=null;window.referenceExplorer=null;
 queueMicrotask(()=>{
  if(document.body.classList.contains('reference-open'))return;
  const usable=previous&&previous!==document.body&&previous.isConnected&&!previous.closest('[inert]')&&previous.getClientRects().length;
  const target=usable?previous:document.querySelector('.map-segment [aria-pressed="true"], #welcome-next');
  target?.focus({preventScroll:true});
 });
}
window.openOriginalExplorer=(area='forecourt')=>{
 if(active){active.focusArea(area);return active;}
 opener=document.activeElement;
 surfaces=[...document.querySelectorAll('#welcome,#app,.desktop')].map(element=>[element,element.inert]);
 for(const [element] of surfaces)element.inert=true;
 document.body.classList.add('reference-open');
 try{
  active=createReferenceExplorer({initialArea:area,onClose:restore,onOpenBuilding(id){
   active?.close();
   window.closeWelcomeForMap?.();
   const welcome=document.querySelector('#welcome');if(welcome)welcome.hidden=true;
   document.body.classList.remove('welcome-open');document.querySelector('#app').inert=false;document.querySelector('.desktop').inert=false;
   window.chooseBuilding?.(Number(id));window.navigate?.('map');
  }});
  window.referenceExplorer=active;return active;
 }catch(error){restore();window.toast?.('Не удалось открыть панораму. Попробуйте обновить страницу.');console.error(error);return null;}
};

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-open-original]');
 if(button){event.preventDefault();window.openOriginalExplorer(button.dataset.openOriginal||'forecourt');}
});
window.addEventListener('pagehide',()=>{active?.destroy();restore();});
