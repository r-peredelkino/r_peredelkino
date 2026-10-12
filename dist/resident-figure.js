// Articulated original neighbourhood figures · group of concept creators @r_peredelkino.
import * as T from './vendor/three.module.js';

// One factory owns a small shared geometry/palette pool. The caller may batch
// all figures with per-instance colours; no material is allocated per person.
export function residentFactory(){
 const sphere=new T.SphereGeometry(1,14,9),capsule=new T.CapsuleGeometry(1,1,4,10),box=new T.BoxGeometry(1,1,1);
 const torso=new T.LatheGeometry([[.14,0],[.157,.09],[.164,.24],[.19,.40],[.185,.45],[.12,.49],[.057,.52]].map(p=>new T.Vector2(...p)),18);
 const hairCap=new T.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI*.62);
 const mat=(c,surface='fabric')=>{const m=new T.MeshStandardMaterial({color:c,roughness:surface==='skin'?.72:.88});m.userData.actorSurface=surface;return m;};
 const skin=[0xcaa088,0x9f755e,0xe0bea4,0xb6896d].map(c=>mat(c,'skin'));
 const coats=[0x647c7b,0xc8b8a1,0x8e7686,0x788263,0x444f61,0xac8b66].map(c=>mat(c));
 const sport=[0x80aaa7,0xc6a581,0x867da2,0x4e6571].map(c=>mat(c));
 const trousers=[0x3c4750,0x62675b,0x5b5149,0x586d72].map(c=>mat(c));
 const hair=[0x372e29,0x695444,0x877053].map(c=>mat(c));
 const sole=mat(0xd3d4c8),shoe=mat(0x333e40),detail=mat(0x333331),bag=mat(0x81745f),reflector=mat(0xb6d9d1);
 return function make(i,options={}){
  const role=options.role??'walker',active=role==='runner'||role==='cyclist'||role==='courier';
  const g=new T.Group();g.name=`Neighbour · ${role} ${i}`;
  const add=(geometry,material,pos,scale,parent=g)=>{const o=new T.Mesh(geometry,material);o.position.set(...pos);o.scale.set(...scale);o.castShadow=o.receiveShadow=true;o.userData.actorPalette=true;parent.add(o);return o;};
  const body=(active?sport:coats)[i%(active?sport.length:coats.length)],face=skin[i%skin.length],pants=trousers[i%trousers.length];
  add(sphere,pants,[0,.91,0],[.151,.105,.106]);
  const upper=new T.Group();upper.position.y=.94;g.add(upper);
  add(torso,body,[0,0,0],[1,1,.70],upper);
  add(capsule,face,[0,.54,0],[.043,.032,.041],upper);
  const head=new T.Group();head.position.y=.67;upper.add(head);
  add(sphere,face,[0,0,0],[.098,.126,.091],head);
  add(hairCap,hair[i%hair.length],[0,.021,-.008],[.102,.117,.097],head);
  add(sphere,face,[0,-.01,.086],[.015,.023,.026],head);
  for(const side of [-1,1]){add(sphere,detail,[side*.036,.022,.084],[.004,.003,.003],head);add(sphere,face,[side*.097,-.005,-.001],[.011,.023,.012],head);}
  function limb(x,y,upperLength,lowerLength,r,material,arm){
   const parent=arm?upper:g,pivot=new T.Group();pivot.position.set(x,arm?y-.94:y,0);parent.add(pivot);
   add(capsule,material,[0,-upperLength/2,0],[r,(upperLength+.022)/3,r*.93],pivot);
   const bend=new T.Group();bend.position.y=-upperLength;pivot.add(bend);
   add(sphere,material,[0,0,0],[r*.86,r*.8,r*.8],bend);
   add(capsule,material,[0,-lowerLength/2,0],[r*.84,(lowerLength+.022)/3,r*.8],bend);
   let foot=null;
   if(arm)add(sphere,face,[0,-lowerLength-.025,0],[.031,.048,.027],bend);
   else {foot=new T.Group();foot.position.y=-lowerLength;bend.add(foot);add(sphere,active?sole:shoe,[0,-.008,.055],[.060,.060,.128],foot);add(box,sole,[0,-.057,.048],[.111,.014,.222],foot);}
   return{pivot,bend,foot,upperLength,lowerLength};
  }
  const leftLeg=limb(-.082,.90,.43,.40,.059,pants,false),rightLeg=limb(.082,.90,.43,.40,.059,pants,false);
  const leftArm=limb(-.204,1.38,.265,.25,.043,body,true),rightArm=limb(.204,1.38,.265,.25,.043,body,true);
  add(box,body,[0,.20,.121],[.008,.31,.006],upper);
  if(role==='courier'){
   add(box,body,[0,.24,-.235],[.31,.41,.25],upper);add(box,reflector,[0,.20,-.367],[.245,.018,.008],upper);
   for(const side of [-1,1])add(box,detail,[side*.12,.29,.116],[.025,.33,.009],upper);
  }else if(!active&&i%5===0){add(sphere,bag,[0,.25,-.150],[.128,.175,.055],upper);for(const side of[-1,1])add(box,bag,[side*.10,.30,.110],[.021,.26,.009],upper);}
  if(role==='cyclist'||role==='courier'){
   add(hairCap,body,[0,.045,-.004],[.112,.128,.108],head);
   for(const x of[-.047,0,.047])add(box,reflector,[x,.148,.004],[.016,.012,.115],head);
   for(const side of[-1,1]){const strap=add(box,detail,[side*.080,-.072,-.004],[.008,.13,.008],head);strap.rotation.z=side*.25;}
  }else if(active&&i%2===0){for(const side of[-1,1])add(sphere,detail,[side*.107,.005,-.012],[.016,.028,.025],head);}
  else if(i%7===0)add(sphere,hair[i%hair.length],[0,-.056,-.083],[.073,.102,.044],head);
  const scale=options.scale??(.97+(i%5)*.016);g.scale.setScalar(scale);
  g.userData={type:'illustrative-resident',role,nominalHeight:1.75*scale,actorRoot:true};
  return{g,upper,head,ll:leftLeg.pivot,rl:rightLeg.pivot,la:leftArm.pivot,ra:rightArm.pivot,knees:[leftLeg.bend,rightLeg.bend],elbows:[leftArm.bend,rightArm.bend],legs:[leftLeg,rightLeg]};
 };
}
