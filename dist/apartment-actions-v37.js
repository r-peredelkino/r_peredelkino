// @r_peredelkino · authored apartment fixtures, real light/TV state and safe resting views.
import * as T from './vendor/three.module.js';
import {createWalkWorld,insideRing} from './walk-physics.js?v=publication371';
import {embedPixelSignature} from './baked-authorship.js?v=publication371';
import {attribution} from './attribution.js?v=publication371';

const REST_TYPES=new Set(['bed','sofa','lsofa','chair','toilet']);
const TYPE_NAMES={bed:'Кровать',sofa:'Диван',lsofa:'Угловой диван',chair:'Стул',toilet:'Туалет'};
const ACTION_NAMES={bed:'Лечь на кровать',sofa:'Лечь на диван',lsofa:'Лечь на диван',chair:'Сесть на стул',toilet:'Сесть на унитаз'};
const clone=o=>o==null?o:structuredClone(o);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const turn=(x,z,a)=>[Math.cos(a)*x-Math.sin(a)*z,Math.sin(a)*x+Math.cos(a)*z];

// The walk graph uses the same collision solver as the tour. Edges are tested
// with move(), so a free target across a thin wall is never considered reachable.
function entryGraph(world,metrics){
 const step=.12,start=world.start,points=[];
 if(!start)return{points,step};
 const queue=[{x:start.x,z:start.z}],seen=new Set(['0,0']),minX=-metrics.width/2-step,maxX=metrics.width/2+step,minZ=-metrics.depth/2-step,maxZ=metrics.depth/2+step;
 for(let head=0;head<queue.length&&head<30000;head++){
  const p=queue[head];points.push(p);
  for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
   const x=p.x+dx,z=p.z+dz,key=Math.round((x-start.x)/step)+','+Math.round((z-start.z)/step);
   if(seen.has(key)||x<minX||x>maxX||z<minZ||z>maxZ)continue;
   if(!world.free(x,z)){seen.add(key);continue;}const q=world.move(p,dx,dz);
   // A free node may be blocked from one neighbor but reached from another.
   // Mark it visited only after an edge actually passes the collision solver.
   if(Math.hypot(q.x-x,q.z-z)<.00001){seen.add(key);queue.push({x,z});}
  }
 }
 return{points,step};
}

