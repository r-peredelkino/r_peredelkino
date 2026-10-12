// Small articulated scale figures. Their appearance and motion are illustrative.
import * as T from './vendor/three.module.js';

export function residentFactory(){
 const sphere=new T.SphereGeometry(1,20,14),capsule=new T.CapsuleGeometry(1,1,5,12),box=new T.BoxGeometry(1,1,1);
 const torso=new T.LatheGeometry([[.14,0],[.16,.08],[.166,.22],[.19,.39],[.19,.44],[.13,.49],[.065,.52]].map(p=>new T.Vector2(...p)),24);
 const hairCap=new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.62);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.92});
 const skin=[0xc6a18b,0xa78570,0xd7baa2].map(mat),coats=[0x66717a,0xaaa394,0x796964,0xb9b8ad,0x667260,0x404d59].map(mat);
 const trousers=[0x424850,0x66685e,0x514c49].map(mat),hair=[0x3f3730,0x625342,0x84735a].map(mat);
 const sole=mat(0x7e807a),shoe=mat(0x353934),detail=mat(0x534b42),bag=mat(0x746957);
 return function make(i){
  const g=new T.Group();g.name='Resident scale figure '+i;
  const add=(geometry,material,pos,scale,parent=g)=>{const o=new T.Mesh(geometry,material);o.position.set(...pos);o.scale.set(...scale);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const body=coats[i%coats.length],face=skin[i%skin.length],pants=trousers[i%trousers.length];
  add(sphere,pants,[0,.91,0],[.15,.105,.103]);
  add(torso,body,[0,.94,0],[1,1,.65]);
  add(capsule,face,[0,1.48,0],[.045,.032,.042]);
  const head=new T.Group();head.position.y=1.61;g.add(head);
  add(sphere,face,[0,0,0],[.097,.125,.090],head);
  add(hairCap,hair[i%hair.length],[0,.020,-.008],[.101,.115,.095],head);
  add(sphere,face,[0,-.010,.086],[.014,.023,.025],head);
  for(const side of[-1,1]){
   add(sphere,detail,[side*.035,.022,.084],[.004,.003,.003],head);
   add(sphere,face,[side*.096,-.005,-.001],[.010,.023,.012],head);
  }
  function limb(x,y,upper,lower,r,material,arm){
   const pivot=new T.Group();pivot.position.set(x,y,0);g.add(pivot);
   add(capsule,material,[0,-upper/2,0],[r,(upper+.022)/3,r*.91],pivot);
   const bend=new T.Group();bend.position.y=-upper;pivot.add(bend);
   add(sphere,material,[0,0,0],[r*.85,r*.78,r*.79],bend);
   add(capsule,material,[0,-lower/2,0],[r*.83,(lower+.022)/3,r*.79],bend);
   if(arm)add(sphere,face,[0,-lower-.028,0],[.031,.049,.025],bend);
   else{
    add(sphere,shoe,[0,-lower-.008,.055],[.060,.060,.127],bend);
    add(box,sole,[0,-lower-.058,.048],[.112,.016,.22],bend);
   }
   return{pivot,bend};
  }
  const leftLeg=limb(-.082,.90,.43,.40,.061,pants,false),rightLeg=limb(.082,.90,.43,.40,.061,pants,false);
  const leftArm=limb(-.204,1.38,.265,.25,.043,body,true),rightArm=limb(.204,1.38,.265,.25,.043,body,true);
  add(box,pants,[0,1.18,.113],[.007,.34,.005]);
  if(i%5===0){add(sphere,bag,[0,1.19,-.134],[.125,.17,.055]);for(const side of[-1,1])add(box,bag,[side*.10,1.24,.102],[.020,.26,.009]);}
  if(i%7===0)add(sphere,hair[i%hair.length],[0,1.55,-.079],[.087,.115,.043]);
  g.traverse(o=>{if(o.isMesh)o.userData.residentPalette=true;});
  g.scale.setScalar(.96+(i%5)*.018);
  g.userData={type:'illustrative-resident',headHeight:.25,nominalHeight:1.75};
  return{g,head,ll:leftLeg.pivot,rl:rightLeg.pivot,la:leftArm.pivot,ra:rightArm.pivot,knees:[leftLeg.bend,rightLeg.bend],elbows:[leftArm.bend,rightArm.bend]};
 };
}
