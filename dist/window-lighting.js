// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import * as THREE from './vendor/three.module.js';
const palettes=[0xffdcaa,0xffc77d,0xf2ead0,0xd9e9f5,0xffe4bf];
function hash(value){let n=Math.imul(value^0x65ac87,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return((n^(n>>>16))>>>0)/4294967296}
// Residential rooms stay independent. Connected shop panes share a room and lighting schedule.
export function createWindowLighting(geometry,count,{seed=1,columns=55,kind='residential',brandTexture=null,interiorTexture=null,interiorGroups=null}={}){
 const connected=!!(interiorTexture&&kind==='commercial'&&interiorGroups);
 if(connected&&(interiorGroups.length!==count||interiorGroups.some(p=>!p||![p.groupId,p.style,p.u0,p.u1,p.tier].every(Number.isFinite))))throw new RangeError('Each commercial pane needs a finite interior group and UV interval.');
 const strengths=new Float32Array(count),tints=new Float32Array(count*3),daylight=new Float32Array(count),night={value:0},masked=new Set();
 const material=new THREE.MeshStandardMaterial({color:0x71817f,roughness:.27,metalness:.10,envMapIntensity:.45,emissive:0xffffff,emissiveIntensity:2.8});
 if(interiorTexture){
  material.map=interiorTexture;material.emissiveMap=interiorTexture;material.color.set(0xffffff);material.roughness=.48;material.metalness=.08;
  geometry.setAttribute('shopStyle',new THREE.InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>connected?interiorGroups[i].style:Math.floor(hash(seed+i*17)*4)),1));
 }
 if(connected){
  geometry.setAttribute('shopUVRange',new THREE.InstancedBufferAttribute(Float32Array.from(interiorGroups.flatMap(p=>[p.u0,p.u1])),2));
  geometry.setAttribute('shopTier',new THREE.InstancedBufferAttribute(Float32Array.from(interiorGroups,p=>p.tier),1));
  geometry.setAttribute('shopReverse',new THREE.InstancedBufferAttribute(Float32Array.from(interiorGroups,p=>p.reverse??0),1));
 }
 geometry.setAttribute('paneGlow',new THREE.InstancedBufferAttribute(strengths,1));geometry.setAttribute('paneTint',new THREE.InstancedBufferAttribute(tints,3));
 // The atlas depicts a room behind the pane. Its indirect daylight must not
 // disappear when the exterior floor band shadows the glass. This modest
 // fill is separate from the existing per-room night lighting schedule.
 // Upper galleries already have a quieter source atlas; a second dark tint
 // is not needed to distinguish the two complete commercial storeys.
 for(let i=0;i<count;i++)daylight[i]=interiorTexture?(connected?(interiorGroups[i].tier===1?.075:.055):.024):.010;
 geometry.setAttribute('paneDaylight',new THREE.InstancedBufferAttribute(daylight,1));
 material.userData.referenceGlazing={sourceViews:['2026-10-11 09.29.18','2026-10-11 09.29.23'],indirectInteriorDaylight:true,reflection:'Scene environment; no painted blue reflection stripe',envMapIntensity:.45};
 for(let i=0;i<count;i++){
  const room=connected?interiorGroups[i].groupId:Math.floor(i/3),c=new THREE.Color(palettes[Math.floor(hash(seed*97+room)*palettes.length)]);c.toArray(tints,i*3);
 }
 material.onBeforeCompile=shader=>{
  shader.uniforms.nightFactor=night;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float paneGlow;\nattribute vec3 paneTint;\nattribute float paneDaylight;\nvarying float vPaneGlow;\nvarying vec3 vPaneTint;\nvarying float vPaneDaylight;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPaneGlow=paneGlow;\nvPaneTint=paneTint;\nvPaneDaylight=paneDaylight;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float nightFactor;\nvarying float vPaneGlow;\nvarying vec3 vPaneTint;\nvarying float vPaneDaylight;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vec3(vPaneDaylight) * (1.0-nightFactor) + vPaneTint * vPaneGlow * nightFactor;');
 };
 const windowCompile=material.onBeforeCompile;
 if(interiorTexture)material.onBeforeCompile=shader=>{
  windowCompile(shader);
  if(connected){
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float shopStyle;\nattribute vec2 shopUVRange;\nattribute float shopTier;\nattribute float shopReverse;\nvarying vec2 vShopUV;\nvarying vec2 vShopGlassUV;\nvarying float vShopTier;').replace('#include <begin_vertex>','#include <begin_vertex>\nfloat localShopU=mix(uv.x,1.0-uv.x,shopReverse);\nfloat sharedShopU=clamp(mix(shopUVRange.x,shopUVRange.y,localShopU),.002,.998);\nvShopUV=vec2((sharedShopU+shopStyle)*.25,(1.0-shopTier+clamp(uv.y,.003,.997))*.5);\nvShopGlassUV=vec2(sharedShopU,uv.y);\nvShopTier=shopTier;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vShopUV;\nvarying vec2 vShopGlassUV;\nvarying float vShopTier;').replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor *= texture2D(map,vShopUV);\n#endif').replace('#include <emissivemap_fragment>','#ifdef USE_EMISSIVEMAP\ntotalEmissiveRadiance *= texture2D(emissiveMap,vShopUV).rgb;\n#endif');
   // Reflections now come from the PBR environment shared with the actual
   // scene. Retain the connected atlas and its storey-specific furnishings.
  }else{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float shopStyle;\nvarying vec2 vShopUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nvShopUV=vec2((clamp(uv.x,.015,.985)+shopStyle)*.25,uv.y);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vShopUV;').replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor *= texture2D(map,vShopUV);\n#endif').replace('#include <emissivemap_fragment>','#ifdef USE_EMISSIVEMAP\ntotalEmissiveRadiance *= texture2D(emissiveMap,vShopUV).rgb;\n#endif');
  }
 };
 material.customProgramCacheKey=()=>connected?'rodina-connected-commercial-interiors-indirect-daylight-no-visible-author':interiorTexture?'rodina-residential-interiors-indirect-daylight-no-visible-author':'rodina-office-glazing-indirect-daylight-no-visible-author';
 let lastEpoch=-1,lastHour=-1;const records=[];
 for(let i=0;i<count;i++){
  const floor=connected?interiorGroups[i].tier:Math.floor(i/columns),room=connected?interiorGroups[i].groupId:Math.floor((i%columns)/3),key=seed*1907+floor*271+room*37;
  records.push({key,random:hash(key),phase:hash(key+9)*170,period:60+hash(key+27)*230});
 }
 function update(seconds,hour=21,strength=0){
  night.value=strength;const epoch=Math.floor(seconds/2),h=Math.floor(hour*12);if(epoch===lastEpoch&&h===lastHour)return;lastEpoch=epoch;lastHour=h;
  const late=hour<5||hour>=1&&hour<7;let probability=kind==='commercial'?(hour>=8&&hour<23?.72:.18):kind==='office'?(hour>=7&&hour<21?.57:.16):(late?.18:hour>=18&&hour<24?.53:.31);
  for(let i=0;i<count;i++){
   const r=records[i],cycle=Math.floor((seconds+r.phase)/r.period),chance=hash(r.key+cycle*101),lit=chance<probability&&!masked.has(i),upper=connected&&interiorGroups[i].tier===1;
   strengths[i]=lit?(.5+hash(r.key+13)*.5)*(upper?.54:1):0;
  }
  geometry.attributes.paneGlow.needsUpdate=true;
 }
 update(0);return{material,geometry,brandTexture,interiorTexture,interiorGroups,records,strengths,tints,daylight,night,kind,update,setMasked(indices){masked.clear();for(const i of indices){masked.add(i);strengths[i]=0}geometry.attributes.paneGlow.needsUpdate=true;lastEpoch=-1},get litCount(){let n=0;for(const v of strengths)if(v>0)n++;return n}};
}
