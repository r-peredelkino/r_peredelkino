// @r_peredelkino · apartments traced from their original plans, in model metres.
import * as T from './vendor/three.module.js';
import {apartmentPlans,apartmentMetrics} from './apartment-plans.js?v=publication371';
import {createWalkWorld,insideRing} from './walk-physics.js?v=publication371';
import {batchStatic} from './scene-batches.js?v=publication371';
import {bakeSceneAuthorship,embedPixelSignature} from './baked-authorship.js?v=publication371';
import {attribution,createAttributionTexture} from './attribution.js?v=publication371';
import {registerApartmentFacade,facadePaneGeometry} from './apartment-facade-v37.js?v=publication371';
import {createDistributedSurfaceMarks} from './voxel-authorship-v37.js?v=publication371';

export function createApartmentWorld(id,withFurniture=true){
 const data=apartmentPlans[id],m=apartmentMetrics(data),coord=m.coord;
 const obstacles=[...data.walls,...data.windows].map(a=>({type:'segment',a:coord(a[0],a[1]),b:coord(a[2],a[3]),radius:.065}));
 // The entrance has a threshold but remains a solid boundary; a tour never drops out of a high-rise.
 if(withFurniture)for(const [type,x,z,w,d,angle] of data.furniture){if(type==='plant')continue;const [px,pz]=coord(x,z);if(type==='roundTable'||type==='coffee')obstacles.push({type:'circle',x:px,z:pz,radius:Math.min(w,d)*m.scale*.46});else if(type==='lsofa'){
  obstacles.push({type:'box',x:px-w*m.scale*.29,z:pz,width:w*m.scale*.4,depth:d*m.scale*.96,angle:0},{type:'box',x:px,z:pz+d*m.scale*.3,width:w*m.scale*.95,depth:d*m.scale*.35,angle:0});
 }else obstacles.push({type:'box',x:px,z:pz,width:w*m.scale*.94,depth:d*m.scale*.94,angle:-angle});}
 const world=createWalkWorld({boundary:data.outline.map(p=>coord(...p)),obstacles,radius:.18});
 function roomPoint(i){const ring=data.rooms[i].p.map(p=>coord(...p)),desired=coord(...data.roomSpawns[i]);let best=null,dist=Infinity;
  for(let x=-m.width/2;x<=m.width/2;x+=.10)for(let z=-m.depth/2;z<=m.depth/2;z+=.10)if(insideRing(x,z,ring)&&world.free(x,z)){const d=Math.hypot(x-desired[0],z-desired[1]);if(d<dist){dist=d;best={x,z}}}return best;
 }
 return Object.assign(world,{roomPoint,start:world.nearest(coord(...data.spawn),2),metrics:m,data});
}