const FONT={
 '@':['01110','10001','10111','10101','10111','10000','01110'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 _:['00000','00000','00000','00000','00000','00000','11111'],
 '0':['01110','10001','10011','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 ':':['00000','00100','00100','00000','00100','00100','00000']
};
function tvTexture(index){
 const width=128,height=72,bytes=new Uint8Array(width*height*4),texture=new T.DataTexture(bytes,width,height,T.RGBAFormat);
 texture.name='@r_peredelkino · original apartment television '+index;
 texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
 texture.userData.attribution={...attribution};texture.userData.pixelProvenance={version:37,rgbBits:1,label:'apartment-tv-'+index,dynamic:true,externalFootage:false};
 function pixel(x,y,color){if(x<0||x>=width||y<0||y>=height)return;bytes.set([...color,255],((height-1-y)*width+x)*4);}
 function rect(x,y,w,h,color){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixel(xx,yy,color);}
 function text(str,x,y,color){for(const character of str.toUpperCase()){const glyph=FONT[character];if(glyph)for(let yy=0;yy<7;yy++)for(let xx=0;xx<5;xx++)if(glyph[yy][xx]==='1')pixel(x+xx,y+yy,color);x+=6;}}
 function draw(time=0){
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixel(x,y,[8+Math.round(y/12),15+Math.round(y/8),28+Math.round(x/16)]);
  // Original cyan/purple game illustration; there is no copied broadcast or stream.
  for(let x=8;x<121;x+=8)rect(x,23,1,34,[21,42,56]);for(let y=23;y<61;y+=7)rect(8,y,112,1,[21,42,56]);
  rect(5,4,118,14,[25,30,56]);text('@R_PEREDELKINO',13,7,[177,211,215]);
  const pulse=.5+.5*Math.sin(time*.65),orbX=64+Math.round(Math.sin(time*.37)*14),orbY=40+Math.round(Math.cos(time*.31)*3);
  for(let y=-12;y<=12;y++)for(let x=-20;x<=20;x++)if(Math.abs(x)*.55+Math.abs(y)<12)pixel(orbX+x,orbY+y,[Math.round(80+pulse*60),Math.round(150+40*(y+12)/24),226]);
  for(let i=0;i<3;i++){const h=6+Math.round((Math.sin(time*.8+i*1.7)*.5+.5)*12);rect(12+i*6,56-h,3,h,[156,107,213]);rect(107+i*5,56-h,3,h,[81,190,191]);}
  rect(7,63,114,2,[74,174,185]);text('1:2',54,53,[223,227,235]);
  embedPixelSignature(bytes,{label:'apartment-tv-'+index});texture.needsUpdate=true;
 }
 draw(0);return{texture,draw};
}

export function createApartmentActions({apartment,reducedMotion=false}={}){
 if(!apartment?.data||!apartment.metrics||!apartment.root)throw new Error('Apartment actions require the apartment model');
 const data=apartment.data,metrics=apartment.metrics,coord=metrics.coord,world=apartment.world;
 const roomRings=data.rooms.map(r=>r.p.map(p=>coord(...p))),boundary=data.outline.map(p=>coord(...p));
 const architecture=createWalkWorld({boundary,radius:.10,obstacles:[...data.walls,...data.windows].map(a=>({type:'segment',a:coord(a[0],a[1]),b:coord(a[2],a[3]),radius:.065}))});
 const graph=entryGraph(world,metrics),visualHooks=apartment.interactionVisuals??{},group=new T.Group();group.name='Apartment interactive room lighting';group.userData.attribution={...attribution};apartment.root.add(group);
 const poi=[],poses={},diagnostics=[],textures=new Set(),tvRecords=[],lights=[],states={lights:{on:false},televisions:{},pose:{id:null,mode:'standing'}};
 let disposed=false,last=null,animationTime=0,lastPaint=-1,savedStanding=null,motionReduced=!!reducedMotion;
 const fixtureData=data.furniture.map(([type,x,z,wp,dp,angle=0],index)=>{const [px,pz]=coord(x,z);return{index,type,x:px,z:pz,w:wp*metrics.scale,d:dp*metrics.scale,angle,room:roomRings.findIndex(r=>insideRing(px,pz,r))};});
 const roomName=i=>data.rooms[i]?.name||'Квартира';
 function reachable(point){
  for(const p of graph.points)if(Math.hypot(p.x-point.x,p.z-point.z)<=graph.step*1.45){const q=world.move(p,point.x-p.x,point.z-p.z);if(Math.hypot(q.x-point.x,q.z-point.z)<.00001)return true;}return false;
 }
 function approach(f){
  const ring=roomRings[f.room],inside=p=>!ring||insideRing(p.x,p.z,ring),front=turn(0,f.d/2+.34,f.angle),preferred={x:f.x+front[0],z:f.z+front[1]},candidates=[];
  function candidate(lx,lz){const [x,z]=turn(lx,lz,f.angle),p={x:f.x+x,z:f.z+z};if(world.free(p.x,p.z)&&inside(p))candidates.push(p);}
  // Front edge, both sides and foot are sampled. A bed against a wall uses its
  // open side; a chair uses its front or side rather than a point inside a table.
  for(const pad of [.25,.34,.48,.65])for(const t of [-.8,-.4,0,.4,.8]){candidate(f.w*t/2,f.d/2+pad);candidate(-f.w/2-pad,f.d*t/2);candidate(f.w/2+pad,f.d*t/2);candidate(f.w*t/2,-f.d/2-pad);}
  const order=p=>Math.hypot(p.x-preferred.x,p.z-preferred.z)+.12*Math.hypot(p.x-f.x,p.z-f.z);
  candidates.sort((a,b)=>order(a)-order(b));let best=candidates.find(reachable);
  if(!best){const possible=graph.points.filter(inside).sort((a,b)=>order(a)-order(b));best=possible.find(p=>Math.hypot(p.x-f.x,p.z-f.z)<Math.max(f.w,f.d)+1);}
  if(best)return{...best,reachable:true};
  // Keep a room-specific approach available for the existing room teleport.
  // Diagnostics explicitly record a disconnected room instead of inventing a path.
  best=candidates[0]??world.roomPoint?.(f.room);return best?{x:best.x,z:best.z,reachable:reachable(best)}:null;
 }
 function restPose(f){
  let localPosition,localTarget,mode='seated';
  if(f.type==='bed'){mode='lying';localPosition=[0,.86,-f.d*.27];localTarget=[0,1.17,f.d*.62];}
  else if(f.type==='sofa'){mode='lying';localPosition=[-f.w*.29,.87,f.d*.08];localTarget=[f.w*.43,1.14,f.d*.08];}
  else if(f.type==='lsofa'){mode='lying';localPosition=[-f.w*.28,.87,-f.d*.25];localTarget=[-f.w*.28,1.15,f.d*.40];}
  else if(f.type==='toilet'){localPosition=[0,1.25,f.d*.11];localTarget=[0,1.12,f.d*.11+1.5];}
  else{localPosition=[0,1.28,f.d*.02];localTarget=[0,1.14,f.d*.02+1.5];}
  const [dx,dz]=turn(localPosition[0],localPosition[2],f.angle),[tx,tz]=turn(localTarget[0],localTarget[2],f.angle),position=[f.x+dx,localPosition[1],f.z+dz];let lookAt=[f.x+tx,localTarget[1],f.z+tz];
  if(mode==='lying'){
   const screen=fixtureData.filter(v=>v.type==='tv'&&v.room===f.room&&Math.hypot(v.x-position[0],v.z-position[2])>.5&&(position[0]-v.x)*-Math.sin(v.angle)+(position[2]-v.z)*Math.cos(v.angle)>.05).sort((a,b)=>Math.hypot(a.x-position[0],a.z-position[2])-Math.hypot(b.x-position[0],b.z-position[2])).find(v=>{
    for(let t=.12;t<.88;t+=.12){const x=position[0]+(v.x-position[0])*t,z=position[2]+(v.z-position[2])*t;if(!architecture.free(x,z))return false;}return true;
   });if(screen)lookAt=[screen.x,1.23,screen.z];
  }
  const horizontal=Math.hypot(lookAt[0]-position[0],lookAt[2]-position[2]),yaw=wrap(Math.atan2(-(lookAt[0]-position[0]),-(lookAt[2]-position[2]))),pitch=T.MathUtils.clamp(Math.atan2(lookAt[1]-position[1],horizontal),-.8,.9);
  const inRoom=f.room>=0&&insideRing(position[0],position[2],roomRings[f.room]),safe=architecture.free(position[0],position[2])&&inRoom&&position[1]<data.ceilingHeight-.15;
  return{position,lookAt,yaw,pitch,mode,room:f.room,fixtureIndex:f.index,safe,eyeHeight:position[1],pitchLimits:mode==='lying'?[-.55,1.20]:[-.95,1.15],transitionMode:'fade',transitionDuration:motionReduced?0:.18};
 }
 const counts={};
 for(const f of fixtureData){
  if(!REST_TYPES.has(f.type))continue;const id='apt-'+f.type+'-'+f.index,at=approach(f),pose=restPose(f),ordinal=counts[f.type]=(counts[f.type]||0)+1;
  poses[id]=pose;const item={id,action:'apartment-pose',type:f.type,fixtureIndex:f.index,room:f.room,title:TYPE_NAMES[f.type]+(ordinal>1?' '+ordinal:''),actionLabel:ACTION_NAMES[f.type],description:roomName(f.room),x:at?.x??f.x,z:at?.z??f.z,lookAt:[f.x,f.type==='chair'?1:.55,f.z],approach:at,pose,enabled:!!at&&pose.safe};poi.push(item);
  if(!at?.reachable||!pose.safe)diagnostics.push({id,fixtureIndex:f.index,room:f.room,approach:at,poseSafe:pose.safe});
 }
 for(const ref of visualHooks.lights??[]){
  const room=Number.isInteger(ref.room)?ref.room:lights.length,light=new T.PointLight(0xffdfb0,0,Math.max(4,Math.sqrt(Number.parseFloat(String(data.rooms[room]?.area??'').replace(',','.'))||12)*1.8),2);
  light.name='Apartment switched room light '+room;light.castShadow=false;light.userData={attribution:{...attribution},room,interactive:true};
  if(ref.mesh){apartment.root.updateMatrixWorld(true);light.position.copy(apartment.root.worldToLocal(ref.mesh.getWorldPosition(new T.Vector3())));light.position.y=Math.min(data.ceilingHeight-.12,light.position.y-.07);}else{const [x,z]=coord(...data.roomSpawns[room]);light.position.set(x,data.ceilingHeight-.17,z);}
  group.add(light);lights.push(light);
 }
 // A minimal model used during source parsing may not yet expose luminaires.
 // The full apartment model exposes every actual ceiling fixture through hooks.
 if(!lights.length)for(let room=0;room<data.rooms.length;room++){const [x,z]=coord(...data.roomSpawns[room]),light=new T.PointLight(0xffdfb0,0,6,2);light.name='Apartment switched room light '+room;light.position.set(x,data.ceilingHeight-.17,z);light.userData={attribution:{...attribution},room,interactive:true};group.add(light);lights.push(light);}
 const lampApproach=world.start??world.roomPoint?.(Math.max(0,data.rooms.findIndex(r=>/Кухня|Гостиная/.test(r.name))));
 poi.unshift({id:'apt-lights',action:'apartment-lights',type:'lights',room:-1,title:'Освещение квартиры',actionLabel:'Включить свет',x:lampApproach?.x??0,z:lampApproach?.z??0,enabled:true});
 for(const ref of visualHooks.televisions??[]){
  const f=fixtureData.find(p=>p.index===ref.index);if(!f||f.type!=='tv'||!ref.mesh||!ref.material)continue;
  const id='apt-tv-'+f.index,own=tvTexture(f.index),material=ref.material,original={map:material.map,emissiveMap:material.emissiveMap,color:material.color?.clone(),emissive:material.emissive?.clone(),emissiveIntensity:material.emissiveIntensity,toneMapped:material.toneMapped};
  textures.add(own.texture);states.televisions[f.index]={on:false,time:0};tvRecords.push({...ref,id,texture:own.texture,draw:own.draw,original});
  material.map=own.texture;material.emissiveMap=own.texture;material.color?.setHex(0x10151d);material.emissive?.setHex(0x000000);material.emissiveIntensity=0;material.needsUpdate=true;
  const at=approach(f);poi.push({id,action:'apartment-tv',type:'tv',fixtureIndex:f.index,room:f.room,title:'Телевизор'+(tvRecords.length>1?' '+tvRecords.length:''),actionLabel:'Включить телевизор',description:roomName(f.room),x:at?.x??f.x,z:at?.z??f.z,lookAt:[f.x,1.23,f.z],approach:at,enabled:!!at});
  if(!at?.reachable)diagnostics.push({id,fixtureIndex:f.index,room:f.room,approach:at});
 }
 const visuals={lights,televisions:tvRecords};
 function setAction(id,value){
  if(disposed)return false;
  if(id==='lights'||id==='apt-lights'){
   const on=typeof value==='boolean'?value:!states.lights.on;states.lights.on=on;apartment.setArtificialLight?.(on);for(const light of lights)light.intensity=on?7.5:0;return true;
  }
  if(id==='tv'){
   const target=tvRecords.find(r=>r.index===value?.index)??tvRecords[0];return target?setAction(target.id,value?.on):false;
  }
  const record=tvRecords.find(r=>r.id===id);if(!record)return false;
  const state=states.televisions[record.index],on=typeof value==='boolean'?value:!state.on;state.on=on;record.material.color.setHex(on?0xffffff:0x10151d);record.material.emissive.setHex(on?0xffffff:0x000000);record.material.emissiveIntensity=on?.85:0;record.material.toneMapped=!on;record.material.needsUpdate=true;if(on){record.draw(state.time);lastPaint=animationTime;}return true;
 }
 function selectPose(id,standingPose){
  if(disposed||!apartment.withFurniture)return null;const item=poi.find(p=>p.id===id&&p.action==='apartment-pose');if(!item?.enabled)return null;
  if(!savedStanding){const p=clone(standingPose);if(!p||!Number.isFinite(p.x+p.z+p.yaw+p.pitch)||!world.free(p.x,p.z))return null;savedStanding=p;}
  states.pose.id=id;states.pose.mode=item.pose.mode;return{...clone(item.pose),transitionDuration:motionReduced?0:.18};
 }
 function restorePose(){if(disposed)return null;const p=clone(savedStanding);savedStanding=null;states.pose.id=null;states.pose.mode='standing';return p;}
 function clearPose(){savedStanding=null;states.pose.id=null;states.pose.mode='standing';}
 function canInteract(id,point,maxDistance=2.2){
  if(disposed||!apartment.withFurniture||!Number.isFinite(point?.x+point?.z))return false;
  const item=poi.find(p=>p.id===id),fixture=item&&fixtureData[item.fixtureIndex];if(!item?.enabled||!fixture)return false;
  const distance=Math.hypot(fixture.x-point.x,fixture.z-point.z);if(distance>maxDistance||!insideRing(point.x,point.z,boundary))return false;
  // Only the standing/lying viewer's line of sight is checked here. The final
  // 20 cm belong to the fixture itself, which can sit directly against a wall.
  for(let d=.06;d<distance-.20;d+=.06){const t=d/distance;if(!architecture.free(point.x+(fixture.x-point.x)*t,point.z+(fixture.z-point.z)*t))return false;}return true;
 }
 function update(elapsed,{paused=false,reducedMotion:reduce=motionReduced}={}){
  if(disposed||!Number.isFinite(elapsed))return;motionReduced=!!reduce;
  const dt=last===null?0:Math.max(0,Math.min(.10,elapsed-last));last=elapsed;
  if(paused||motionReduced||!apartment.withFurniture)return;
  animationTime+=dt;for(const state of Object.values(states.televisions))if(state.on)state.time+=dt;
  if(animationTime-lastPaint<1/12)return;lastPaint=animationTime;
  for(const record of tvRecords){const state=states.televisions[record.index];if(state.on)record.draw(state.time);}
 }
 function dispose(){
  if(disposed)return;setAction('apt-lights',false);disposed=true;clearPose();
  for(const record of tvRecords){states.televisions[record.index].on=false;const material=record.material;material.map=record.original.map;material.emissiveMap=record.original.emissiveMap;if(record.original.color)material.color.copy(record.original.color);if(record.original.emissive)material.emissive.copy(record.original.emissive);material.emissiveIntensity=record.original.emissiveIntensity;material.toneMapped=record.original.toneMapped;material.needsUpdate=true;}
  for(const texture of textures)texture.dispose();textures.clear();group.removeFromParent();group.clear();
 }
 return{poi,pois:poi,poses,states,visuals,setAction,selectPose,restorePose,clearPose,canInteract,update,dispose,diagnostics,group,fixtureData,
  get savedStanding(){return clone(savedStanding)},get disposed(){return disposed},
  metadata:{revision:37,authoredMedia:true,externalFootage:false,fixtureCount:poi.filter(p=>p.action==='apartment-pose').length,televisionCount:tvRecords.length,roomLights:lights.length,allApproachesReachable:diagnostics.every(d=>d.approach?.reachable),allRestPosesSafe:diagnostics.every(d=>d.poseSafe!==false),graphVertices:graph.points.length,metricFurnitureArrangementConfirmed:false}};
}
