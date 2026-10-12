// OSM footprint data © OpenStreetMap contributors, ODbL 1.0.
// Reference facade reconstruction @r_peredelkino · v28.
import * as THREE from './vendor/three.module.js';
import {mapPoint,location} from './solar.js?v=community38';
import {createMineralMaterial} from './landscape-materials.js?v=community38';
import {neighborBuildingLayout,resolveNeighborBuildingLayout,neighborPointInside,neighborSegmentDistance} from './neighbor-building-layout.js?v=community38';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const hex=value=>'#'+new THREE.Color(value).getHexString();
const hash=value=>{value=Math.imul(value^0x9e3779b9,0x85ebca6b);value=Math.imul(value^(value>>>13),0xc2b2ae35);return(value^(value>>>16))>>>0;};

export function createNeighborBuildings(parent,contextBuildings){
 const group=new THREE.Group();group.name='Addressed neighbouring houses on OSM polygons';parent.add(group);
 const materials={
  plaster:createMineralMaterial(0xffffff,{grain:.035,scale:3,name:'Neighbouring houses / painted panel walls'}),
  frames:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.76,metalness:.08}),
  recess:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.92}),
  glass:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.32,metalness:.22}),
  litGlass:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.32,metalness:.22,emissive:0xffce96,emissiveIntensity:0}),
  roof:createMineralMaterial(0x55595a,{grain:.09,scale:4,name:'Neighbouring houses / flat mineral roofs'}),
  roofMetal:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.80,metalness:.12})
 };
 for(const [key,material] of Object.entries(materials)){material.name=`Neighbouring houses · ${key}`;material.userData.neighborRole=key;}
 const cube=new THREE.BoxGeometry(1,1,1),pane=new THREE.PlaneGeometry(1,1),balconyShape=new THREE.Shape();
 balconyShape.moveTo(-.5,0);balconyShape.lineTo(.5,0);balconyShape.lineTo(.36,-1);balconyShape.lineTo(-.36,-1);balconyShape.closePath();
 const baySolid=new THREE.ExtrudeGeometry(balconyShape,{depth:1,bevelEnabled:false,steps:1});baySolid.rotateX(-Math.PI/2);baySolid.translate(0,-.5,0);
 const frameGeometries=new Map(),batches=new Map(),matrixObject=new THREE.Object3D(),tint=new THREE.Color(),all=resolveNeighborBuildingLayout(contextBuildings),buildingRecords=[];
 // Plan dimensions are converted at the call site. Vertical module dimensions
 // remain metric and share the identical scale around the fixed ground level.
 const verticalScale=all[0].planUnit,verticalY=y=>neighborBuildingLayout.baseY+(y-neighborBuildingLayout.baseY)*verticalScale;
 group.scale.y=verticalScale;group.position.y=neighborBuildingLayout.baseY*(1-verticalScale);
 let active=null,night=0,winter=false;
 const P=value=>value*(active?.planUnit||1);

 // A complete window frame is a single instanced module. The eleven houses
 // share its few variants, instead of creating separate meshes for each bar.
 function frameGeometry(divisions,transom){
  const key=`${divisions}:${transom}`;if(frameGeometries.has(key))return frameGeometries.get(key);
  const bars=[[-.521,0,.040,1.075],[.521,0,.040,1.075],[0,-.521,1.082,.042],[0,.521,1.082,.042]];
  for(let i=1;i<divisions;i++)bars.push([i/divisions-.5,0,.025,1]);
  if(transom)bars.push([0,.14,1,.024]);
  const geometries=bars.map(([x,y,w,h])=>{const g=new THREE.BoxGeometry(w,h,1).toNonIndexed();g.translate(x,y,0);return g;});
  const size=geometries.reduce((n,g)=>n+g.attributes.position.array.length,0),positions=new Float32Array(size),normals=new Float32Array(size),uvs=new Float32Array(size/3*2);let offset=0;
  for(const geometry of geometries){positions.set(geometry.attributes.position.array,offset);normals.set(geometry.attributes.normal.array,offset);uvs.set(geometry.attributes.uv.array,offset/3*2);offset+=geometry.attributes.position.array.length;geometry.dispose();}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  frameGeometries.set(key,geometry);return geometry;
 }
 function instance(geometry,material,role,position,rotation,scale,colour=0xffffff){
  // Batch by shared geometry/material; semantic roles live in metadata.
  const key=`${geometry.uuid}:${material.uuid}`;let batch=batches.get(key);
  if(!batch){batch={geometry,material,items:[],roles:{}};batches.set(key,batch);}
  matrixObject.position.set(...position);matrixObject.rotation.set(0,rotation,0);matrixObject.scale.set(...scale);matrixObject.updateMatrix();
  batch.items.push({matrix:matrixObject.matrix.clone(),colour,building:active?.id});batch.roles[role]=(batch.roles[role]||0)+1;
  if(active){active.instanceCount++;active.roles[role]=(active.roles[role]||0)+1;}
 }
 function facadeBasis(normal){const p=mapPoint(normal[0],normal[1]);return{angle:Math.atan2(p[0],p[2]),tangent:[-normal[1],normal[0]]};}
 function facadeBox(w,h,d,e,n,y,normal,offset,material,colour,role){instance(cube,material,role,mapPoint(e+normal[0]*offset,n+normal[1]*offset,y+h/2),facadeBasis(normal).angle,[w,h,d],colour);}
 function glassPane(e,n,y,width,height,normal,offset,seed,role){
  const lit=hash(seed)%100<27,base=new THREE.Color(active.palette.glass),tones=[.84,.94,1.03,1.12];base.multiplyScalar(tones[hash(seed+71)%tones.length]);
  instance(pane,lit?materials.litGlass:materials.glass,lit?'Warm occupied windows':'Cool unlit windows',mapPoint(e+normal[0]*offset,n+normal[1]*offset,y+height/2),facadeBasis(normal).angle,[width,height,1],base.getHex());
  active.windowCount++;active.litWindowCount+=Number(lit);active.windowKinds[role]=(active.windowKinds[role]||0)+1;
 }
 function window(e,n,y,width,height,normal,seed,{balcony=false,transom=true,kind=null}={}){
  if(width<P(.24)||height<.25)return;
  const angle=facadeBasis(normal).angle,frameOffset=P(balcony?.046:.139),frameDepth=P(balcony?.070:.10);
  if(!balcony)instance(pane,materials.recess,'Dark window reveals',mapPoint(e+normal[0]*P(.064),n+normal[1]*P(.064),y+height/2),angle,[width+P(.15),height+.12,1],0x37434a);
  glassPane(e,n,y,width,height,normal,P(balcony?.018:.086),seed,kind||(balcony?'enclosed-balcony':'window'));
  const divisions=width>P(2)?3:width>P(1.45)?2:1;
  instance(frameGeometry(divisions,transom&&height>1.2),materials.frames,'Instanced white window frame modules',mapPoint(e+normal[0]*frameOffset,n+normal[1]*frameOffset,y+height/2),angle,[width,height,frameDepth],active.palette.frame);
 }
 function enclosedBalcony(e,n,y,width,floorHeight,normal,seed){
  const projection=P(1.12),parapet=.82,ceiling=floorHeight-.10,angle=facadeBasis(normal).angle,tangent=facadeBasis(normal).tangent;
  const at=(u,v)=>[e+tangent[0]*u+normal[0]*v,n+tangent[1]*u+normal[1]*v];
  instance(baySolid,materials.plaster,'Projecting angular balcony parapets',mapPoint(e,n,y+.14+parapet/2),angle,[width,parapet,projection],active.palette.balcony);
  instance(baySolid,materials.frames,'White balcony floor plates',mapPoint(e,n,y+.07),angle,[width+P(.10),.14,projection+P(.06)],active.palette.frame);
  instance(baySolid,materials.frames,'White balcony ceiling plates',mapPoint(e,n,y+ceiling+.065),angle,[width+P(.10),.13,projection+P(.06)],active.palette.frame);
  const glassBase=y+.14+parapet+.08,glassHeight=ceiling-.14-parapet-.15;
  const segments=[[[-width*.5,0],[-width*.36,projection]],[[-width*.36,projection],[width*.36,projection]],[[width*.36,projection],[width*.5,0]]];
  segments.forEach(([a,b],index)=>{
   const av=at(...a),bv=at(...b),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   let sideNormal=[bv[1]-av[1],-(bv[0]-av[0])],len=Math.hypot(...sideNormal);sideNormal=sideNormal.map(c=>c/len);
   if(sideNormal[0]*(av[0]+bv[0]-2*e)+sideNormal[1]*(av[1]+bv[1]-2*n)<0)sideNormal=sideNormal.map(c=>-c);
   const center=at((a[0]+b[0])/2,(a[1]+b[1])/2);window(center[0],center[1],glassBase,length-P(.075),glassHeight,sideNormal,seed+index,{balcony:true,transom:false});
  });
  if(active.profile==='pink-white-panel')for(const side of [-1,1]){const [pe,pn]=at(side*width*.36,projection);facadeBox(P(.11),floorHeight-.10,P(.11),pe,pn,y+.07,normal,0,materials.frames,active.palette.frame,'White vertical balcony corner piers');}
  active.balconyCount++;
 }
 function continuousLoggia(e,n,y,width,floorHeight,normal,seed,cells){
  const projection=P(.82),tangent=facadeBasis(normal).tangent,at=u=>[e+tangent[0]*u,n+tangent[1]*u],glassBase=y+1.01,glassHeight=floorHeight-1.20;
  facadeBox(width+P(.10),.14,projection+P(.10),e,n,y,normal,projection*.5,materials.frames,active.palette.frame,'Continuous loggia floor plates');
  facadeBox(width,.78,P(.13),e,n,y+.14,normal,projection-P(.06),materials.plaster,active.palette.balcony,'Continuous pale loggia parapet bands');
  facadeBox(width+P(.10),.13,projection+P(.10),e,n,y+floorHeight-.12,normal,projection*.5,materials.frames,active.palette.frame,'Continuous loggia ceiling plates');
  const cellWidth=width/cells;
  for(let cell=0;cell<cells;cell++){const [ce,cn]=at(-width/2+cellWidth*(cell+.5));window(ce+normal[0]*(projection-P(.06)),cn+normal[1]*(projection-P(.06)),glassBase,cellWidth-P(.11),glassHeight,normal,seed+cell,{balcony:true,transom:false,kind:'continuous-loggia'});}
  for(let divider=0;divider<=cells;divider++){const [pe,pn]=at(-width/2+cellWidth*divider);facadeBox(P(.08),floorHeight-.10,projection,pe,pn,y+.06,normal,projection*.5,materials.frames,active.palette.frame,'White loggia dividing piers');}
  active.balconyCount+=cells;active.continuousLoggiaRows++;
 }
 function pointAlong(edge,fraction,normalOffset=0){return[edge.a[0]+(edge.b[0]-edge.a[0])*fraction+edge.normal[0]*normalOffset,edge.a[1]+(edge.b[1]-edge.a[1])*fraction+edge.normal[1]*normalOffset];}
 function fitsRoof(house,center,normal,width,depth){const t=facadeBasis(normal).tangent;return[-1,1].every(u=>[-1,1].every(v=>neighborPointInside(center[0]+t[0]*u*width/2+normal[0]*v*depth/2,center[1]+t[1]*u*width/2+normal[1]*v*depth/2,house.footprintEN)));}
 function clearBalcony(house,e,n,width,normal){const t=facadeBasis(normal).tangent;return[-1,1].every(side=>[P(.045),P(1.20)].every(offset=>!neighborPointInside(e+t[0]*side*(width/2+P(.14))+normal[0]*offset,n+t[1]*side*(width/2+P(.14))+normal[1]*offset,house.footprintEN)));}

 for(const house of all){
  active={id:house.id,osmWayId:house.osmWayId,address:house.address,profile:house.profile,shape:house.shape,floors:house.floors,height:house.height*verticalScale,heightMeters:house.height,baseY:house.baseY,roofY:verticalY(house.roofY),planUnit:house.planUnit,floorHeight:house.floorHeight*verticalScale,floorHeightMeters:house.floorHeight,groundHeight:house.groundHeight*verticalScale,heightIsEstimate:true,
   palette:{...house.palette},sourceViews:house.sourceViews.slice(),sourceUrl:house.sourceUrl,osmVersion:house.osmVersion,osmTimestamp:house.osmTimestamp,facadeConfidence:house.facadeConfidence,
   coordinates:house.coordinates.map(p=>p.slice()),footprintEN:house.footprintEN.map(p=>p.slice()),boundsEN:{...house.boundsEN},envelopeEN:{...house.boundsEN},footprintArea:house.footprintArea,footprintPerimeter:house.footprintPerimeter,
   windowCount:0,litWindowCount:0,balconyCount:0,continuousLoggiaRows:0,entryCount:0,instanceCount:0,roles:{},windowKinds:{},facadeEdges:[],roofAnchorsEN:[],entrancesEN:[],
   sections:[{index:0,kind:'single-address polygon shell',floors:house.floors,height:house.height*verticalScale,roofY:verticalY(house.roofY),footprintEN:house.footprintEN.map(p=>p.slice()),boundsEN:{...house.boundsEN}}]};
  const polygon=new THREE.Shape(house.footprintEN.map(p=>{const q=mapPoint(...p);return new THREE.Vector2(q[0],-q[2]);}));polygon.closePath();
  // One exact concave extrusion per address. The opening of the C-shaped house
  // is outside this polygon, so neither wall mass nor roof can fill its court.
  const solid=new THREE.ExtrudeGeometry(polygon,{depth:1,bevelEnabled:false,steps:1});solid.rotateX(-Math.PI/2);solid.userData.neighborPolygon=house.id;
  instance(solid,materials.plaster,'OSM polygon residential shell',[0,house.baseY,0],0,[1,house.height,1],house.palette.wall);
  instance(solid,materials.plaster,'Dark panel building plinth',[0,house.baseY,0],0,[1,.46,1],0x8d938d);
  instance(solid,materials.roof,'Open-form flat roof matching the OSM polygon',[0,house.roofY+.025,0],0,[1,.085,1],0xffffff);
  for(const index of house.entryEdges){const edge=house.edges[index],count=Math.max(1,Math.round(edge.length/P(29)));for(let station=0;station<count;station++)active.entrancesEN.push({edge:index,point:pointAlong(edge,(station+.5)/count),estimated:true});}

  for(const edge of house.edges){
   const [e,n]=edge.center,normal=edge.normal,base=house.baseY,length=edge.length;
   const record={index:edge.index,a:edge.a.slice(),b:edge.b.slice(),length,normal:normal.slice(),kind:edge.end?'plain end':edge.continuousLoggia?'continuous street loggias':length<P(2.8)?'short panel return':'windowed facade'};active.facadeEdges.push(record);
   facadeBox(Math.max(P(.1),length-P(.04)),.50,P(.18),e,n,house.roofY+.10,normal,-P(.055),materials.plaster,house.palette.end,'Parapet following every actual boundary edge');
   if(edge.end){
    facadeBox(length-P(.04),house.height-.47,P(.045),e,n,base+.47,normal,P(.032),materials.plaster,house.palette.end,'Plain pale transverse end wall');
    for(let floor=1;floor<house.floors;floor++)facadeBox(length-P(.12),.020,P(.018),e,n,base+house.groundHeight+(floor-1)*house.floorHeight,normal,P(.068),materials.recess,0xb5bdb6,'Fine end-panel floor joints');
    const columns=Math.max(2,Math.round(length/P(3.0)));for(let column=1;column<columns;column++){const q=pointAlong(edge,column/columns);facadeBox(P(.018),house.height-.52,P(.018),q[0],q[1],base+.50,normal,P(.068),materials.recess,0xc1c7bf,'Fine end-panel vertical joints');}
    continue;
   }
   if(length<P(2.8))continue;
   const edgeInset=length>P(8)?P(.95):P(.40),available=length-2*edgeInset,bayCount=Math.max(1,Math.round(available/P(3.25))),pitch=available/bayCount;
   if(edge.continuousLoggia)for(let floor=1;floor<house.floors;floor++){const y=base+house.groundHeight+(floor-1)*house.floorHeight;continuousLoggia(e,n,y,length-P(.50),house.floorHeight,normal,house.osmWayId+edge.index*10000+floor*60,bayCount);}
   for(let bay=0;bay<bayCount;bay++){
    const fraction=(edgeInset+pitch*(bay+.5))/length,[we,wn]=pointAlong(edge,fraction),seed=house.osmWayId+edge.index*10000+bay*100;
    const width=Math.min(P(2.95),pitch*.83),balcony=!edge.continuousLoggia&&length>P(8)&&(bay+edge.index)%house.balconyPitch===0&&clearBalcony(house,we,wn,width,normal);
    if(house.accentPitch&&!balcony&&(bay+edge.index)%house.accentPitch===1)facadeBox(pitch*.75,house.height-.57,P(.043),we,wn,base+.52,normal,P(.028),materials.plaster,house.palette.accent,'Muted vertical ochre panel fields');
    const entrance=active.entrancesEN.some(entry=>entry.edge===edge.index&&Math.hypot(entry.point[0]-we,entry.point[1]-wn)<P(1.8));
    if(!entrance)window(we,wn,base+.87,Math.min(P(1.82),pitch*.64),1.68,normal,seed);
    if(edge.continuousLoggia)continue;
    for(let floor=1;floor<house.floors;floor++){const y=base+house.groundHeight+(floor-1)*house.floorHeight;
     if(balcony)enclosedBalcony(we,wn,y,width,house.floorHeight,normal,seed+floor*4);
     else window(we,wn,y+.76,Math.min(P(1.82),pitch*.65),1.60,normal,seed+floor*4);
    }
   }
   for(let floor=1;floor<house.floors;floor++)facadeBox(length-P(.10),.020,P(.018),e,n,base+house.groundHeight+(floor-1)*house.floorHeight-.025,normal,P(.035),materials.recess,0xaab2ac,'Fine panel storey joints');
  }

  // Roof equipment sits inside the actual strips of the polygon. The check
  // prevents stair heads, vents or short roof plates floating over the court.
  for(const index of house.roofEdges){const edge=house.edges[index],count=Math.max(1,Math.round(edge.length/P(27)));
   for(let station=0;station<count;station++){
    const center=pointAlong(edge,(station+.5)/count,-P(5.3)),normal=edge.normal,w=P(3.55),d=P(2.9);
    if(!fitsRoof(house,center,normal,w+P(.22),d+P(.22))||active.roofAnchorsEN.some(p=>Math.hypot(center[0]-p.point[0],center[1]-p.point[1])<P(6.5)))continue;
    facadeBox(w,1.26,d,...center,house.roofY+.12,normal,0,materials.plaster,house.palette.end,'Small estimated stair and lift roof heads');
    facadeBox(w+P(.22),.13,d+P(.22),...center,house.roofY+1.39,normal,0,materials.roof,0xffffff,'Flat roof-head caps');
    active.roofAnchorsEN.push({point:center,width:w,depth:d,normal:normal.slice(),estimated:true});
    const t=facadeBasis(normal).tangent,vent=[center[0]+t[0]*P(5.3),center[1]+t[1]*P(5.3)];
    if(fitsRoof(house,vent,normal,P(1.18),P(1.45))){facadeBox(P(1.08),.52,P(1.35),...vent,house.roofY+.13,normal,0,materials.roofMetal,0x929b94,'Low estimated roof ventilation boxes');facadeBox(P(1.18),.08,P(1.45),...vent,house.roofY+.66,normal,0,materials.roofMetal,0x606b6b,'Dark ventilation caps');}
   }
  }
  for(const entry of active.entrancesEN){const edge=house.edges[entry.edge],[e,n]=entry.point,normal=edge.normal;
   window(e,n,house.baseY+.08,P(1.58),2.22,normal,house.osmWayId+entry.edge,{transom:false,kind:'residential entrance'});
   facadeBox(P(2.80),.14,P(.96),e,n,house.baseY+2.55,normal,P(.53),materials.frames,house.palette.frame,'Small residential entrance canopies');
   facadeBox(P(2.65),.14,P(.92),e,n,house.baseY+.025,normal,P(.51),materials.plaster,0xa2aaa3,'Residential entrance steps');active.entryCount++;
  }
  active.paletteHex=Object.fromEntries(Object.entries(active.palette).map(([key,value])=>[key,hex(value)]));buildingRecords.push(active);
 }
 active=null;
 const batchRecords=[];
 for(const batch of batches.values()){
  const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.items.length),roles=Object.keys(batch.roles);mesh.name=roles.length===1?roles[0]:`Neighbouring houses · ${batch.material.userData.neighborRole} modules`;
  mesh.castShadow=batch.geometry===cube||batch.geometry===baySolid||Boolean(batch.geometry.userData.neighborPolygon);mesh.receiveShadow=true;
  const byBuilding={},ranges=[];
  batch.items.forEach((item,index)=>{mesh.setMatrixAt(index,item.matrix);tint.set(item.colour);mesh.setColorAt(index,tint);byBuilding[item.building]=(byBuilding[item.building]||0)+1;const range=ranges.at(-1);if(range?.id===item.building)range.count++;else ranges.push({id:item.building,start:index,count:1});});
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData.neighborBuildings={roles:batch.roles,byBuilding,ranges};group.add(mesh);
  batchRecords.push({name:mesh.name,roles:batch.roles,count:mesh.count,triangles:(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3*mesh.count,byBuilding,ranges});
 }
 const reservedFootprintsEN=buildingRecords.map(b=>({id:b.id,address:b.address,outer:b.footprintEN,holes:[],bounds:b.boundsEN,projectionReserve:1.45*b.planUnit}));
 const reservedEN=(e,n,margin=0)=>reservedFootprintsEN.some(b=>{const pad=Math.max(0,margin)+b.projectionReserve;if(e<b.bounds.minE-pad||e>b.bounds.maxE+pad||n<b.bounds.minN-pad||n>b.bounds.maxN+pad)return false;return neighborPointInside(e,n,b.outer)||b.outer.some((a,index)=>neighborSegmentDistance(e,n,a,b.outer[(index+1)%b.outer.length])<=pad);});
 const basisNormSquared=location.east[0]**2+location.east[1]**2;
 const reserved=(x,z,margin=0)=>reservedEN((x*location.east[0]+z*location.east[1])/basisNormSquared,(x*location.north[0]+z*location.north[1])/basisNormSquared,margin);
 const metadata={version:28,source:neighborBuildingLayout.source,buildingCount:buildingRecords.length,polygonCount:buildingRecords.length,footprintVertexCount:buildingRecords.reduce((s,b)=>s+b.footprintEN.length,0),verticalMetersToModel:verticalScale,buildings:buildingRecords,reservedFootprintsEN,
  drawCalls:batchRecords.length,instances:batchRecords.reduce((s,b)=>s+b.count,0),triangles:batchRecords.reduce((s,b)=>s+b.triangles,0),batches:batchRecords,windowCount:buildingRecords.reduce((s,b)=>s+b.windowCount,0),litWindowCount:buildingRecords.reduce((s,b)=>s+b.litWindowCount,0),balconyCount:buildingRecords.reduce((s,b)=>s+b.balconyCount,0),accuracy:neighborBuildingLayout.accuracy};
 group.userData.neighborBuildings=metadata;
 return{group,metadata,materials,reserved,reservedEN,get night(){return night;},get winter(){return winter;},setNight(value){night=clamp01(value);materials.litGlass.emissiveIntensity=night*.64;},setSeason(value){winter=Boolean(value);materials.roof.color.set(winter?0xdbe3e0:0x55595a);}};
}
