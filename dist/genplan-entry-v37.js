// @r_peredelkino · public 3D genplan, without demo ownership restrictions.
import {apartment3DExamples,getApartmentRecord} from './apartment-catalog-v37.js?v=publication371';
const format=value=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:1});
window.mountPublicApartmentPicker=()=>{
 const select=document.querySelector('[data-plan-catalog]'),button=document.querySelector('[data-open-plan]');if(!select||!button)return;
 select.replaceChildren();for(const record of apartment3DExamples){const option=document.createElement('option');option.value=record.id;option.textContent=`${record.title} · корпус ${record.building} · №${record.number}`;select.append(option);}
 const last=window.lastPublicApartmentId;if(last&&apartment3DExamples.some(r=>r.id===last))select.value=last;
 button.disabled=!select.value;select.onchange=()=>{button.disabled=!select.value;};button.onclick=()=>{window.lastPublicApartmentId=select.value;window.showApartment?.(select.value);};
};
window.goApartment=id=>{
 const record=getApartmentRecord(id);if(!record){window.toast?.('Планировка не найдена');return false;}
 mapBuilding=record.building;mapFloor=record.floor;mapSelectedApartment=record;mapView='floor';window.navigate('map');return true;
};
window.selectResidence=id=>{const record=getApartmentRecord(id);if(!record)return false;window.lastPublicApartmentId=id;return true;};
// Source cards offer 3D only for that individually reconstructed layout.
window.mountReferenceApartment3D=(content,id,dialog)=>{
 const record=getApartmentRecord(id);if(!record?.has3D||content.querySelector('[data-reference-3d]'))return;
 const button=document.createElement('button');button.type='button';button.className='primary';button.dataset.reference3d=id;button.textContent=`3D-пример · ${format(record.area)} м²`;button.onclick=()=>{dialog.close();window.showApartment?.(id);};content.querySelector('.ref-plan-actions')?.append(button);
};
window.navigate('map');
