// @r_peredelkino · quality choices preserve the architectural model.
export const qualityProfiles=Object.freeze({
 fast:Object.freeze({id:'fast',label:'Экономно',pixelRatio:.9,shadowSize:1024,shadowHz:5,forestDetail:'auto',population:.45,updateHz:15,precipitation:.4}),
 balanced:Object.freeze({id:'balanced',label:'Сбалансировано',pixelRatio:1.35,shadowSize:2048,shadowHz:8,forestDetail:'auto',population:.7,updateHz:24,precipitation:.7}),
 full:Object.freeze({id:'full',label:'Детально',pixelRatio:1.75,shadowSize:4096,shadowHz:10,forestDetail:'full',population:1,updateHz:30,precipitation:1}),
 max:Object.freeze({id:'max',label:'Максимум',pixelRatio:2,shadowSize:4096,shadowHz:12,forestDetail:'full',population:1,updateHz:40,precipitation:1})
});
const ids=['fast','balanced','full'];
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function validQuality(value){return value==='auto'||Object.hasOwn(qualityProfiles,value);}

/** Auto changes at most one step after a sustained measurement, never on one
 * slow interaction, a hidden tab, or cold shader compilation. Tests can supply
 * elapsed timestamps; no timer or animation loop is owned by this controller. */
export function createQualityController({renderer,model,lighting,panel=null,mobile=false,reducedMotion=false,storage=globalThis.localStorage,pixelRatio=()=>globalThis.devicePixelRatio||1,onApply=()=>{}}={}){
 let choice='auto',effective='balanced',dead=false,lastFrame=null,warmUntil=null,lastAssessment=null,lastChange=null,samples=[],slowSince=null,fastSince=null;
 const key='rp.render-quality.v38';
 try{const saved=storage?.getItem(key);if(validQuality(saved))choice=saved;}catch{}
 if(choice!=='auto')effective=choice;
 else if(mobile)effective='fast';
 const select=panel?.querySelector('[data-quality]'),status=panel?.querySelector('[data-quality-status]');
 function apply(){
  const profile=qualityProfiles[effective];
  const dpr=clamp(Number(pixelRatio())||1,.5,profile.pixelRatio);
  if(renderer.getPixelRatio?.()!==dpr)renderer.setPixelRatio(dpr);
  model.neighborhood?.forestBatches?.forEach(batch=>batch.setDetail(profile.forestDetail));
  lighting?.setQuality?.(profile);
  model.life?.setQuality?.({...profile,reducedMotion});
  model.traffic?.setQuality?.({fast:'low',balanced:'medium',full:'high',max:'ultra'}[effective]);
  if(panel){panel.dataset.renderQuality=choice;panel.dataset.effectiveQuality=effective;}
  if(select)select.value=choice;
  if(status)status.textContent=choice==='auto'?`Сейчас: ${profile.label.toLowerCase()}. Качество подстраивается во время прогулки.`:`${profile.label}: ${effective==='fast'?'плавнее на слабых устройствах':effective==='balanced'?'баланс плавности и деталей':'больше деталей и более чёткие тени'}.`;
  onApply(profile);
 }
 function resetSampling(){lastFrame=null;warmUntil=null;lastAssessment=null;samples=[];slowSince=fastSince=null;}
 function set(value){
  if(dead||!validQuality(value))return false;
  choice=value;effective=value==='auto'?(mobile?'fast':'balanced'):value;resetSampling();
  try{storage?.setItem(key,choice);}catch{}
  apply();return true;
 }
 function recordFrame(now){
  if(dead||choice!=='auto'||!Number.isFinite(now))return;
  if(lastFrame===null){lastFrame=now;warmUntil=now+5000;lastAssessment=now;lastChange=now;return;}
  const dt=now-lastFrame;lastFrame=now;
  // Long background/dialog pauses are not performance samples. Heavy devices
  // may genuinely render only 2–6 frames/s; retain those consecutive frames so
  // auto quality can still respond. The host resets sampling when rendering is
  // intentionally suspended, and one isolated slow interaction cannot change
  // the sustained 75th-percentile budget.
  if(dt<=0||dt>1000){samples=[];slowSince=fastSince=null;return;}
  if(now<warmUntil)return;
  samples.push(dt);if(samples.length>90)samples.shift();
  if(samples.length<45||now-lastAssessment<1000)return;
  lastAssessment=now;
  const sorted=samples.slice().sort((a,b)=>a-b),p75=sorted[Math.floor((sorted.length-1)*.75)];
  slowSince=p75>42?(slowSince??now):null;
  fastSince=p75<24?(fastSince??now):null;
  const index=ids.indexOf(effective);
  if(index>0&&slowSince!==null&&now-slowSince>=3500&&now-lastChange>=6000){effective=ids[index-1];lastChange=now;samples=[];slowSince=fastSince=null;apply();}
  else if(index<ids.length-1&&fastSince!==null&&now-fastSince>=12000&&now-lastChange>=18000){effective=ids[index+1];lastChange=now;samples=[];slowSince=fastSince=null;apply();}
 }
 if(select)select.onchange=event=>set(event.target.value);
 apply();
 return{set,recordFrame,resetSampling,getState:()=>({choice,effective,...qualityProfiles[effective],pixelRatio:renderer.getPixelRatio?.()}),dispose(){if(dead)return;dead=true;samples=[];if(select)select.onchange=null;}};
}
