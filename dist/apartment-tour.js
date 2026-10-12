// @r_peredelkino · apartment walking, physical fixture actions and safe resting views.
import * as T from './vendor/three.module.js';
import {insideRing} from './walk-physics.js?v=community38';

const MOVEMENT_CODES=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const editable=target=>target instanceof Element&&!!target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
const copyPose=p=>p?{...p}:null;

export function createApartmentTour({host,canvas,camera,controls,apartment,actions=null,reducedMotion=false,onChange=()=>{},onFurniture=()=>{},onLighting=()=>{}}){
 const hud=document.createElement('div');hud.className='apartment-tour-hud';hud.hidden=true;
 hud.innerHTML=`<header class="apt-tour-head"><div><small>МОЯ КВАРТИРА · ${apartment.data.floor} ЭТАЖ</small><strong>Прогулка внутри</strong></div><button class="apt-exit" type="button">К планировке ↗</button></header><div class="apt-tour-rooms"></div><div class="apt-tour-actions"><button class="apt-furniture" type="button">Без мебели</button><div class="apt-interaction-picker"><select data-apt-interaction aria-label="Объект в квартире"></select><button data-apt-action type="button">Взаимодействовать</button></div><button data-apt-stand type="button" hidden>Встать</button><button data-apt-lights type="button" aria-pressed="false">Включить свет</button><button class="apt-expand" type="button" aria-label="На весь экран">⛶</button></div><div class="apt-crosshair" aria-hidden="true"></div><div class="apt-tour-bottom"><div class="apt-stick apt-move" aria-label="Джойстик движения"><span></span><small>ИДТИ</small></div><div class="apt-tour-help"><strong role="status">Прихожая</strong><p>WASD — идти · потяните вид — осмотреться<br>E — предмет рядом · на телефоне — два стика</p><div class="apt-interaction-status" role="status" aria-live="polite"></div></div><div class="apt-stick apt-look" aria-label="Джойстик осмотра"><span></span><small>ОСМОТР</small></div></div>`;
 const roomList=hud.querySelector('.apt-tour-rooms');apartment.data.rooms.forEach((room,i)=>{const button=document.createElement('button');button.type='button';button.dataset.aptRoom=i;button.textContent=room.name;roomList.append(button);});
 const actionBar=hud.querySelector('.apt-tour-actions'),picker=hud.querySelector('[data-apt-interaction]'),actionButton=hud.querySelector('[data-apt-action]'),standButton=hud.querySelector('[data-apt-stand]'),lightButton=hud.querySelector('[data-apt-lights]'),status=hud.querySelector('.apt-interaction-status');
 actionBar.style.flexWrap='wrap';actionBar.style.alignItems='center';picker.style.pointerEvents='auto';picker.style.touchAction='auto';
 const fade=document.createElement('div');fade.className='apt-pose-transition';fade.setAttribute('aria-hidden','true');Object.assign(fade.style,{position:'absolute',inset:'0',zIndex:'100',background:'#0d1718',opacity:'0',pointerEvents:'none',transition:'opacity 90ms ease'});hud.append(fade);
 host.append(hud);
 const listeners=[],keys=new Set(),timers=new Set();let enabled=false,expanded=false,saved=null,position={x:0,z:0},yaw=0,pitch=0,eyeHeight=1.68,last=null,move={x:0,y:0},look={x:0,y:0},drag=null,world=apartment.world,currentRoom=-1,activeRest=null,transitioning=false,transitionGeneration=0,disposed=false,message='';
 const local=new T.Vector3(),q=new T.Quaternion(),rootQ=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
 const bind=(el,event,fn,opts)=>{el.addEventListener(event,fn,opts);listeners.push(()=>el.removeEventListener(event,fn,opts));};
 function clear(){keys.clear();move={x:0,y:0};look={x:0,y:0};drag=null;last=null;hud.querySelectorAll('.apt-stick span').forEach(k=>k.style.transform='translate(-50%,-50%)');}
 function getPose(){return{x:position.x,z:position.z,y:eyeHeight,eyeHeight,yaw,pitch,id:activeRest?.id??null,mode:activeRest?.pose.mode??'standing',posed:!!activeRest};}
 function pitchLimits(){return activeRest?.pose.pitchLimits??[-1.25,1.25];}
 function drawPose(){
  local.set(position.x,eyeHeight,position.z);camera.position.copy(apartment.root.localToWorld(local));euler.set(pitch,yaw,0,'YXZ');apartment.root.getWorldQuaternion(rootQ);camera.quaternion.copy(rootQ).multiply(q.setFromEuler(euler));camera.updateMatrixWorld();
  const i=apartment.data.rooms.findIndex(r=>insideRing(position.x,position.z,r.p.map(p=>apartment.metrics.coord(...p))));
  if(i!==currentRoom){currentRoom=i;hud.querySelector('.apt-tour-help strong').textContent=i<0?'Переход':apartment.data.rooms[i].name;hud.querySelectorAll('[data-apt-room]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.aptRoom===i)));}
 }
 function cancelTransition(){transitionGeneration++;for(const timer of timers)clearTimeout(timer);timers.clear();transitioning=false;fade.style.opacity='0';}
 function transition(apply,duration=.18){
  cancelTransition();clear();const reduce=reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(reduce||!duration){apply();syncInteractionUI();return;}
  const generation=transitionGeneration;transitioning=true;fade.style.transition=`opacity ${duration*500}ms ease`;fade.style.opacity='1';
  const later=(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);if(disposed||generation!==transitionGeneration)return;fn();},ms);timers.add(timer);};
  later(()=>{apply();fade.style.opacity='0';syncInteractionUI();},duration*500);later(()=>{transitioning=false;last=null;syncInteractionUI();},duration*1000);
 }
 function applyStanding(p){position={x:p.x,z:p.z};yaw=p.yaw;pitch=p.pitch;eyeHeight=Number.isFinite(p.eyeHeight)?p.eyeHeight:Number.isFinite(p.y)?p.y:1.68;activeRest=null;clear();if(enabled)drawPose();}
 function stand({animate=true}={}){
  if(!activeRest&&!actions?.savedStanding){cancelTransition();return false;}
  cancelTransition();const standing=actions?.restorePose();activeRest=null;message='Вы снова стоите';
  if(standing){if(animate)transition(()=>applyStanding(standing),.18);else applyStanding(standing);}else{eyeHeight=1.68;clear();if(enabled)drawPose();}
  syncInteractionUI();return true;
 }
 function clearRest(){stand({animate:false});actions?.clearPose();activeRest=null;eyeHeight=1.68;}
 function teleport(i=-1){
  if(disposed)return;cancelTransition();clearRest();world=apartment.world;const next=i<0?world.start:world.roomPoint(i);if(!next)return;
  position={x:next.x,z:next.z};const target=apartment.metrics.coord(...(i<0?apartment.data.look:apartment.data.roomLooks[i]));yaw=Math.atan2(-(target[0]-position.x),-(target[1]-position.z));pitch=-.035;eyeHeight=1.68;message='';clear();if(enabled)drawPose();syncInteractionUI();
 }
 function setExpanded(on){expanded=on;document.querySelector('#sheet')?.classList.toggle('apartment-immersive',on&&enabled);hud.querySelector('.apt-expand').textContent=expanded?'↙':'⛶';}
 function enter(i=-1){
  if(disposed)return;if(enabled){teleport(i);return;}
  saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov,controlsEnabled:controls.enabled};enabled=true;controls.enabled=false;camera.fov=72;camera.updateProjectionMatrix();apartment.setWalking(true);host.classList.add('apartment-walking');hud.hidden=false;onChange(true);setExpanded(true);teleport(i);hud.querySelector('.apt-exit').focus({preventScroll:true});
 }
 function exit(){
  if(!enabled)return;clearRest();cancelTransition();enabled=false;clear();setExpanded(false);controls.enabled=saved.controlsEnabled;camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.fov=saved.fov;camera.updateProjectionMatrix();controls.target.copy(saved.target);controls.update();apartment.setWalking(false);host.classList.remove('apartment-walking');hud.hidden=true;onChange(false);
 }
 function interactionAvailable(item){return !!item&&item.enabled!==false&&(item.action==='apartment-lights'||apartment.withFurniture);}
 function selected(){return actions?.poi?.find(item=>item.id===picker.value);}
 function actionLabel(item){
  if(item?.action==='apartment-lights')return actions.states.lights.on?'Выключить свет':'Включить свет';
  if(item?.action==='apartment-tv')return actions.states.televisions[item.fixtureIndex]?.on?'Выключить телевизор':'Включить телевизор';
  return item?.actionLabel??'Взаимодействовать';
 }
 function syncInteractionUI(){
  const item=selected();actionButton.textContent=actionLabel(item);actionButton.disabled=!interactionAvailable(item)||transitioning;
  for(const option of picker.options){const target=actions?.poi?.find(p=>p.id===option.value);option.disabled=!interactionAvailable(target);}
  standButton.hidden=!activeRest&&!actions?.savedStanding;standButton.disabled=false;lightButton.disabled=!actions;lightButton.textContent=actions?.states.lights.on?'Выключить свет':'Включить свет';lightButton.setAttribute('aria-pressed',String(!!actions?.states.lights.on));
  const moveStick=hud.querySelector('.apt-move');moveStick.setAttribute('aria-disabled',String(!!activeRest));moveStick.style.opacity=activeRest?'.42':'';
  if(activeRest)status.textContent=`${activeRest.pose.mode==='lying'?'Лежите':'Сидите'} · ${activeRest.item.title.toLowerCase()} · «Встать» или Esc`;
  else if(message)status.textContent=message;else{const nearby=nearestInteraction();status.textContent=nearby?`E — ${actionLabel(nearby).toLowerCase()}`:'Выберите предмет для отдыха или подойдите к нему';}
 }
 function setLights(value){if(!actions||disposed)return false;const on=typeof value==='boolean'?value:!actions.states.lights.on;if(!actions.setAction('apt-lights',on))return false;onLighting(on);message=on?'Свет включён':'Свет выключен';syncInteractionUI();return true;}
 function approachPose(item){
  const point=item.approach;if(!point||point.reachable!==true||!world.free(point.x,point.z))return null;
  const target=item.lookAt??[item.x,1,item.z];return{x:point.x,z:point.z,eyeHeight:1.68,yaw:Math.atan2(-(target[0]-point.x),-(target[2]-point.z)),pitch:T.MathUtils.clamp(Math.atan2((target[1]??1)-1.68,Math.hypot(target[0]-point.x,target[2]-point.z)),-1.25,1.25)};
 }
 function activate(id=picker.value,{nearby=false}={}){
  if(disposed||!enabled||transitioning)return false;const item=actions?.poi?.find(p=>p.id===id);if(!interactionAvailable(item))return false;
  picker.value=id;clear();
  if(item.action==='apartment-lights')return setLights();
  if(item.action==='apartment-tv'){
   const apply=()=>{actions.setAction(id);message=actionLabel(item)==='Выключить телевизор'?'Телевизор включён':'Телевизор выключен';syncInteractionUI();};
   if(activeRest||nearby){apply();return true;}
   world=apartment.world;const at=approachPose(item);if(!at){message='Подойдите к телевизору по проходу';syncInteractionUI();return false;}
   transition(()=>{applyStanding(at);apply();},.18);return true;
  }
  if(item.action!=='apartment-pose')return false;world=apartment.world;
  // The approach was proven reachable by the physical walk graph. It is a
  // contextual jump, never interpolation through walls or furniture. Keep the
  // exact original standing pose so “Stand” returns to the same camera state.
  const at=approachPose(item);if(!at){message='Подойдите к предмету по проходу';syncInteractionUI();return false;}
  const standing=activeRest?actions.savedStanding:getPose(),rest=actions.selectPose(id,standing);if(!rest)return false;
  activeRest={id,item,pose:rest};message='';syncInteractionUI();transition(()=>{position={x:rest.position[0],z:rest.position[2]};eyeHeight=rest.eyeHeight??rest.position[1];yaw=rest.yaw;pitch=rest.pitch;clear();drawPose();},rest.transitionDuration??.18);return true;
 }
 function nearestInteraction(){
  if(!actions||!apartment.withFurniture)return null;return actions.poi.filter(item=>item.action!=='apartment-lights'&&interactionAvailable(item)).map(item=>({item,d:Math.hypot((actions.fixtureData?.find(f=>f.index===item.fixtureIndex)?.x??item.x)-position.x,(actions.fixtureData?.find(f=>f.index===item.fixtureIndex)?.z??item.z)-position.z)})).filter(v=>v.d<=2.2&&(!actions.canInteract||actions.canInteract(v.item.id,{...position,eyeHeight},2.2))).sort((a,b)=>a.d-b.d)[0]?.item??null;
 }
 if(actions?.poi?.length){
  for(const item of actions.poi){const option=document.createElement('option');option.value=item.id;option.textContent=[item.title,item.description].filter(Boolean).join(' · ');picker.append(option);}
 }else{hud.querySelector('.apt-interaction-picker').hidden=true;lightButton.hidden=true;status.hidden=true;}
 bind(window,'keydown',e=>{
  if(!enabled||editable(e.target))return;
  if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(activeRest||actions?.savedStanding)stand();else exit();return;}
  if(e.code==='KeyE'&&!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey){const item=nearestInteraction();if(item){e.preventDefault();activate(item.id,{nearby:true});}return;}
  if(MOVEMENT_CODES.has(e.code)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(!activeRest&&!transitioning)keys.add(e.code);}
 },true);
 bind(window,'keyup',e=>keys.delete(e.code));bind(window,'blur',clear);bind(document,'visibilitychange',clear);bind(document,'focusin',()=>{if(enabled)clear();});
 const dialog=document.querySelector('#sheet');if(dialog)bind(dialog,'cancel',e=>{if(enabled){e.preventDefault();if(activeRest||actions?.savedStanding)stand();else exit();}});
 bind(canvas,'pointerdown',e=>{if(!enabled||transitioning)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});
 bind(canvas,'pointermove',e=>{if(!enabled||transitioning||drag?.id!==e.pointerId)return;yaw-=(e.clientX-drag.x)*.0033;pitch=T.MathUtils.clamp(pitch-(e.clientY-drag.y)*.0033,...pitchLimits());drag.x=e.clientX;drag.y=e.clientY;drawPose();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])bind(canvas,name,e=>{if(drag?.id===e.pointerId)drag=null;});
 for(const [selector,type] of [['.apt-move','move'],['.apt-look','look']]){
  const stick=hud.querySelector(selector),knob=stick.querySelector('span');let pointer=null;
  function track(e){if(pointer!==e.pointerId||transitioning||(type==='move'&&activeRest))return;const r=stick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width*.33),y=(e.clientY-r.top-r.height/2)/(r.width*.33),n=Math.max(1,Math.hypot(x,y)),v={x:x/n,y:y/n};if(type==='move')move=v;else look=v;knob.style.transform=`translate(calc(-50% + ${v.x*r.width*.28}px),calc(-50% + ${v.y*r.height*.28}px))`;e.preventDefault();}
  bind(stick,'pointerdown',e=>{if(transitioning||(type==='move'&&activeRest))return;pointer=e.pointerId;stick.setPointerCapture?.(e.pointerId);track(e);});bind(stick,'pointermove',track);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])bind(stick,event,e=>{if(pointer!==e.pointerId)return;pointer=null;if(type==='move')move={x:0,y:0};else look={x:0,y:0};knob.style.transform='translate(-50%,-50%)';});
 }
 bind(hud.querySelector('.apt-exit'),'click',exit);bind(hud.querySelector('.apt-expand'),'click',()=>setExpanded(!expanded));hud.querySelectorAll('[data-apt-room]').forEach(b=>bind(b,'click',()=>teleport(+b.dataset.aptRoom)));
 bind(hud.querySelector('.apt-furniture'),'click',()=>{if(apartment.withFurniture)stand({animate:false});onFurniture();});bind(picker,'change',()=>{message='';clear();syncInteractionUI();});bind(actionButton,'click',()=>activate());bind(standButton,'click',()=>stand());bind(lightButton,'click',()=>setLights());
 function refreshWorld(){
  if(disposed)return;if(!apartment.withFurniture)stand({animate:false});world=apartment.world;
  if(!activeRest){const next=world.nearest([position.x,position.z],3);if(next)position={x:next.x,z:next.z};}
  hud.querySelector('.apt-furniture').textContent=apartment.withFurniture?'Без мебели':'С мебелью';clear();if(enabled)drawPose();syncInteractionUI();
 }
 function update(t){
  if(!enabled||disposed||!Number.isFinite(t))return;const dt=last===null?0:Math.max(0,Math.min(.08,t-last));last=t;
  if(transitioning){syncInteractionUI();return;}
  yaw-=look.x*1.7*dt;pitch=T.MathUtils.clamp(pitch-look.y*1.2*dt,...pitchLimits());
  if(!activeRest){
   let right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+move.x,forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))-move.y;const n=Math.max(1,Math.hypot(right,forward));right/=n;forward/=n;
   position=world.move(position,(Math.cos(yaw)*right-Math.sin(yaw)*forward)*1.25*dt,(-Math.sin(yaw)*right-Math.cos(yaw)*forward)*1.25*dt);
  }
  drawPose();syncInteractionUI();
 }
 syncInteractionUI();
 return{hud,enter,exit,teleport,update,refreshWorld,activate,stand,setLights,getPose,
  get enabled(){return enabled},get position(){return{...position}},get pose(){return getPose()},get poseState(){return getPose()},get standingPose(){return copyPose(actions?.savedStanding)},get resting(){return!!activeRest},get transitioning(){return transitioning},
  dispose(){if(disposed)return;exit();cancelTransition();clear();listeners.forEach(f=>f());listeners.length=0;hud.remove();disposed=true;}};
}
