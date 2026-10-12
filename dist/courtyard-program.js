// @r_peredelkino · equipment programme checked against the official presentation,
// pp. 32–35, and the supplied 09 October courtyard views.
import * as T from './vendor/three.module.js';
import {stampCanvasFrame} from './baked-authorship.js?v=community38';

const TAU=Math.PI*2;
export function createCinemaScreenTexture(){
 let texture;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
  if(ctx){const gradient=ctx.createLinearGradient(0,0,0,720);gradient.addColorStop(0,'#142b39');gradient.addColorStop(1,'#496a71');ctx.fillStyle=gradient;ctx.fillRect(0,0,1280,720);ctx.fillStyle='#7e96913b';ctx.beginPath();ctx.moveTo(0,580);ctx.bezierCurveTo(370,300,760,640,1280,350);ctx.lineTo(1280,720);ctx.lineTo(0,720);ctx.fill();ctx.fillStyle='#e5ede7';ctx.textAlign='center';ctx.font='500 49px Arial, sans-serif';ctx.fillText('ЛЕТНИЙ КИНОТЕАТР',640,340);ctx.fillStyle='#c5d6d1';ctx.font='28px Arial, sans-serif';ctx.fillText('РОДИНА · ПЕРЕДЕЛКИНО',640,410);stampCanvasFrame(ctx,1280,720);texture=new T.CanvasTexture(canvas);}
 }
 texture??=new T.DataTexture(new Uint8Array([28,54,65,255]),1,1,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;texture.name='Courtyard cinema standby card · @r_peredelkino';return texture;
}
function kit(group,m){
 const colliders=[],meshes=[];
 const add=(g,mat,name='Courtyard programme detail')=>{const o=new T.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;o.userData.noAutomaticCollider=true;group.add(o);meshes.push(o);return o;};
 const box=(w,h,d,x,y,z,mat=m.white,angle=0)=>{const o=add(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y+h/2,z);o.rotation.y=angle;return o;};
 const tube=(points,r,mat=m.white,closed=false)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal'),Math.max(16,points.length*4),r,6,closed),mat);
 const disk=(x,z,rx,rz,y,mat,depth=.015)=>{const s=new T.Shape();s.absellipse(0,0,rx,rz,0,TAU,false);const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:28});g.rotateX(-Math.PI/2);const o=add(g,mat);o.position.set(x,y,z);return o;};
 const cylinder=(x,z,r,h,y,mat=m.white)=>{const o=add(new T.CylinderGeometry(r,r,h,24),mat);o.position.set(x,y+h/2,z);return o;};
 const ring=(x,z,rx,rz,y,mat=m.white,r=.025)=>tube(Array.from({length:80},(_,i)=>{const a=i/80*TAU;return[x+rx*Math.cos(a),y,z+rz*Math.sin(a)];}),r,mat,true);
 const circleCollider=(x,z,r)=>colliders.push({type:'circle',x,z,radius:r});
 return{add,box,tube,disk,cylinder,ring,circleCollider,colliders,meshes};
}

