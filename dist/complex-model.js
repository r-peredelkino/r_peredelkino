import {createOfficeTerrace} from './office-terrace-v33.js?v=references37';
import {applyPaving} from './paving-material.js?v=references37';
import {forecourtReference} from './forecourt-reference-data.js?v=references37';
import {createSalesOffice,salesOfficeReserved} from './sales-office.js?v=references37';
import {createFoliageMaterial} from './landscape-materials.js?v=references37';
import {createGroundPodiumGeometry,createCourtyardPassage} from './courtyard-passage.js?v=references37';
import {retailLevels} from './frontage-zones.js?v=references37';
import {createUpperPodiumGeometry} from './podium-upper-cut.js?v=references37';
import {createTracedFanEdgeGeometry,createTracedFanSlabGeometry} from './roof-fan-edge-v34.js?v=references37';
import {createCommercialFrontage} from './commercial-frontage.js?v=references37';
import {createReferenceArena} from './arena-exterior.js?v=references37';
import {arenaCenter,arenaFootprint,arenaPlacement} from './arena-placement-v35.js?v=references37';
import {crownGeometry,branchingTrunk} from './botanical-geometry.js?v=references37';
// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import * as THREE from './vendor/three.module.js';
import {complexFootprints} from './complex-footprints.js?v=references37';
import {createPublicRealm} from './public-realm.js?v=references37';
import {publicRealmLayout} from './public-realm-layout.js?v=references37';
import {createCourtyard} from './courtyard.js?v=references37';
import {createNightLighting} from './night-lighting.js?v=references37';
import {createSurfaceFinishes} from './surface-finishes.js?v=references37';
import {bakeSceneAuthorship} from './baked-authorship.js?v=references37';
import {createAttributionTexture} from './attribution.js?v=references37';
import {createModelWatermarks} from './model-watermarks.js?v=references37';
import {createWindowLighting} from './window-lighting.js?v=references37';
import {createComplexLife} from './complex-life.js?v=references37';
import {createNeighborhood} from './neighborhood.js?v=references37';
import {createTraffic} from './traffic.js?v=references37';
import {smoothWallNormals,bendPaneMaterial,createRoomInteriorTexture,createFacadeRibbonGeometry,createRibbedBandMaterial,createRaisedRoofCrown,residentialFacadeSection} from './facade-detail.js?v=references37';
import {createExteriorRoofs} from './exterior-roofs.js?v=references37';
import {createTerraces} from './terraces.js?v=references37';
import {towerLevel} from './building-levels.js';
// Reference-based reconstruction, not a BIM or surveyed model. Dimensions in model metres.
export const towerSpecs=complexFootprints.buildings.filter(b=>b.id!==0);
export function roundedPolygon(vertices,amount=.17){const s=new THREE.Shape();const entry=[],exit=[];vertices.forEach((v,i)=>{const prev=vertices[(i+vertices.length-1)%vertices.length],next=vertices[(i+1)%vertices.length];entry.push(new THREE.Vector2(v[0]+(prev[0]-v[0])*amount,v[1]+(prev[1]-v[1])*amount));exit.push(new THREE.Vector2(v[0]+(next[0]-v[0])*amount,v[1]+(next[1]-v[1])*amount))});s.moveTo(exit[0].x,exit[0].y);for(let j=1;j<=vertices.length;j++){let i=j%vertices.length;s.lineTo(entry[i].x,entry[i].y);s.quadraticCurveTo(vertices[i][0],vertices[i][1],exit[i].x,exit[i].y)}s.closePath();return s}
export function triangle(r,sx=1,sz=1){return roundedPolygon([[0,r*sz],[-r*.91*sx,-r*.59*sz],[r*.91*sx,-r*.59*sz]],.24)}
function extrude(shape,height){const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:32,steps:1});g.rotateX(-Math.PI/2);return smoothWallNormals(g)}
// Typed-array copies avoid overflowing the JavaScript argument stack on iOS.
function merge(geometries){
 const expanded=geometries.map(g=>g.index?g.toNonIndexed():g),length=expanded.reduce((n,g)=>n+g.attributes.position.array.length,0);
 const pos=new Float32Array(length),normal=new Float32Array(length),uv=new Float32Array(length/3*2);let at=0;
 for(let i=0;i<expanded.length;i++){const g=expanded[i];pos.set(g.attributes.position.array,at);normal.set(g.attributes.normal.array,at);if(g.attributes.uv)uv.set(g.attributes.uv.array,at/3*2);at+=g.attributes.position.array.length;if(g!==geometries[i])g.dispose();geometries[i].dispose()}
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(normal,3));out.setAttribute('uv',new THREE.BufferAttribute(uv,2));return out;
}
function scaledShape(s,f){const pts=s.getPoints(18).map(p=>[p.x*f,p.y*f]);const result=new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x,y)));return result}
function ring(s,outer,inner){const r=scaledShape(s,outer);const pts=s.getPoints(18).map(p=>new THREE.Vector2(p.x*inner,p.y*inner)).reverse();const hole=new THREE.Path(pts);r.holes.push(hole);return r}
function contourShape(data){const shape=new THREE.Shape(data.outer.map(([x,z])=>new THREE.Vector2(x,-z)));for(const pts of data.holes)shape.holes.push(new THREE.Path(pts.map(([x,z])=>new THREE.Vector2(x,-z))));return shape}
function outlineCurve(points,y){return new THREE.CatmullRomCurve3(points.slice(0,-1).map(([x,z])=>new THREE.Vector3(x,y,z)),true,'centripetal')}
export function createComplex(){const brandTexture=createAttributionTexture();const root=new THREE.Group();root.name='RODINA_PEREDelkino';const towers=new Map(),animated=[];const mats={white:new THREE.MeshStandardMaterial({color:0xedece9,roughness:.65,metalness:.06}),glass:new THREE.MeshStandardMaterial({color:0x3a4550,roughness:.30,metalness:.24}),roof:new THREE.MeshStandardMaterial({color:0x92979a,roughness:.86}),base:new THREE.MeshStandardMaterial({color:0xb6b9aa,roughness:.92}),path:new THREE.MeshStandardMaterial({color:0xc4c5c0,roughness:.94}),garden:new THREE.MeshStandardMaterial({color:0x66785a,roughness:1}),bark:new THREE.MeshStandardMaterial({color:0x71634e,roughness:1}),leaves:createFoliageMaterial(0x4f6b49),accent:new THREE.MeshStandardMaterial({color:0xd6ff63,emissive:0x92c326,emissiveIntensity:.42,roughness:.45})};
const bandMaterial=createRibbedBandMaterial(mats.white),fluteTexture=bandMaterial.bumpMap;
// Fine staggered paving joints in world coordinates, shared by plaza and pedestrian paths.
applyPaving(mats.path);
const mesh=(g,m,parent=root)=>{let o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o};
const box=(w,h,d,x,y,z,m,parent=root)=>{let o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y+h/2,z);return o};
const ground=mesh(extrude(contourShape(complexFootprints.site),1.8),new THREE.MeshStandardMaterial({color:0x829078,roughness:1}));ground.position.y=-2.5;ground.name='Site outline traced from numbered plan';
for(const contour of forecourtReference.corePavingParts){const plaza=mesh(extrude(contourShape(contour),.16),mats.path);plaza.position.y=-.20;plaza.name='Site paving clipped to the fixed roads and photographed parking';}
// The traced ground floor stays continuous. The arena replaces only the upper
// retail volume; separate vertical intervals keep the white fascia visible.
const podiumShape=contourShape(complexFootprints.podium);const courtyardBaseMaterial=new THREE.MeshStandardMaterial({color:0x25282b,roughness:.79,metalness:.10,bumpMap:fluteTexture,bumpScale:.024});const pedestal=mesh(createGroundPodiumGeometry(retailLevels.dividerBottom),courtyardBaseMaterial);pedestal.name='Unified commercial ground floor including cyber arena';
const upperPedestal=mesh(createUpperPodiumGeometry(complexFootprints.podium,retailLevels.upperTop-retailLevels.upperBottom,{bottom:retailLevels.upperBottom}),courtyardBaseMaterial);upperPedestal.position.y=retailLevels.upperBottom;upperPedestal.name='Upper commercial volume meeting the unchanged arena shoulders';
const baseCap=mesh(createUpperPodiumGeometry(complexFootprints.podium,retailLevels.corniceTop-retailLevels.corniceBottom,{bottom:retailLevels.corniceBottom}),mats.white);baseCap.position.y=retailLevels.corniceBottom;baseCap.name='Continuous white commercial cornice abutting the arena capsule';
const terrace=mesh(createUpperPodiumGeometry(complexFootprints.terrace,.08,{bottom:retailLevels.roofSlabBottom}),mats.path);terrace.position.y=retailLevels.roofSlabBottom;terrace.name='Podium roof slab closed against the rounded arena';
const basePlinth=mesh(createGroundPodiumGeometry(.32),mats.base);basePlinth.name='Ground mineral plinth below the commercial volumes';
const roomInteriorTexture=createRoomInteriorTexture(brandTexture);
function makeTower(spec,shape){const group=new THREE.Group();group.name=spec.id===0?'Office 0':`Residential tower ${spec.id}`;group.position.set(spec.x,0,spec.z);group.rotation.y=spec.angle;root.add(group);let facade=mesh(extrude(shape,spec.h),mats.glass.clone(),group);facade.userData.building=spec.id;
let facadeBands;
if(spec.id===0){
 const bands=[];for(let i=0;i<=spec.floors;i++){const g=extrude(ring(shape,i===spec.floors?1.012:1.008,i===spec.floors?.82:.985),i===spec.floors?1.25:.45);g.translate(0,towerLevel(spec,i).base-(i===spec.floors?.15:.09),0);bands.push(g)}
 facadeBands=mesh(merge(bands),new THREE.MeshStandardMaterial({color:0xefeeeb,roughness:.58,metalness:.12}),group);facadeBands.name='White continuous office ribbons';
}else{
 const ribbon=createFacadeRibbonGeometry(shape,{columns:72,height:residentialFacadeSection.ribbonHeight,projection:.18,wave:.72});facadeBands=new THREE.InstancedMesh(ribbon,bandMaterial,spec.floors);
 const placement=new THREE.Matrix4();for(let i=0;i<spec.floors;i++)facadeBands.setMatrixAt(i,placement.makeTranslation(0,towerLevel(spec,i).base-.09,0));
 facadeBands.instanceMatrix.needsUpdate=true;facadeBands.castShadow=facadeBands.receiveShadow=true;facadeBands.computeBoundingSphere();group.add(facadeBands);facadeBands.name='Continuous ribbed residential ribbons with horizontal floor levels';
}
facadeBands.userData.cornerSegments=48;
const roof=mesh(extrude(scaledShape(shape,.81),.15),mats.roof,group);roof.position.y=spec.h+1.21;
let roofInset;
if(spec.id===0){roofInset=mesh(extrude(ring(shape,.59,.55),.12),mats.white,group);roofInset.position.y=spec.h+1.43;roofInset.name='Elongated office roof frame';roofInset.userData.frames=1;}
else{roofInset=createRaisedRoofCrown(shape,{whiteMaterial:mats.white,shadowMaterial:mats.roof});roofInset.position.y=spec.h+1.36;group.add(roofInset);}
const columns=spec.id===0?144:72,samples=shape.getSpacedPoints(columns),count=columns*spec.floors,floorHeight=spec.h/spec.floors;
const frameSlots=spec.id===0?1:3;
const mullions=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:spec.id===0?0xeeede9:0x30383f,metalness:spec.id===0?.18:.48,roughness:.36}),count*frameSlots);mullions.name=spec.id===0?'Close-spaced white office fins':'Recessed residential window frames and opening sashes';
const windowGeometry=new THREE.PlaneGeometry(.98,floorHeight-(spec.id===0?.41:residentialFacadeSection.windowAllowance),8,1),windowLights=createWindowLighting(windowGeometry,count,{seed:spec.id+1,columns,kind:spec.id===0?'office':'residential',brandTexture,interiorTexture:roomInteriorTexture});
windowLights.material.roughness=spec.id===0?.23:.31;windowLights.material.metalness=spec.id===0?.10:.08;
const bends=new Float32Array(count);windowGeometry.setAttribute('paneBend',new THREE.InstancedBufferAttribute(bends,1));bendPaneMaterial(windowLights.material);const windows=new THREE.InstancedMesh(windowGeometry,windowLights.material,count);
const pts=shape.getPoints(80);let signed=0;for(let i=0;i<pts.length-1;i++)signed+=pts[i].x*(-pts[i+1].y)-pts[i+1].x*(-pts[i].y);const orientation=signed>0?1:-1;
const bays=samples.slice(0,-1).map((p,j)=>{const q=samples[j+1],dx=q.x-p.x,dz=-(q.y-p.y),length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),normal=[orientation*dz/length,-orientation*dx/length],middle=shape.getPointAt((j+.5)/columns),cx=(p.x+q.x)/2,cz=-(p.y+q.y)/2,bend=(middle.x-cx)*Math.sin(angle)+(-middle.y-cz)*Math.cos(angle);return{p,length,normal,angle,middle,cx,cz,bend}});
// Preserve panoramic corner glass: opaque infill appears only on straight facade bays.
const panelIndices=spec.id===0?[]:Array.from({length:count},(_,i)=>i).filter(i=>(i%columns)%2===1&&Math.floor(i/columns)>0&&Math.abs(bays[i%columns].bend)<.009),panelSet=new Set(panelIndices);
const panelGeometry=windowGeometry.clone();panelGeometry.deleteAttribute('paneGlow');panelGeometry.deleteAttribute('paneTint');panelGeometry.deleteAttribute('shopStyle');const panelBends=new Float32Array(panelIndices.length);panelGeometry.setAttribute('paneBend',new THREE.InstancedBufferAttribute(panelBends,1));
// Instance colors supply the graphite finish; a second dark base color would multiply it to near black.
const panels=new THREE.InstancedMesh(panelGeometry,bendPaneMaterial(new THREE.MeshStandardMaterial({color:0xffffff,roughness:.84,metalness:.06})),panelIndices.length);panels.name='Opaque infill on straight bays; uninterrupted rounded corners';windowLights.setMasked(spec.id===0?panelIndices:[...panelIndices,...Array.from({length:columns},(_,i)=>i)]);
const dummy=new THREE.Object3D(),color=new THREE.Color(),windowSources=[];let n=0,panelAt=0;
for(let floor=0;floor<spec.floors;floor++)for(let j=0;j<columns;j++){
 const {p,length,normal,angle,middle,cx,cz,bend}=bays[j],level=towerLevel(spec,floor),y=level.base+level.height/2+(spec.id===0?.22:residentialFacadeSection.centerOffset);
 dummy.scale.set(spec.id===0?.13:.045,level.height-(spec.id===0?.46:residentialFacadeSection.frameAllowance),spec.id===0?.20:.08);dummy.position.set(p.x+normal[0]*.145,y,-p.y+normal[1]*.145);dummy.rotation.set(0,angle,0);if(spec.id!==0&&floor===0)dummy.scale.setScalar(0);dummy.updateMatrix();mullions.setMatrixAt(n*frameSlots,dummy.matrix);
 if(frameSlots===3){
  for(let part=1;part<=2;part++){
   const u=length*(part===1?.20:.35),paneWidth=length*.985,curveOffset=bend*(1-4*u*u/(paneWidth*paneWidth)),out=.15-orientation*curveOffset;
   dummy.position.set(cx+Math.cos(angle)*u+normal[0]*out,part===1?y:level.base+level.height*.62,cz-Math.sin(angle)*u+normal[1]*out);
   dummy.scale.set(part===1?.028:length*.28,part===1?level.height-residentialFacadeSection.frameAllowance:.035,.065);
   if(floor===0||panelSet.has(n))dummy.scale.setScalar(0);dummy.updateMatrix();mullions.setMatrixAt(n*frameSlots+part,dummy.matrix);
  }
 }
 dummy.position.set(cx+normal[0]*.11,y,cz+normal[1]*.11);dummy.scale.set(length*.985/.98,(level.height-(spec.id===0?.41:residentialFacadeSection.windowAllowance))/(floorHeight-(spec.id===0?.41:residentialFacadeSection.windowAllowance)),1);if(spec.id!==0&&floor===0)dummy.scale.setScalar(0);dummy.updateMatrix();windows.setMatrixAt(n,dummy.matrix);bends[n]=bend;
 const hash=(floor*71+j*31+spec.id*13)%17;color.set(spec.id===0?(hash<3?0xc1c1b6:hash<9?0xa5b4bd:0x899fae):(hash<3?0x9da99e:hash<9?0x8c9b91:0x7c8d84));windows.setColorAt(n,color);
 windowSources.push({index:n,x:spec.x+middle.x+normal[0]*.24,y,z:spec.z-middle.y+normal[1]*.24,nx:normal[0],nz:normal[1],masked:panelSet.has(n)||(spec.id!==0&&floor===0)});
 if(panelSet.has(n)){dummy.position.x+=normal[0]*.075;dummy.position.z+=normal[1]*.075;dummy.updateMatrix();panels.setMatrixAt(panelAt,dummy.matrix);panels.setColorAt(panelAt,new THREE.Color((j%3)===0?0x565b58:0x434b47));panelBends[panelAt]=bend;panelAt++}n++;
}
windowGeometry.attributes.paneBend.needsUpdate=true;
mullions.instanceMatrix.needsUpdate=true;windows.instanceMatrix.needsUpdate=true;windows.instanceColor.needsUpdate=true;windows.name='Resident windows';windows.receiveShadow=true;group.add(mullions,windows);if(panels.count){panels.instanceMatrix.needsUpdate=true;panels.instanceColor.needsUpdate=true;panels.receiveShadow=true;panels.castShadow=true;group.add(panels)}else{panels.geometry.dispose();panels.material.dispose()}
const belt=mesh(extrude(ring(shape,1.032,.97),.7),mats.accent.clone(),group);belt.visible=false;belt.position.y=spec.h*.2;
const foot=mesh(extrude(scaledShape(shape,1.025),.5),mats.white,group);// The old identical freestanding square panel was not present in the source courtyard.
towers.set(spec.id,{spec,group,facade,belt,shape,foot,windows,panels,panelIndices,windowLights,windowSources,facadeBands,columns,bays});animated.push(group);return group}
// Extrusion closes an open polygon implicitly, but arc-length window sampling does not.
// Explicit closure restores the last facade without changing any engineering coordinates.
for(const sourceSpec of complexFootprints.buildings){
 // Official office pitch: 3.6 m, 25 storeys. 90 m is an inferred envelope, not a surveyed roof height.
 const spec=sourceSpec.id===0?{...sourceSpec,h:sourceSpec.floors*3.6,heightSource:'https://peredelkino-offices.ru/',heightStatus:'inferred from documented storey pitch'}:sourceSpec;const shape=new THREE.Shape(spec.shape.map(([x,z])=>new THREE.Vector2(x,-z)));shape.closePath();makeTower(spec,shape);}