function surface(kind){const n=128,bytes=new Uint8Array(n*n*4);let seed=541;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;let v=225+(seed%16);
  if(kind==='wood')v=212+Math.sin(x*.41+Math.sin(y*.026)*2)*13+Math.sin(x*.91+y*.012)*6+(seed%7);
  if(kind==='parquet'){const plank=Math.floor(x/32)+Math.floor(y/64)*3;v=221+Math.sin(x*.57+plank*.7)*8+(seed%8)-((x%32<1||y%64<1)?24:0)}
  if(kind==='tile')v=(x%32<1||y%32<1)?173:232+(seed%8);
  if(kind==='fabric')v=216+(x%2?7:0)+(y%3?0:10)+(seed%9);
  const at=(y*n+x)*4;bytes.set([v,v,kind==='wood'?v*.94:v,255],at);
 }
 embedPixelSignature(bytes,{label:'apartment/'+kind});const tex=new T.DataTexture(bytes,n,n,T.RGBAFormat);tex.name='@r_peredelkino · '+kind;tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.userData.attribution={...attribution};tex.needsUpdate=true;return tex;
}
function rounded(w,h,d,r=.025){r=Math.min(r,w/5,h/5,d/5);const x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r,rr=Math.min(r,ww/4,hh/4),s=new T.Shape();
 s.moveTo(x+rr,y);s.lineTo(x+ww-rr,y);s.quadraticCurveTo(x+ww,y,x+ww,y+rr);s.lineTo(x+ww,y+hh-rr);s.quadraticCurveTo(x+ww,y+hh,x+ww-rr,y+hh);s.lineTo(x+rr,y+hh);s.quadraticCurveTo(x,y+hh,x,y+hh-rr);s.lineTo(x,y+rr);s.quadraticCurveTo(x,y,x+rr,y);
 const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3,curveSegments:8,steps:1});g.translate(0,0,-d/2+r);return g;
}
export function createApartment(id){const data=apartmentPlans[id];if(!data)throw new Error('Квартира недоступна');const metrics=apartmentMetrics(data),{coord,scale}=metrics;
 const root=new T.Group(),lower=new T.Group(),upper=new T.Group(),furniture=new T.Group(),ceiling=new T.Group(),details=new T.Group();root.name='Apartment '+id+' · original-plan reconstruction';root.add(lower,upper,furniture,ceiling,details);upper.visible=false;ceiling.visible=false;
 const textures=['wood','parquet','tile','fabric'].map(surface),facadeRegistration=registerApartmentFacade(data,metrics),interactionVisuals={televisions:[],lights:[],furniture:[]};
 const mat=(color,roughness=.7,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
 const mats={wall:mat(0xf4f0e7,.95),floor:mat(0xcfbca2,.86,{map:textures[1]}),tile:mat(0xcecebd,.54,{map:textures[2]}),wood:mat(0x9d7755,.6,{map:textures[0]}),oak:mat(0xccb591,.6,{map:textures[0]}),cream:mat(0xede7d9,.74),fabric:mat(0xa8b4a4,.97,{map:textures[3]}),pillow:mat(0xece7db,.98,{map:textures[3]}),green:mat(0x3f6258,.83),dark:mat(0x334345,.55),metal:mat(0xaaaead,.23,{metalness:.8}),white:mat(0xf9f9ef,.31),glass:mat(0x8c9b91,.31,{metalness:.08,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false}),screen:mat(0x172a31,.23,{emissive:0x13323c,emissiveIntensity:.45}),glow:mat(0xfff1d2,.2,{emissive:0xffe6b4,emissiveIntensity:1.8})};
 function add(geo,material,x,y,z,g=details){const mesh=new T.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=material!==mats.glass;mesh.receiveShadow=true;g.add(mesh);return mesh}
 const box=(w,h,d,x,y,z,material,g=details,soft=false)=>add(soft?rounded(w,h,d):new T.BoxGeometry(w,h,d),material,x,y+h/2,z,g);
 const cyl=(r,h,x,y,z,material,g=details,r2=r)=>add(new T.CylinderGeometry(r,r2,h,32),material,x,y+h/2,z,g);
 function plane(points,material,y,g){const s=new T.Shape();points.forEach((p,i)=>{const [x,z]=coord(...p);i?s.lineTo(x,-z):s.moveTo(x,-z)});s.closePath();const o=add(new T.ShapeGeometry(s),material,0,y,0,g);o.rotation.x=-Math.PI/2;return o}
 const floor=plane(data.outline,mats.floor,0,details),roomMeshes=data.rooms.map(r=>plane(r.p,(r.name==='Санузел'||r.name==='Ванная'?mats.tile:mats.floor).clone(),.014,details));
 floor.name='Apartment original-plan floor below room finishes';floor.userData.dynamic=true;roomMeshes.forEach((o,i)=>{o.name='Apartment room floor '+i;o.userData.dynamic=true;});
 const slab=plane(data.outline,mats.wall,data.ceilingHeight,ceiling);slab.material=mats.wall.clone();slab.material.side=T.DoubleSide;
 function segment(a,parent,y,h,material,thickness=.13){const [ax,az]=coord(a[0],a[1]),[bx,bz]=coord(a[2],a[3]),g=new T.Group();g.position.set((ax+bx)/2,0,(az+bz)/2);g.rotation.y=-Math.atan2(bz-az,bx-ax);parent.add(g);const len=Math.hypot(bx-ax,bz-az);box(len,h,thickness,0,y,0,material,g);return{g,len};}
 for(const a of data.walls){segment(a,lower,0,.78,mats.wall);segment(a,upper,.78,data.ceilingHeight-.78,mats.wall);segment(a,details,.015,.08,mats.white,.145);}
 // Fit only the glazing and its reveals to the unchanged exterior pane surface.
 // Pixel-traced apartment boundaries, floor area and furniture do not move.
 const paneGeometries=[],frameKeys=new Set(),{sill,head,frame,sash,crossbarHeight}=facadeRegistration.profile;
 function localBar(a,b,parent,y,h,material,depth=.08){const g=new T.Group(),len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.001)return null;g.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);g.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);parent.add(g);return box(len,h,depth,0,y,0,material,g);}
 function bridgeSurface(points,y,parent,thickness=.035){const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));shape.closePath();const geometry=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);return add(geometry,mats.wall,0,y,0,parent);}
 for(const w of facadeRegistration.windows){const a=data.windows[w.index],{g,len}=segment(a,lower,0,sill,mats.wall,.30);box(len+.03,.045,.34,0,sill-.045,0,mats.oak,g);segment(a,upper,head,data.ceilingHeight-head,mats.wall,.30);
  const outer=w.panes.flatMap((p,i)=>i?p.points.slice(1):p.points),reveal=[w.originalA,w.originalB,...outer.slice().reverse()];if(outer.length>1){bridgeSurface(reveal,sill-.045,lower,.045);bridgeSurface(reveal,head,upper,.035);}
  for(const [inside,outside]of [[w.originalA,w.adaptedA],[w.originalB,w.adaptedB]]){if(Math.hypot(inside[0]-outside[0],inside[1]-outside[1])>.018)localBar(inside,outside,upper,sill,head-sill,mats.wall,.055);}
  for(const p of w.panes){paneGeometries.push(facadePaneGeometry(p.points,sill,head));
   for(let i=0;i<p.points.length-1;i++)for(const y of [sill,head-.035])localBar(p.points[i],p.points[i+1],upper,y,.035,mats.dark,.08);
   for(const point of [p.points[0],p.points.at(-1)]){const key=point.map(v=>v.toFixed(3)).join(',');if(frameKeys.has(key))continue;frameKeys.add(key);const mesh=box(frame,head-sill,.08,point[0]+p.normal[0]*.035,sill,point[1]+p.normal[1]*.035,mats.dark,upper);mesh.rotation.y=-Math.atan2(p.points.at(-1)[1]-p.points[0][1],p.points.at(-1)[0]-p.points[0][0]);}
   if(p.sash){const mesh=box(sash,head-sill,.065,p.sash[0]+p.normal[0]*.04,sill,p.sash[1]+p.normal[1]*.04,mats.dark,upper);mesh.rotation.y=-Math.atan2(p.points.at(-1)[1]-p.points[0][1],p.points.at(-1)[0]-p.points[0][0]);}
   if(p.crossbar)localBar(...p.crossbar,upper,crossbarHeight,.035,mats.dark,.065);
  }
  if(len>.65){box(len*.65,.20,.09,0,.10,-.20,mats.white,g);for(let i=0;i<7;i++)box(.009,.18,.012,(i-3)*len*.07,.11,-.25,mats.cream,g);}
 }
 // A single transparent draw preserves the curved facade without one mesh per
 // piece of glass. Static frames are merged by material with the opaque walls.
 const glassGeometry=new T.BufferGeometry(),glassPositions=[],glassUV=[];for(const geometry of paneGeometries){glassPositions.push(...geometry.attributes.position.array);glassUV.push(...geometry.attributes.uv.array);geometry.dispose();}glassGeometry.setAttribute('position',new T.Float32BufferAttribute(glassPositions,3));glassGeometry.setAttribute('uv',new T.Float32BufferAttribute(glassUV,2));glassGeometry.computeVertexNormals();const glazing=add(glassGeometry,mats.glass,0,0,0,upper);glazing.name='Apartment glazing fitted to the original tower bay surface';glazing.userData.facadeRegistration=facadeRegistration.metadata;
 for(let i=0;i<data.doors.length;i++){const a=data.doors[i],[ax,az]=coord(a[0],a[1]),[bx,bz]=coord(a[2],a[3]),len=Math.hypot(bx-ax,bz-az),g=new T.Group();g.position.set(ax,0,az);g.rotation.y=-Math.atan2(bz-az,bx-ax);upper.add(g);box(len,.67,.13,len/2,2.13,0,mats.wall,g);
  for(const x of [0,len])box(.04,2.13,.15,x,0,0,mats.oak,g);box(len+.07,.05,.16,len/2,2.09,0,mats.oak,g);
  // Leaves are opened to the drawn swing; walkthrough collision follows clear openings, never the drawn swing arc.
  const leaf=new T.Group();leaf.rotation.y=Math.PI/2;g.add(leaf);box(Math.max(.35,len-.045),2.04,.037,len/2,0,0,mats.oak,leaf);box(.12,.018,.018,len*.83,1.02,.042,mats.metal,leaf);
 }
 function chair(g,w,d){box(w*.92,.08,d*.9,0,.43,0,mats.fabric,g,true);box(w*.94,.39,.055,0,.49,-d*.42,mats.fabric,g,true);for(const a of [-1,1])for(const b of [-1,1])box(.024,.43,.024,a*w*.35,0,b*d*.32,mats.dark,g);}
 function basin(g,w,d,y=.86){box(w,.05,d,0,y,0,mats.white,g,true);const bowl=add(new T.SphereGeometry(1,24,12),mats.tile,0,y+.026,0,g);bowl.scale.set(w*.3,.018,d*.31);box(.026,.23,.026,0,y+.05,-d*.35,mats.metal,g);box(.026,.025,d*.25,0,y+.25,-d*.24,mats.metal,g);}
 function legs(g,w,d,h){for(const a of [-1,1])for(const b of [-1,1])box(.033,h,.033,a*w*.38,0,b*d*.34,mats.dark,g);}
 for(const [index,item] of data.furniture.entries()){const [type,x,z,wp,dp,angle]=item;const [px,pz]=coord(x,z),w=wp*scale,d=dp*scale,g=new T.Group();g.name=type+' · '+x+','+z;g.position.set(px,.025,pz);g.rotation.y=-angle;furniture.add(g);interactionVisuals.furniture.push({index,type,x:px,z:pz,w,d,angle:-angle});
  if(type==='bed'){box(w,.23,d,0,.06,0,mats.oak,g,true);box(w*.96,.24,d*.95,0,.29,0,mats.white,g,true);box(w*.97,.72,.065,0,.04,-d*.49,mats.oak,g,true);box(w*.96,.06,d*.65,0,.53,d*.12,mats.fabric,g,true);box(w*.96,.045,d*.22,0,.60,d*.33,mats.green,g,true);for(const a of [-1,1])box(w*.40,.10,d*.18,a*w*.24,.54,-d*.33,mats.pillow,g,true);
   const rug=cyl(Math.max(w,d)*.65,.013,0,-.016,0,mats.cream,g);rug.scale.z=.91;
  }else if(type==='sofa'){legs(g,w,d,.16);box(w,.24,d,0,.16,0,mats.fabric,g,true);box(w,.42,d*.19,0,.4,-d*.43,mats.fabric,g,true);for(const a of [-1,1])box(w*.065,.43,d,a*w*.465,.29,0,mats.fabric,g,true);for(let i=0;i<3;i++){box(w*.29,.17,d*.74,(i-1)*w*.30,.4,d*.02,mats.fabric,g,true);const p=box(w*.28,.29,.095,(i-1)*w*.30,.53,-d*.30,mats.pillow,g,true);p.rotation.x=-.12}for(const a of [-1,1]){const p=box(.28,.065,.28,a*w*.35,.6,d*.13,mats.green,g,true);p.rotation.z=a*.4;}
  }else if(type==='lsofa'){box(w*.42,.34,d,-w*.28,.15,0,mats.fabric,g,true);box(w,.34,d*.38,0,.15,d*.3,mats.fabric,g,true);box(.08,.49,d,-w*.48,.34,0,mats.fabric,g,true);box(w,.49,.085,0,.34,d*.48,mats.fabric,g,true);for(let i=0;i<3;i++){box(w*.33,.13,d*.28,-w*.26,.49,(i-1)*d*.29,mats.pillow,g,true);}box(w*.46,.14,d*.28,w*.23,.49,d*.28,mats.pillow,g,true);
  }else if(type==='roundTable'||type==='rectTable'||type==='coffee'||type==='desk'){
   const h=type==='coffee'?.38:type==='desk'?.74:.75;
   if(type==='roundTable')cyl(w/2,.05,0,h,0,mats.oak,g);else if(type==='coffee'){const s=new T.Shape();s.moveTo(-w*.42,-d*.23);s.bezierCurveTo(-w*.8,d*.38,w*.5,d*.67,w*.46,d*.12);s.bezierCurveTo(w*.61,-d*.58,-w*.25,-d*.59,-w*.42,-d*.23);const geom=new T.ExtrudeGeometry(s,{depth:.05,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:3});geom.rotateX(-Math.PI/2);add(geom,mats.oak,0,h,0,g);}else box(w,.045,d,0,h,0,mats.oak,g,true);
   legs(g,w,d,h);if(type==='desk'){box(w*.75,.12,d*.65,0,h-.12,0,mats.oak,g,true);const screen=box(w*.34,.23,.02,0,h+.06,-d*.20,mats.screen,g);screen.rotation.x=-.16;box(w*.35,.012,d*.20,0,h+.048,d*.11,mats.dark,g);}else{cyl(.055,.045,0,h+.055,0,mats.white,g);cyl(.015,.04,.12,h+.055,-.04,mats.green,g);}
  }else if(type==='chair')chair(g,w,d);
  else if(type==='wardrobe'||type==='utility'||type==='fridge'){const h=type==='fridge'?2.03:2.55;box(w,h,d,0,0,0,type==='fridge'?mats.cream:mats.oak,g);const doors=Math.max(1,Math.round(w/.47));for(let i=0;i<doors;i++){const xx=-w/2+w*(i+.5)/doors;box(w/doors-.012,h-.065,.016,xx,.03,d/2+.009,type==='fridge'?mats.white:mats.cream,g);box(.013,.21,.025,xx+w/doors*.3,1.08,d/2+.025,mats.metal,g);}if(type==='fridge')box(w,.012,.015,0,.75,d/2+.03,mats.dark,g);}
  else if(type==='kitchen'||type==='sink'){box(w,.83,d,0,0,0,mats.cream,g);box(w+.035,.055,d+.025,0,.83,0,mats.oak,g,true);for(let i=0;i<Math.max(1,Math.round(w/.5));i++){const count=Math.max(1,Math.round(w/.5)),xx=-w/2+w*(i+.5)/count;box(w/count-.01,.76,.014,xx,.04,d/2+.008,mats.white,g);box(w/count*.5,.012,.025,xx,.72,d/2+.024,mats.metal,g);}
   if(type==='kitchen'){box(Math.min(w,.6),.014,Math.min(d,.53),0,.897,0,mats.dark,g,true);for(const a of [-1,1])for(const b of [-1,1]){const ring=new T.Mesh(new T.TorusGeometry(.077,.008,5,24),mats.metal);ring.rotation.x=-Math.PI/2;ring.position.set(a*Math.min(w,.6)*.24,.919,b*Math.min(d,.53)*.24);g.add(ring)}box(Math.min(w,.57),.40,.024,0,.19,d/2+.024,mats.dark,g,true);box(Math.min(w,.48),.023,.02,0,.62,d/2+.05,mats.metal,g);}else basin(g,Math.min(w*.7,.56),d*.75,.888);
  }else if(type==='nightstand'||type==='bench'){const h=type==='bench'?.43:.48;box(w,h,d,0,.04,0,type==='bench'?mats.fabric:mats.oak,g,true);if(type==='nightstand'){box(w*.91,.16,.012,0,.2,d/2+.012,mats.cream,g);cyl(.062,.023,0,h+.05,0,mats.metal,g);cyl(.007,.16,0,h+.075,0,mats.metal,g);cyl(.085,.12,0,h+.23,0,mats.pillow,g,.05);}}
  else if(type==='bath'){box(w,.58,d,0,0,0,mats.white,g,true);box(w*.85,.023,d*.81,0,.59,0,mats.tile,g,true);box(w*.68,.01,d*.67,0,.612,0,mats.glass,g,true);box(.025,.22,.025,0,.6,-d*.35,mats.metal,g);}
  else if(type==='vanity'){box(w,.56,d,0,.2,0,mats.oak,g,true);basin(g,w,d,.79);box(w*.85,.70,.018,0,1.12,-d/2,mats.metal,g,true);box(w*.81,.66,.022,0,1.14,-d/2+.014,mats.glass,g);}
  else if(type==='toilet'){box(w*.9,.65,d*.28,0,0,-d*.32,mats.white,g,true);const bowl=add(new T.SphereGeometry(1,24,16),mats.white,0,.29,d*.11,g);bowl.scale.set(w*.47,.21,d*.47);const ring=new T.Mesh(new T.TorusGeometry(w*.33,.027,6,32),mats.white);ring.rotation.x=-Math.PI/2;ring.scale.y=d/w;ring.position.set(0,.44,d*.11);g.add(ring);}
  else if(type==='washer'){box(w,.84,d,0,0,0,mats.white,g,true);const p=new T.Mesh(new T.CircleGeometry(w*.30,32),mats.screen);p.position.set(0,.43,d/2+.006);g.add(p);const ring=new T.Mesh(new T.TorusGeometry(w*.31,.027,6,32),mats.metal);ring.position.copy(p.position);g.add(ring);box(w*.85,.08,.017,0,.71,d/2+.008,mats.cream,g);}
  else if(type==='shower'){box(w,.05,d,0,0,0,mats.white,g,true);for(const xx of [-w/2,w/2])box(.025,2.05,d,xx,.05,0,mats.glass,g);box(w,2.05,.022,0,.05,d/2,mats.glass,g);box(.026,1.7,.026,w*.4,.18,-d*.40,mats.metal,g);cyl(.12,.012,w*.4,1.89,-d*.26,mats.metal,g);}
  else if(type==='tv'){box(w,.53,d,0,.94,0,mats.dark,g,true);const material=mats.screen.clone(),screen=box(w*.94,.47,.009,0,.97,d/2+.009,material,g);screen.name='Interactive television '+index;screen.userData.dynamic=true;interactionVisuals.televisions.push({index,mesh:screen,material});box(w*1.1,.24,d*2,0,.43,0,mats.oak,g,true);}
  else if(type==='plant'){cyl(w*.24,.29,0,0,0,mats.cream,g,w*.17);for(let i=0;i<9;i++){const a=i*2.4,leaf=add(new T.SphereGeometry(1,8,6),mats.green,Math.cos(a)*w*.19,.36+(i%3)*.14,Math.sin(a)*d*.21,g);leaf.scale.set(w*.13,.27,d*.08);leaf.rotation.z=Math.cos(a)*.65;leaf.rotation.x=Math.sin(a)*.65;}}
 }
 // A recessed luminaire over each room; the actual lighting is inexpensive enough for mobile WebGL.
 data.roomSpawns.forEach((p,room)=>{const [x,z]=coord(...p),material=mats.glow.clone(),mesh=cyl(.12,.035,x,data.ceilingHeight-.145,z,material,ceiling);mesh.name='Interactive room luminaire '+room;mesh.userData.dynamic=true;interactionVisuals.lights.push({room,mesh,material});});
 // Flatten the static furniture into material batches, preserving its independently traced collision footprints.
 for(const group of [furniture,lower,upper,details,ceiling]){const flat=[];root.updateMatrixWorld(true);group.traverse(o=>{if(o.isMesh)flat.push(o)});for(const o of flat){const matrix=o.matrixWorld.clone();o.removeFromParent();o.matrix.copy(matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);group.add(o)}for(const o of [...group.children])if(!o.isMesh)group.remove(o);batchStatic(group);}
 const voxelAuthorship=createDistributedSurfaceMarks(root,{label:'apartment/'+id,maxCarriers:3,pixel:.012,depth:.005,carriers:[roomMeshes[0],...furniture.children,...roomMeshes.slice(1)],allowFloorDynamic:true});
 const mask=createAttributionTexture();for(let i=3;i<mask.image.data.length;i+=4)mask.image.data[i]=Math.round(mask.image.data[i]*.22);mask.needsUpdate=true;
 const authored=bakeSceneAuthorship(root,{mask,label:'apartment-'+id+'-plan37'});for(const texture of textures)authored.textures.delete(texture);
 // A presentation cutaway is not an opening to the sky. Retain the exact
 // opaque upper-wall/ceiling geometry in the shadow pass while hiding its
 // colour and depth writes. Glass remains a transparent opening for sunlight.
 // Add after authorship baking: original vertex buffers/signatures stay intact.
 const shadowEnvelope=new T.Group();shadowEnvelope.name='Apartment opaque envelope · shadow only';root.add(shadowEnvelope);
 const shadowMaterial=new T.MeshBasicMaterial({side:T.DoubleSide,colorWrite:false,depthWrite:false,depthTest:false});
 shadowMaterial.name='Invisible opaque apartment envelope';shadowMaterial.shadowSide=T.DoubleSide;
 function shadowCopy(source,part){
  const group=new T.Group();group.name=part+' · retained cutaway shadows';shadowEnvelope.add(group);
  source.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>m.transparent||m.opacity<1))return;
   const proxy=new T.Mesh(o.geometry,shadowMaterial);proxy.name=o.name+' · '+part+' shadow';proxy.matrix.copy(o.matrix);proxy.matrix.decompose(proxy.position,proxy.quaternion,proxy.scale);proxy.castShadow=true;proxy.receiveShadow=false;proxy.raycast=()=>{};
   proxy.userData={shadowOnly:true,noAutomaticCollider:true,sourceMesh:o.uuid,envelopePart:part};group.add(proxy);
  });return group;
 }
 const upperShadow=shadowCopy(upper,'upper walls'),ceilingShadow=shadowCopy(ceiling,'ceiling');
 let withFurniture=true,full=false,walking=false,disposed=false;let world=createApartmentWorld(id,true);
 function syncEnvelope(){upper.visible=walking||full;ceiling.visible=walking;upperShadow.visible=!upper.visible;ceilingShadow.visible=!ceiling.visible;}
 function setArtificialLight(on){for(const light of interactionVisuals.lights)light.material.emissiveIntensity=on?1.8:0;}
 syncEnvelope();setArtificialLight(false);
 return{root,data,metrics,facadeRegistration,glazing,interactionVisuals,voxelAuthorship,roomMeshes,furniture,lower,upper,ceiling,shadowEnvelope,upperShadow,ceilingShadow,authored,setArtificialLight,get world(){return world},get withFurniture(){return withFurniture},
 setFurniture(on){withFurniture=on;furniture.visible=on;world=createApartmentWorld(id,on);return world},
 setFull(on){full=!!on;syncEnvelope()},setWalking(on){walking=!!on;syncEnvelope()},
 highlight(index){roomMeshes.forEach((o,i)=>o.material.color.set(i===index?0xe4efbf:(data.rooms[i].name==='Ванная'||data.rooms[i].name==='Санузел')?0xcecebd:0xcfbca2))},
 dispose(){if(disposed)return;disposed=true;voxelAuthorship.dispose();authored.dispose();mask.dispose();textures.forEach(t=>t.dispose());const geos=new Set(),materials=new Set(Object.values(mats));root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m)});geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 };
}