export function addEventSeating(group,m,l){
 const k=kit(group,m),{box,tube,cylinder,colliders}=k;
 // The wooden platform remains completely level. A curved upholstered bench
 // faces the cinema screen, leaving both long sides and the hoop swings open.
 const sx=l.rx/6,sz=l.rz/9.1,benchRX=3.7*sx,benchRZ=4.8*sz;
 const center=[l.x-.45*sx,l.z],points=[];
 for(let i=0;i<=42;i++){const a=Math.PI*.57+i/42*Math.PI*.86;points.push([center[0]+Math.cos(a)*benchRX,center[1]+Math.sin(a)*benchRZ]);}
 function arcStrip(width,y,h,mat,name){
  const a=[],b=[];for(let i=0;i<points.length;i++){const angle=Math.PI*.57+i/42*Math.PI*.86;a.push([center[0]+Math.cos(angle)*(benchRX+width/2),center[1]+Math.sin(angle)*(benchRZ+width/2)]);b.push([center[0]+Math.cos(angle)*(benchRX-width/2),center[1]+Math.sin(angle)*(benchRZ-width/2)]);}
  const shape=new T.Shape([...a,...b.reverse()].map(([x,z])=>new T.Vector2(x,-z))),geo=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelSegments:2,bevelSize:.055,bevelThickness:.045,curveSegments:24});geo.rotateX(-Math.PI/2);geo.translate(0,y,0);return k.add(geo,mat,name);
 }
 arcStrip(.83,.16,.28,m.white,'Rounded outdoor cinema bench');
 const back=points.map(([x,z])=>[center[0]+(x-center[0])*1.09,.69,center[1]+(z-center[1])*1.07]);tube(back,.13,m.white);
 for(let i=1;i<points.length;i++)colliders.push({type:'segment',a:points[i-1],b:points[i],radius:.46});
 const seats=[[-.6,-2.9],[1.25,-2.25],[-.9,.05],[1.15,.7],[-.5,2.8],[1.2,3.5]];
 seats.forEach(([x,z],i)=>{cylinder(l.x+x*sx,l.z+z*sz,.43,.33,.06,i%3===1?m.fabric:m.white);k.circleCollider(l.x+x*sx,l.z+z*sz,.44);});
 for(const [x,z] of [[.65,-.75],[.2,2.0]]){cylinder(l.x+x*sx,l.z+z*sz,.40,.065,.48,m.wood);cylinder(l.x+x*sx,l.z+z*sz,.095,.43,.05,m.white);k.circleCollider(l.x+x*sx,l.z+z*sz,.4);}
 // The screen is a thin freestanding panel, not a closed pavilion volume.
 const screen={x:l.x+4.9*sx,z:l.z-.3*sz,width:3.55,height:2.05,bottom:.73};
 box(.14,screen.height+.15,screen.width+.18,screen.x,screen.bottom-.075,screen.z,m.darkBlue);
 for(const dz of [-1.42,1.42]){box(.09,.73,.09,screen.x,.03,screen.z+dz,m.metal);box(.64,.045,.40,screen.x,.045,screen.z+dz,m.metal);}
 colliders.push({type:'box',x:screen.x,z:screen.z,width:.24,depth:screen.width+.18});
 // Light strings visible in the official cinema photograph terminate on the
 // existing canopy posts. They do not introduce new ground obstacles.
 const bulbs=[];
 for(const zOff of [-l.rz*.46,0,l.rz*.46]){const span=Math.sqrt(Math.max(0,1-(zOff/l.rz)**2))*l.rx*.88,pts=[];for(let i=0;i<=20;i++){const t=i/20;pts.push([l.x-span+2*span*t,3.30-.31*Math.sin(t*Math.PI),l.z+zOff]);if(i>0&&i<20&&i%2===0)bulbs.push(pts.at(-1));}tube(pts,.008,m.metal);}
 const dummy=new T.Object3D(),lights=new T.InstancedMesh(new T.SphereGeometry(.043,7,5),m.warm,bulbs.length);lights.name='Cinema festoon bulbs';bulbs.forEach((p,i)=>{dummy.position.set(p[0],p[1]-.075,p[2]);dummy.updateMatrix();lights.setMatrixAt(i,dummy.matrix);});lights.instanceMatrix.needsUpdate=true;group.add(lights);
 return{...k,screen,bench:points,ottomans:seats.length,festoonBulbs:bulbs.length,programme:['cinema screen','curved bench','ottomans','timber deck','hoop swings']};
}