// Boolean-unified fan: five roof borders + smooth courtyard connections in one slab.
const bridge=mesh(createTracedFanSlabGeometry(complexFootprints.fan,2.25),mats.white);bridge.position.y=92.95;bridge.name='Unified roof entablature with five unchanged recesses and clean 4–5 seam';
const roofProfile=mesh(merge(publicRealmLayout.roofProfile.map(p=>extrude(contourShape(p),.025))),new THREE.MeshStandardMaterial({color:0x9fa9a3,roughness:.75}));roofProfile.position.y=95.201;roofProfile.name='Twin recessed grooves along unified roof fan';
const bridgeGlow=new THREE.Group();root.add(bridgeGlow);const fanGlow=mesh(createTracedFanEdgeGeometry(complexFootprints.fan.outer,93.04,.055),mats.accent,bridgeGlow);fanGlow.name='Exact traced fan light edge, including the 4–5 connection';
const fanSoffit=mesh(createTracedFanSlabGeometry(complexFootprints.fan,.04),new THREE.MeshStandardMaterial({color:0xd5d8d6,roughness:.74}));fanSoffit.position.y=92.91;fanSoffit.name='Continuous recessed dark fan soffit';
const fanEdge=mesh(createTracedFanEdgeGeometry(complexFootprints.fan.outer,95.17,.045),mats.white);fanEdge.name='Thin continuous parapet following the exact roof fan contour';
const bridgeDetails=new THREE.Group();bridgeDetails.name='Roof fan soffit, parapet and inset grooves';root.add(bridgeDetails);bridgeDetails.add(roofProfile,fanSoffit,fanEdge);
// Reference reconstruction: the rounded arena shares its glazed ground floor
// with a continuous two-storey gastro street; the traced XZ plan is unchanged.
const arenaExterior=createReferenceArena(root,{whiteMaterial:mats.white});
const {arena,arenaRoof,arenaMedia}=arenaExterior;
const commercialFrontage=createCommercialFrontage(root,{towers,whiteMaterial:mats.white,privacyMaterial:courtyardBaseMaterial,brandTexture});
const {commercialPanes,upperCommercialPanes,towerCommercialPanes,commercialUpperFrames,commercialLights,shopWindows}=commercialFrontage;
// October developer panoramas replace the former kindergarten volume with an open courtyard.
const treePositions=publicRealmLayout.matureTrees.filter(([x,z])=>!salesOfficeReserved(x,z,3));
const treeCount=treePositions.length,trunks=new THREE.InstancedMesh(branchingTrunk(.48,4),mats.bark,treeCount),crowns=new THREE.InstancedMesh(crownGeometry(2.7,5.4),mats.leaves,treeCount),t=new THREE.Object3D();treePositions.forEach(([x,z],i)=>{let sz=1+(i%5)*.1;t.position.set(x,1.8,z);t.scale.set(1,sz,1);t.updateMatrix();trunks.setMatrixAt(i,t.matrix);t.position.y=5.5*sz;t.scale.set(sz,sz*1.45,sz);t.updateMatrix();crowns.setMatrixAt(i,t.matrix)});trunks.name='Trees outside building footprints';crowns.name='Tree crowns';root.add(trunks,crowns);
const crownMatrices=crowns.instanceMatrix.array.slice(),crownMatrix=new THREE.Matrix4();
const salesOffice=createSalesOffice(root),neighborhood=createNeighborhood(root),traffic=createTraffic(root,neighborhood.transport);
const passage=createCourtyardPassage(root);const life=createComplexLife(root),courtyard=createCourtyard(root,{arenaMedia}),publicRealm=createPublicRealm(root,{commercialPanes,towers});
applyPaving(life.pathMaterial);
const terraces=createTerraces(root);const officeTerrace=createOfficeTerrace(root);
const exteriorRoofs=createExteriorRoofs(root,{whiteMaterial:mats.white});
const lighting=createNightLighting(root,{salesOffice,terraces,towers,commercialLights,courtyard,publicRealm,neighborhood,traffic,arenaMedia,bridgeGlow,bridge,pavements:[mats.path,life.pathMaterial].filter(Boolean)});
const watermarks=createModelWatermarks(root,towers,brandTexture);
const surfaceFinishes=createSurfaceFinishes(root);
const bakedAuthorship=bakeSceneAuthorship(root,{mask:brandTexture,label:'complex'});
return{officeTerrace,passage,surfaceFinishes,upperPedestal,baseCap,commercialFrontage,arenaExterior,upperCommercialPanes,salesOffice,terraces,exteriorRoofs,arenaRoof,bakedAuthorship,watermarks,treePositions,root,towers,animated,bridge,bridgeGlow,bridgeDetails,pedestal,arena,arenaMedia,arenaCenter,arenaFootprint,arenaPlacement,commercialLights,shopWindows,commercialPanes,towerCommercialPanes,commercialUpperFrames,life,publicRealm,neighborhood,traffic,courtyard,lighting,setSeason(winter,month){salesOffice.setSeason(winter,month);terraces.setSeason(winter);officeTerrace.setSeason(winter);exteriorRoofs.setSeason(winter);courtyard.setSeason(winter,month);publicRealm.setSeason(winter,month);mats.garden.color.set(winter?0xd4e0de:0x66785a);mats.leaves.color.set(winter?0x8f9385:[8,9,10].includes(month)?0xa78f48:0x4f6b49);ground.material.color.set(winter?0xd9e5e3:0x829078);for(let i=0;i<crowns.count;i++){crownMatrix.fromArray(crownMatrices,i*16).scale(new THREE.Vector3(winter?.55:1,winter?.55:1,winter?.55:1));crowns.setMatrixAt(i,crownMatrix)}crowns.instanceMatrix.needsUpdate=true},update(seconds){life.update(seconds);traffic.setEnabled(life.enabled);traffic.update(seconds);arenaMedia.update(life.time+.5);courtyard.update(life.time);publicRealm.update(life.time)},select(id,floor=null){for(const [key,t] of towers){t.facade.material.emissive.set(key===id?0x1e3930:0x000000);t.facade.material.emissiveIntensity=.6;t.belt.visible=key===id&&key!==0;t.belt.position.y=floor?towerLevel(t.spec,floor-1).base:t.spec.h*.2}},dispose(){officeTerrace.dispose();passage.dispose();surfaceFinishes.dispose();bakedAuthorship.dispose();watermarks.dispose();lighting.dispose();commercialFrontage.dispose();arenaExterior.dispose();exteriorRoofs.dispose();terraces.dispose();courtyard.dispose();publicRealm.dispose();salesOffice.dispose();neighborhood.dispose();traffic.dispose();fluteTexture.dispose();roomInteriorTexture.dispose();root.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())})}}}
