// Original animated neighbours and quiet delivery vehicles · @r_peredelkino.
import * as T from './vendor/three.module.js';
import {residentFactory} from './resident-figure.js?v=community38';

const UP=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),delta=new T.Vector3();
export const populationRoles=Object.freeze({walker:20,runner:6,dogwalker:6,cyclist:6,courier:4,robot:4,seated:6});
export const actorClearance=Object.freeze({walker:.48,runner:.48,dogwalker:.75,cyclist:.95,courier:.95,robot:.75,seated:0});
export function createLifeActorFactory(){
 const person=residentFactory(),sphere=new T.SphereGeometry(1,12,8),box=new T.BoxGeometry(1,1,1),rod=new T.CylinderGeometry(1,1,1,8);
 const tire=new T.TorusGeometry(1,.105,5,20),rim=new T.TorusGeometry(1,.025,4,18),capsule=new T.CapsuleGeometry(1,1,4,8);
 const material=(c,surface='fabric')=>{const m=new T.MeshStandardMaterial({color:c,roughness:surface==='metal'?.38:.82,metalness:surface==='metal'?.42:0});m.userData.actorSurface=surface;return m;};
 const metal=material(0x677c81,'metal'),rubber=material(0x283133),ivory=material(0xd4d8ce),teal=material(0x689795,'metal'),copper=material(0xb29578,'metal'),glass=material(0x294b55,'metal'),reflector=material(0xc6e0d2),dogColors=[0x997d61,0x514e45,0xc1b092].map(c=>material(c));
 function add(parent,geo,mat,pos,scale){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.castShadow=m.receiveShadow=true;m.userData.actorPalette=true;parent.add(m);return m;}
 function tube(parent,from,to,r,mat){const m=add(parent,rod,mat,[0,0,0],[r,1,r]);align(m,from,to);return m;}
 function wheel(parent,x,y,z,r=.31){const g=new T.Group();g.position.set(x,y,z);parent.add(g);const t=add(g,tire,rubber,[0,0,0],[r,r,r]);t.rotation.y=Math.PI/2;const q=add(g,rim,metal,[0,0,0],[r*.88,r*.88,r*.88]);q.rotation.y=Math.PI/2;
  const hub=add(g,rod,metal,[0,0,0],[.032,.10,.032]);hub.rotation.z=Math.PI/2;
  for(let i=0;i<4;i++){const angle=i*Math.PI/4;tube(g,[0,Math.cos(angle)*r*.86,Math.sin(angle)*r*.86],[0,-Math.cos(angle)*r*.86,-Math.sin(angle)*r*.86],.005,metal);}
  return g;
 }
 function bicycle(parent,index){
  const frame=index%2?teal:copper,wheels=[wheel(parent,0,.34,-.57),wheel(parent,0,.34,.57)];
  const rear=[0,.34,-.57],crank=[0,.43,.04],head=[0,.87,.42],saddle=[0,.95,-.17];
  for(const [p,q]of [[rear,crank],[crank,saddle],[saddle,rear],[saddle,head],[head,crank],[head,[0,.34,.57]]])tube(parent,p,q,.022,frame);
  for(const x of[-.05,.05])tube(parent,[x,.83,.44],[x,.34,.57],.018,metal);
  tube(parent,saddle,[0,1.01,-.18],.022,metal);add(parent,box,rubber,[0,1.03,-.18],[.22,.065,.27]);
  tube(parent,head,[0,1.05,.42],.023,metal);tube(parent,[-.26,1.06,.43],[.26,1.06,.43],.016,metal);
  for(const x of[-.26,.26])tube(parent,[x,1.06,.43],[x,1.04,.54],.022,rubber);
  const pedals=new T.Group();pedals.position.set(0,.43,.04);parent.add(pedals);const pedalPlatforms=[];
  for(const [side,sign]of [[-.13,1],[.13,-1]]){tube(pedals,[side,0,0],[side,sign*.17,0],.013,metal);const platform=new T.Group();platform.position.set(side,sign*.17,0);pedals.add(platform);add(platform,box,rubber,[0,0,0],[.14,.035,.11]);pedalPlatforms.push(platform);}
  add(parent,sphere,reflector,[0,.91,.58],[.04,.033,.03]);add(parent,box,reflector,[0,.62,-.59],[.045,.035,.018]);
  return{wheels,pedals,pedalPlatforms};
 }
 function dog(parent,index){
  const g=new T.Group();g.name='Companion dog';parent.add(g);const coat=dogColors[index%dogColors.length];
  add(g,sphere,coat,[0,.43,0],[.17,.21,.35]);add(g,sphere,coat,[0,.46,.23],[.16,.19,.18]);
  const head=new T.Group();head.position.set(0,.64,.36);g.add(head);add(head,sphere,coat,[0,0,0],[.12,.13,.15]);add(head,sphere,coat,[0,-.044,.12],[.075,.06,.13]);add(head,sphere,rubber,[0,-.039,.235],[.028,.028,.025]);
  for(const side of[-1,1]){add(head,sphere,rubber,[side*.073,.027,.108],[.009,.009,.009]);const ear=add(head,capsule,coat,[side*.102,-.04,-.02],[.033,.074,.022]);ear.rotation.z=side*.31;}
  const legs=[];for(const x of[-.105,.105])for(const z of[-.23,.22]){const leg=new T.Group();leg.position.set(x,.43,z);g.add(leg);add(leg,capsule,coat,[0,-.18,0],[.04,.125,.037]);add(leg,sphere,coat,[0,-.399,.025],[.043,.034,.067]);legs.push(leg);}
  const tail=new T.Group();tail.position.set(0,.53,-.29);tail.rotation.x=-.9;g.add(tail);add(tail,capsule,coat,[0,.15,0],[.027,.12,.026]);
  add(g,sphere,teal,[0,.61,.29],[.14,.036,.125]);
  const leash=add(parent,rod,metal,[0,0,0],[.009,1,.009]);leash.name='Companion leash';
  return{g,head,legs,tail,leash};
 }
 function robot(parent,index){
  add(parent,box,ivory,[0,.45,0],[.58,.40,.71]);add(parent,sphere,ivory,[0,.60,0],[.303,.114,.37]);add(parent,box,teal,[0,.62,0],[.44,.035,.55]);
  add(parent,box,glass,[0,.46,.362],[.34,.12,.024]);for(const x of[-.12,.12])add(parent,sphere,reflector,[x,.47,.38],[.032,.020,.012]);
  const wheels=[];for(const x of[-.325,.325])for(const z of[-.25,0,.25]){const g=new T.Group();g.position.set(x,.19,z);parent.add(g);const m=add(g,rod,rubber,[0,0,0],[.143,.092,.143]);m.rotation.z=Math.PI/2;const cap=add(g,rod,metal,[Math.sign(x)*.049,0,0],[.065,.006,.065]);cap.rotation.z=Math.PI/2;wheels.push(g);}
  tube(parent,[0,.61,-.19],[0,1.02,-.19],.011,metal);add(parent,box,index%2?copper:teal,[0,1.02,-.19],[.11,.08,.023]);
  const lidar=add(parent,rod,glass,[0,.72,.14],[.051,.045,.051]);return{wheels,lidar};
 }
 return function make(role,index){
  const g=new T.Group();g.name=`Neighbourhood actor · ${role} ${index}`;g.userData={actorRoot:true,role,actorId:`${role}-${index}`};
  const actor={g,role,index,radius:actorClearance[role],phase:index*1.618,person:null,route:null,distance:0,direction:1,motionTime:0,active:false,qualityVisible:true,blocked:false};
  if(role==='robot'){actor.robot=robot(g,index);actor.speed=.74+index*.035;}
  else {actor.person=person(index+({runner:21,dogwalker:31,cyclist:41,courier:51,seated:61}[role]??0),{role,scale:(role==='cyclist'||role==='courier'||role==='seated')?1:undefined});g.add(actor.person.g);actor.speed=role==='runner'?2.25+(index%3)*.18:role==='cyclist'?2.65:role==='courier'?2.95:role==='seated'?0:.88+(index%5)*.07;
   if(role==='cyclist'||role==='courier'){actor.bike=bicycle(g,index);actor.person.g.position.set(0,.18,-.16);actor.person.upper.rotation.x=.80;}
   if(role==='dogwalker')actor.dog=dog(g,index);
  }
  return actor;
 };
}
export function align(object,from,to){a.set(...from);b.set(...to);delta.subVectors(b,a);const length=delta.length();object.position.copy(a).add(b).multiplyScalar(.5);object.scale.y=length;object.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/Math.max(length,1e-9)));}
export function alignCoordinates(object,ax,ay,az,bx,by,bz){a.set(ax,ay,az);b.set(bx,by,bz);delta.subVectors(b,a);const length=delta.length();object.position.copy(a).add(b).multiplyScalar(.5);object.scale.y=length;object.quaternion.setFromUnitVectors(UP,delta.multiplyScalar(1/Math.max(length,1e-9)));}
function legIK(leg,down,forward){const l1=leg.upperLength,l2=leg.lowerLength,d=T.MathUtils.clamp(Math.hypot(down,forward),.05,l1+l2-.001);const angle=Math.atan2(forward,down),hip=Math.acos(T.MathUtils.clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));leg.pivot.rotation.x=-angle-hip;leg.bend.rotation.x=Math.PI-Math.acos(T.MathUtils.clamp((l1*l1+l2*l2-d*d)/(2*l1*l2),-1,1));}
export function poseLifeActor(actor,time,{reducedMotion=false,moving=true}={}){
 const motionTime=actor.motionTime??time,wave=reducedMotion?0:Math.sin(motionTime*(actor.role==='runner'?8.3:5.1)+actor.phase),p=actor.person;
 if(p){
  p.head.rotation.y=reducedMotion?0:Math.sin(time*.34+actor.phase)*.12;
  if(actor.role==='seated'){
   const thighAngle=actor.seatedThighAngle??Math.PI/2;p.upper.rotation.set(0,Math.sin(time*.4+actor.phase)*.035,0);p.ll.rotation.x=p.rl.rotation.x=-thighAngle;p.knees[0].rotation.x=p.knees[1].rotation.x=thighAngle;
   p.la.rotation.x=-.16;p.ra.rotation.x=-.15-(reducedMotion?0:Math.max(0,Math.sin(time*1.4+actor.phase))*.25);p.elbows[0].rotation.x=-.70;p.elbows[1].rotation.x=-.60-(reducedMotion?0:Math.sin(time*1.4+actor.phase)*.10);p.head.rotation.y+=(actor.index%2?-.20:.20);
  }else if(actor.bike){
   const phase=reducedMotion?0:motionTime*actor.speed/.31,cos=Math.cos(phase)*.17,sin=Math.sin(phase)*.17;
   // The actual horizontal sole rests on the actual counter-rotating pedal.
   // Pedal top .0175 + sole half-thickness .007 + ankle-to-sole .057.
   legIK(p.legs[0],1.08-(.43+cos+.0815),.04+sin+.16-.048);legIK(p.legs[1],1.08-(.43-cos+.0815),.04-sin+.16-.048);
   for(const leg of p.legs)leg.foot.rotation.x=-leg.pivot.rotation.x-leg.bend.rotation.x;
   p.la.rotation.x=p.ra.rotation.x=-1.57;p.la.rotation.z=-.10;p.ra.rotation.z=.10;p.elbows[0].rotation.x=p.elbows[1].rotation.x=-.08;p.head.rotation.x=-.70;
   actor.bike.pedals.rotation.x=phase;for(const platform of actor.bike.pedalPlatforms)platform.rotation.x=-phase;for(const wheel of actor.bike.wheels)wheel.rotation.x=phase;
  }else{
   const swing=moving?wave*(actor.role==='runner'?.56:.32):0;p.ll.rotation.x=swing;p.rl.rotation.x=-swing;p.la.rotation.x=-swing*.78;p.ra.rotation.x=swing*.78;
   p.knees[0].rotation.x=Math.max(0,-wave)*(actor.role==='runner'?.88:.42);p.knees[1].rotation.x=Math.max(0,wave)*(actor.role==='runner'?.88:.42);
   p.elbows[0].rotation.x=p.elbows[1].rotation.x=actor.role==='runner'?-1.18:-.18;p.upper.rotation.x=actor.role==='runner'?.08:0;
   p.g.position.y=reducedMotion?0:Math.abs(wave)*(actor.role==='runner'?.028:.008);
   if(actor.dog){p.la.rotation.x=-.32;p.elbows[0].rotation.x=-.55;actor.dog.legs.forEach((leg,i)=>leg.rotation.x=(reducedMotion?0:Math.sin(motionTime*7+actor.phase+(i===0||i===3?0:Math.PI)))*.40);actor.dog.tail.rotation.z=reducedMotion?0:Math.sin(time*5.1+actor.phase)*.24;actor.dog.head.rotation.y=reducedMotion?0:Math.sin(time*.6+actor.phase)*.1;}
  }
 }
 if(actor.robot){for(const wheel of actor.robot.wheels)wheel.rotation.x=reducedMotion?0:motionTime*actor.speed/.143;actor.robot.lidar.rotation.y=reducedMotion?0:time*.7;}
}