export function addPlayEquipment(group,m,play){
 const k=kit(group,m),{add,box,tube,disk,cylinder,ring,colliders}=k,x=play.x,z=play.z;
 m.playOrange??=new T.MeshStandardMaterial({color:0xc57d42,roughness:.76});
 m.trampoline??=new T.MeshStandardMaterial({color:0x374651,roughness:.97});
 const equipment=[];
 // A tiered blue mound and a genuinely concave toddler slide occupy the large
 // open loop; both stay outside the five radial arch entry corridors.
 const mound={x:x-4.0,z:z+.55,rx:2.18,rz:1.75,height:1.0};
 for(let i=0;i<4;i++){const scale=1-i*.16;disk(mound.x,mound.z,mound.rx*scale,mound.rz*scale,.06+i*.245,i%2?m.blue:m.darkBlue,.245);}
 k.circleCollider(mound.x,mound.z,1.68);equipment.push({type:'tiered mound',...mound});
 // Slide runs from the mound towards the south-west interior, leaving the
 // principal western arch, at (x−10,z), unobstructed at eye level.
 const start=[x-4.45,1.07,z+1.0],end=[x-6.8,.12,z+3.10],dx=end[0]-start[0],dz=end[2]-start[2],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length,positions=[],normals=[],uv=[];
 const slidePoint=(t,u)=>{const y=start[1]+(end[1]-start[1])*(t*t*(3-2*t))+.10*u*u;return[start[0]+dx*t+nx*u*.43,y,start[2]+dz*t+nz*u*.43];};
 for(let i=0;i<28;i++)for(let j=0;j<8;j++){const t=i/28,v=(i+1)/28,u=-1+j/4,w=u+.25,a=slidePoint(t,u),b=slidePoint(v,u),c=slidePoint(v,w),d=slidePoint(t,w);for(const p of [a,c,b,a,d,c]){positions.push(...p);uv.push(0,0);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();add(geo,m.white,'Concave white slide on the blue play mound');
 for(const side of [-1,1])tube(Array.from({length:30},(_,i)=>{const p=slidePoint(i/29,side);p[1]+=.055;return p;}),.04,m.white);
 colliders.push({type:'segment',a:[start[0],start[2]],b:[end[0],end[2]],radius:.46});equipment.push({type:'slide',start,end,width:.86});
 // A low sand tray in the smaller loop keeps the central sky opening and its
 // north-east and south-east gateways free of overhead equipment.
 const sandbox={x:x+4.5,z:z-.75,rx:1.95,rz:2.25};disk(sandbox.x,sandbox.z,sandbox.rx,sandbox.rz,.063,m.sand,.025);ring(sandbox.x,sandbox.z,sandbox.rx,sandbox.rz,.16,m.wood,.11);equipment.push({type:'sandbox',...sandbox});
 // Flush circular trampolines remain walkable; rings have physical thickness.
 const trampolines=[[x-2.0,z-6.65,.63],[x+.0,z-6.8,.70],[x+2.1,z-7.0,.63]];
 trampolines.forEach(([px,pz,r])=>{disk(px,pz,r,r,.057,m.trampoline,.012);ring(px,pz,r+.065,r+.065,.078,m.blue,.065);for(let i=0;i<20;i++){const a=i/20*TAU;tube([[px+Math.cos(a)*r,.075,pz+Math.sin(a)*r],[px+Math.cos(a)*(r+.08),.075,pz+Math.sin(a)*(r+.08)]],.006,m.metal);}});equipment.push({type:'trampolines',points:trampolines,flush:true});
 // Low sculpted stepping humps are grouped beside the trampoline area.
 for(const [i,[dx,dz,r]] of [[-.4,-8.3,.40],[1.0,-8.8,.53],[2.8,-8.6,.37]].entries()){const o=add(new T.SphereGeometry(r,18,10,0,TAU,0,Math.PI/2),i%2?m.blue:m.darkBlue,'Low blue play mound');o.position.set(x+dx,.057,z+dz);o.scale.y=.62;k.circleCollider(x+dx,z+dz,r*.9);}
 // The orange climbing frame is at the north-east exterior, clear of the
 // nearest doorway. Its open sides and overhead rungs are actual geometry.
 const climb={x:x+9.0,z:z-6.8,width:1.6,depth:1.1,height:1.72};
 for(const dx of [-.8,.8])for(const dz of [-.55,.55]){cylinder(climb.x+dx,climb.z+dz,.035,climb.height,.055,m.playOrange);k.circleCollider(climb.x+dx,climb.z+dz,.04);}
 for(let i=0;i<6;i++){const y=.3+i*.265;tube([[climb.x-.8,y,climb.z-.55],[climb.x+.8,y,climb.z-.55]],.027,m.playOrange);}for(let i=0;i<5;i++){const dx=-.8+i*.4;tube([[climb.x+dx,1.775,climb.z-.55],[climb.x+dx,1.775,climb.z+.55]],.028,m.playOrange);}equipment.push({type:'climbing frame',...climb});
 // Busy boards on independent posts and spring seats are low, accessible
 // details shown with the multi-level playground in the official programme.
 const board={x:x-8.7,z:z+6.35};box(1.20,.79,.11,board.x,.48,board.z,m.wood,.30);for(const dx of [-.48,.48]){box(.055,1.24,.055,board.x+dx,.055,board.z,m.white);k.circleCollider(board.x+dx,board.z,.05);}for(let i=0;i<4;i++){const r=.09+i%2*.025,gear=add(new T.TorusGeometry(r,.032,6,14),i%2?m.playOrange:m.darkBlue,'Rotating busy-board wheel');gear.position.set(board.x-.4+i*.26,.83+(i%2)*.19,board.z-.082);gear.rotation.y=.30;}colliders.push({type:'box',x:board.x,z:board.z,width:1.26,depth:.22,angle:.30});equipment.push({type:'busy board',...board});
 for(const [i,[dx,dz]] of [[8.2,6.4],[10.0,5.1]].entries()){const px=x+dx,pz=z+dz;const pts=Array.from({length:80},(_,j)=>{const t=j/79;return[px+Math.cos(t*TAU*4)*.065,.08+t*.29,pz+Math.sin(t*TAU*4)*.065]});tube(pts,.018,m.metal);const seat=add(new T.SphereGeometry(.36,18,10),i?m.playOrange:m.white,'Low spring play seat');seat.position.set(px,.45,pz);seat.scale.set(1.45,.24,1);tube([[px-.22,.6,pz],[px-.22,.81,pz],[px+.22,.81,pz],[px+.22,.6,pz]],.022,m.darkBlue);k.circleCollider(px,pz,.47);}
 // A child swing stands beside the southern perimeter, with its supports clear
 // of the broad arch route. The interior of the frame remains walkable.
 const swing={x:x+3.0,z:z+7.1,width:2.4,height:2.20};
 for(const dx of [-1.2,1.2]){for(const dz of [-.66,.66]){tube([[swing.x+dx,.05,swing.z+dz],[swing.x+dx,2.25,swing.z]],.045,m.white);k.circleCollider(swing.x+dx,swing.z+dz,.075);}}
 tube([[swing.x-1.2,2.25,swing.z],[swing.x+1.2,2.25,swing.z]],.052,m.white);for(const dx of [-.28,.28])tube([[swing.x+dx,2.20,swing.z],[swing.x+dx,.56,swing.z]],.011,m.metal);box(.70,.065,.34,swing.x,.49,swing.z,m.darkBlue);k.circleCollider(swing.x,swing.z,.4);equipment.push({type:'child swing',...swing});
 return{...k,equipment,sourcePages:[33],slide:{start,end,width:.86},trampolines};
}

export function addSportProgramme(group,m,sport,layout){
 const k=kit(group,m),{box,tube,cylinder,colliders}=k;
 m.sportOrange??=new T.MeshStandardMaterial({color:0xc77c45,roughness:.64});
 m.sportBlack??=new T.MeshStandardMaterial({color:0x333940,roughness:.75});
 const {center,rx,rz}=layout.panna,equipmentFootprints=[];
 // The panna end is opposite the two tables, as in both supplied aerial views.
 // Open goals and a separate 1.10 m side entrance remain physical voids.
 const opening=a=>Math.abs(Math.sin(a))*rz<.64||Math.abs(a-Math.PI/2)<.22;
 for(let i=0;i<96;i++){const a=i/96*TAU,b=(i+1)/96*TAU,mid=(a+b)/2;if(opening(mid))continue;const p=[center[0]+Math.cos(a)*rx,center[1]+Math.sin(a)*rz],q=[center[0]+Math.cos(b)*rx,center[1]+Math.sin(b)*rz];for(const y of [.18,.55,1.1])tube([[p[0],y,p[1]],[q[0],y,q[1]]],.022,m.metal);tube([[p[0],.06,p[1]],[p[0],1.1,p[1]]],.012,m.metal);colliders.push({type:'segment',a:p,b:q,radius:.03});}
 const goals=[];for(const side of [-1,1]){const gx=center[0]+side*rx,gz=center[1],back=gx+side*.54;for(const zz of [-.63,.63]){tube([[gx,.05,gz+zz],[gx,.80,gz+zz],[back,.80,gz+zz],[back,.05,gz+zz]],.025,m.white);colliders.push({type:'segment',a:[gx,gz+zz],b:[back,gz+zz],radius:.04});}tube([[gx,.80,gz-.63],[gx,.80,gz+.63]],.026,m.white);for(let row=1;row<6;row++)tube([[back,.05+row*.125,gz-.63],[back,.05+row*.125,gz+.63]],.008,m.metal);for(let i=0;i<=8;i++)tube([[back,.05,gz-.63+i*.1575],[back,.80,gz-.63+i*.1575]],.008,m.metal);colliders.push({type:'segment',a:[back,gz-.63],b:[back,gz+.63],radius:.025});goals.push({center:[gx,gz],width:1.26,height:.8});equipmentFootprints.push({type:'panna goal',points:[[gx,gz-.66],[back,gz-.66],[back,gz+.66],[gx,gz+.66]]});}
 equipmentFootprints.push({type:'panna court',points:Array.from({length:72},(_,i)=>[center[0]+Math.cos(i/72*TAU)*rx,center[1]+Math.sin(i/72*TAU)*rz])});
 tube([[center[0],.059,center[1]-rz+.13],[center[0],.059,center[1]+rz-.13]],.016,m.white);k.ring(...center,.48,.48,.059,m.white,.017);

 const tables=layout.tables.map(({center:[x,z],...size},index)=>{
  const table={x,z,...size,index};
  box(table.width,.045,table.depth,x,.7375,z,m.darkBlue);for(const dx of [-.97,.97])for(const dz of [-.5,.5])box(.055,.69,.055,x+dx,.0475,z+dz,m.metal);
  for(const dz of [-table.depth/2+.02,table.depth/2-.02])box(table.width,.005,.027,x,.784,z+dz,m.white);for(const dx of [-table.width/2+.02,table.width/2-.02])box(.027,.005,table.depth,x+dx,.784,z,m.white);box(table.width,.005,.015,x,.784,z,m.white);
  for(const dz of [-.85,.85])cylinder(x,z+dz,.013,.19,.76,m.white);for(let i=0;i<7;i++)tube([[x,.78+i*.023,z-.85],[x,.78+i*.023,z+.85]],.005,m.white);for(let i=0;i<24;i++)tube([[x,.78,z-.85+i*1.7/23],[x,.928,z-.85+i*1.7/23]],.004,m.white);
  colliders.push({type:'box',x,z,width:table.width,depth:table.depth});
  equipmentFootprints.push({type:'table tennis',points:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[x+a*table.width/2,z+b*.85])});
  table.approaches=[[-2.2,0],[2.2,0],[0,-1.2],[0,1.2]].map(([dx,dz])=>[x+dx,z+dz]);return table;
 });
 const wx=layout.workout.x,wz=layout.workout.z;
 const post=(x,z,height)=>{cylinder(x,z,.031,height,.055,m.white);k.circleCollider(x,z,.042);};
 for(const [i,dx] of [-1.6,.15,1.9].entries()){
  const height=2.25+i*.14;for(const dz of [-1.8,1.1]){post(wx+dx,wz+dz,height);cylinder(wx+dx,wz+dz,.062,.10,height-.06,m.sportOrange);}
  tube([[wx+dx,height+.055,wz-1.8],[wx+dx,height+.055,wz+1.1]],.028,m.white);
 }
 for(let i=0;i<7;i++)tube([[wx-1.6,2.305,wz-1.8+i*.48],[wx+.15,2.445,wz-1.8+i*.48]],.025,m.white);
 equipmentFootprints.push({type:'workout frame',points:[[wx-1.67,wz-1.87],[wx+1.97,wz-1.87],[wx+1.97,wz+1.17],[wx-1.67,wz+1.17]]});
 for(const [x,z] of layout.bags){post(x,z-1.15,2.53);tube([[x,2.585,z-1.15],[x,2.585,z]],.026,m.white);cylinder(x,z,.16,1.15,.88,m.darkBlue);k.circleCollider(x,z,.18);equipmentFootprints.push({type:'fitness bag',points:[[x-.18,z-1.22],[x+.18,z-1.22],[x+.18,z+.18],[x-.18,z+.18]]});}
 for(const [x,z] of layout.benches){box(2.25,.11,.58,x,.40,z,m.wood);for(const dx of [-.82,.82])box(.07,.38,.50,x+dx,.04,z,m.white);colliders.push({type:'box',x,z,width:2.28,depth:.6});equipmentFootprints.push({type:'bench',points:[[x-1.14,z-.3],[x+1.14,z-.3],[x+1.14,z+.3],[x-1.14,z+.3]]});}
 // Preserve the blue finish of the user's panorama. Its shallow continuous
 // roof is now over the seating edge, away from the round court and tables.
 const shade=layout.shade,outline=Array.from({length:96},(_,i)=>{const a=i/96*TAU;return[shade.center[0]+Math.cos(a)*shade.rx,shade.center[1]+Math.sin(a)*shade.rz*(1+.14*Math.cos(3*a))];});
 const shape=new T.Shape(outline.map(([x,z])=>new T.Vector2(x,-z))),geometry=new T.ExtrudeGeometry(shape,{depth:.04,bevelEnabled:false,curveSegments:24});geometry.rotateX(-Math.PI/2);geometry.translate(0,shade.height,0);k.add(geometry,m.cyan,'Continuous blue fitness seating shade');
 for(const dx of [-1.68,1.68])post(shade.center[0]+dx,shade.center[1],shade.height-.045);
 tube(outline.map(([x,z])=>[x,shade.height+.04,z]),.026,m.cyan,true);equipmentFootprints.push({type:'fitness shade',points:outline});
 return{...k,panna:{center,rx,rz,entry:[center[0],center[1]+rz],goals},tableTennis:tables[0],tableTennisTables:tables,
  runningTrack:layout.track,shade:{...shade,outer:outline},equipmentFootprints,
  sourcePages:[34],programme:['workout','two table-tennis tables','panna football','continuous dark perimeter']};
}

export function addReferenceGardenLounge(group,m,layout){
 const k=kit(group,m),{box,tube,cylinder,colliders}=k,[x,z]=layout.center;
 m.loungeGlass??=new T.MeshStandardMaterial({color:0xc0c9c4,transparent:true,opacity:.24,roughness:.22,metalness:.08,depthWrite:false,side:T.DoubleSide});
 const slab=(ring,bottom,height,material,name)=>{const shape=new T.Shape(ring.map(([px,pz])=>new T.Vector2(px,-pz))),geo=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:32});geo.rotateX(-Math.PI/2);geo.translate(0,bottom,0);return k.add(geo,material,name);};
 slab(layout.outer,.032,.035,m.wood,'Separate level timber deck of the open garden lounge');
 const roofOutline=new T.CatmullRomCurve3([[-2.65,-.6],[-1.9,-1.75],[.1,-1.9],[2.2,-1.5],[2.7,-.35],[1.9,.85],[.1,.64],[-1.75,.95]].map(([dx,dz])=>new T.Vector3(x+dx,0,z+dz)),true,'centripetal').getPoints(112).slice(0,-1).map(p=>[p.x,p.z]);
 slab(roofOutline,layout.roofHeight,layout.roofThickness,m.white,'Curved independent garden lounge canopy');
 tube(roofOutline.map(([px,pz])=>[px,layout.roofHeight-.015,pz]),.025,m.warm,true);
 const back=Array.from({length:65},(_,i)=>{const a=Math.PI*.98+i/64*Math.PI*1.04;return[x+Math.cos(a)*2.58,z+Math.sin(a)*1.66];});
 const positions=[],uv=[];for(let i=1;i<back.length;i++){const a=back[i-1],b=back[i],points=[[a[0],.59,a[1]],[b[0],.59,b[1]],[b[0],layout.roofHeight-.035,b[1]],[a[0],layout.roofHeight-.035,a[1]]];for(const j of [0,1,2,0,2,3]){positions.push(...points[j]);uv.push(0,0);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();k.add(geo,m.loungeGlass,'Open-front curved translucent lounge back');
 for(const height of [.60,layout.roofHeight-.025])tube(back.map(([px,pz])=>[px,height,pz]),.021,m.white);
 for(const i of [0,16,32,48,64]){const p=back[i];cylinder(...p,.026,layout.roofHeight-.067,.067,m.white);k.circleCollider(...p,.04);}
 // A curved bench follows only the back; its front is completely open.
 const seatOuter=back.map(([px,pz])=>[x+(px-x)*.93,z+(pz-z)*.88]),seatInner=back.map(([px,pz])=>[x+(px-x)*.70,z+(pz-z)*.49]);
 slab([...seatOuter,...seatInner.slice().reverse()],.067,.35,m.white,'Curved mineral base of the separate lounge bench');
 slab([...seatOuter,...seatInner.slice().reverse()],.417,.095,m.fabric,'Soft curved lounge bench cushion');
 for(let i=1;i<seatOuter.length;i++)colliders.push({type:'segment',a:[(seatOuter[i-1][0]+seatInner[i-1][0])/2,(seatOuter[i-1][1]+seatInner[i-1][1])/2],b:[(seatOuter[i][0]+seatInner[i][0])/2,(seatOuter[i][1]+seatInner[i][1])/2],radius:.36});
 for(let i=1;i<back.length;i++)colliders.push({type:'segment',a:back[i-1],b:back[i],radius:.025});
 const ottomans=[[-1.22,.64],[1.22,.64]].map(([dx,dz])=>[x+dx,z+dz]);
 for(const p of ottomans){cylinder(...p,.40,.37,.068,m.terracotta);k.circleCollider(...p,.41);}
 // Two short plinths and a fine fascia define the separate shelter without
 // adding the former wire ceiling or a fence across its approach.
 for(const i of [0,64]){const p=back[i];box(.12,.06,.35,p[0],.068,p[1],m.white);}
 return{...k,...layout,roofOutline,back,ottomans,bench:[...seatOuter,...seatInner.slice().reverse()],
  openFront:true,programme:['independent curved canopy','open front','curved bench','two warm-colour seats']};
}
