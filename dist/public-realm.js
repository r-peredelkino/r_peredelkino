import {applyPaving} from './paving-material.js?v=references37';
import {spatiallyPartitionInstances} from './spatial-instances.js?v=references37';
import {addForecourtArchitecture} from './forecourt-architecture.js?v=references37';
import {addForecourtLandscape} from './forecourt-landscape.js?v=references37';
import {addForecourtCafes} from './forecourt-cafes.js?v=references37';
import {forecourtReference} from './forecourt-reference-data.js?v=references37';
import {arenaLandscape} from './arena-landscape-data.js?v=references37';
import {addFrontageGrade,frontageGroundHeight} from './forecourt-ground.js?v=references37';
import {addPromenadeFurniture} from './promenade-furniture.js?v=references37';
import {createFoliageMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=references37';
import {salesOfficeReserved} from './sales-office.js?v=references37';
import {addRealmDetails} from './realm-details.js?v=references37';
import {crownGeometry,branchingTrunk,moundedShrubGeometry,perennialSprigGeometry} from './botanical-geometry.js?v=references37';
// @r_peredelkino · streets, retail promenade and flowing light inlays from supplied renders.
import * as THREE from './vendor/three.module.js';
import {publicRealmLayout as sourceLayout} from './public-realm-layout.js?v=references37';
import {batchStatic} from './scene-batches.js?v=references37';
import {createLightField} from './light-fields.js?v=references37';
import {createRetailSignAtlas,retailLabels} from './retail-signs.js?v=references37';
export function createPublicRealm(root,{commercialPanes,towers}){
 const clear=([x,z])=>!salesOfficeReserved(x,z,.7),clearObject=p=>!salesOfficeReserved(p.x,p.z,1.3);
 const data={...sourceLayout,islands:sourceLayout.islands.filter(p=>p.outer.every(clear)),trees:sourceLayout.trees.filter(clear),shrubs:sourceLayout.shrubs.filter(clear),flowers:sourceLayout.flowers.filter(clear),pavilions:sourceLayout.pavilions.filter(clearObject),cafes:sourceLayout.cafes.filter(clearObject),lamps:sourceLayout.lamps.filter(clearObject),benches:sourceLayout.benches.filter(p=>p.points.every(clear)),lightLines:sourceLayout.lightLines.filter(p=>p.points.every(clear))};
 // Replace only legacy guesses in the newly traced arena frontage. The new
 // contours already passed pedestrian-surface and building-clearance checks.
 const inRing=(x,z,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const insideArena=(x,z)=>arenaLandscape.replacementZones.some(p=>inRing(x,z,p.outer)&&!(p.holes??[]).some(h=>inRing(x,z,h)));
 // GPU B exposed three narrow legacy bench/planter wedges just outside the
 // source polygon's retained curb. They are absent from the arena source.
 const legacyArenaBenchIslands=new Set(['frontage-6-0','frontage-7-0','frontage-8-0']);
 const replacedIslands=data.islands.filter(p=>legacyArenaBenchIslands.has(p.id)||insideArena(p.outer.reduce((s,q)=>s+q[0],0)/p.outer.length,p.outer.reduce((s,q)=>s+q[1],0)/p.outer.length));
 const replacedPlant=(x,z)=>insideArena(x,z)||replacedIslands.some(p=>inRing(x,z,p.outer));
 data.islands=data.islands.filter(p=>!replacedIslands.includes(p));for(const key of ['trees','shrubs','flowers'])data[key]=data[key].filter(([x,z])=>!replacedPlant(x,z));
 for(const key of ['pavilions','lamps'])data[key]=data[key].filter(p=>!insideArena(p.x,p.z));
 // Replace the adjacent guessed cafe in place. This also keeps the other
 // cafes' decoration parity stable in the legacy furniture renderer.
 let sourceCafeInserted=false;
 data.cafes=data.cafes.flatMap(p=>{if(p.id==='frontage-cafe-6'){sourceCafeInserted=true;return arenaLandscape.cafes;}return insideArena(p.x,p.z)?[]:[p];});
 if(!sourceCafeInserted)data.cafes.push(...arenaLandscape.cafes);
 data.benches=data.benches.filter(p=>!legacyArenaBenchIslands.has(p.island)&&!p.points.some(([x,z])=>insideArena(x,z)));
 data.lightLines=data.lightLines.flatMap(line=>{const parts=[];let points=[];for(const q of line.points){if(insideArena(...q)){if(points.length>1)parts.push({...line,points});points=[];}else points.push(q);}if(points.length>1)parts.push({...line,points});return parts;});
 data.lamps.push(...arenaLandscape.lamps);
 data.arenaRevision={source:arenaLandscape.source,replacedIslandCount:replacedIslands.length,tracedIslands:arenaLandscape.islands.length,removedLegacyCafeIds:['frontage-cafe-6'],removedLegacyBenchIslandIds:[...legacyArenaBenchIslands]};
 const group=new THREE.Group();group.name='Retail promenade, planted streets and zigzag light inlays';root.add(group);
 const materials={soil:new THREE.MeshStandardMaterial({color:0x657456,roughness:1}),shrub:createFoliageMaterial(0x557148),leaf:createFoliageMaterial(0x638057),evergreen:createFoliageMaterial(0x34564c,{evergreen:true}),bark:new THREE.MeshStandardMaterial({color:0x73624e,roughness:1}),flower:new THREE.MeshStandardMaterial({color:0xdddcc7,roughness:1}),bronze:new THREE.MeshStandardMaterial({color:0x665a46,metalness:.55,roughness:.4}),wood:new THREE.MeshStandardMaterial({color:0x907457,roughness:.8}),white:new THREE.MeshStandardMaterial({color:0xeee7d9,roughness:.65}),dark:new THREE.MeshStandardMaterial({color:0x29373c,roughness:.4}),warm:new THREE.MeshStandardMaterial({color:0xded5b5,emissive:0xffdca8,roughness:.35}),pink:new THREE.MeshStandardMaterial({color:0xc0bdc9,emissive:0xbc2bf5,roughness:.35}),cyan:new THREE.MeshStandardMaterial({color:0xb7cbcc,emissive:0x05b9e4,roughness:.35}),glass:new THREE.MeshStandardMaterial({color:0xa9c1c1,transparent:true,opacity:.22,roughness:.16,metalness:.28,depthWrite:false})};
 materials.shrub.color.set(0x4e6942);materials.flower.color.set(0xffffff);materials.flower.side=THREE.DoubleSide;
 // The legacy boat-planter meshes have no color attribute. Keep their shared
 // materials conventional; use vertex-colour clones only for rooted botany.
 materials.shrub.vertexColors=false;materials.flower.vertexColors=false;
 materials.rootedShrub=materials.shrub.clone();materials.rootedShrub.vertexColors=true;
 materials.rootedFlower=materials.flower.clone();materials.rootedFlower.vertexColors=true;
 const mesh=(g,m)=>{const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;group.add(o);return o};function box(w,h,d,x,y,z,m,angle=0){const o=mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.rotation.y=angle;return o}
 function shape(contour){const s=new THREE.Shape(contour.outer.map(([x,z])=>new THREE.Vector2(x,-z)));for(const h of contour.holes||[])s.holes.push(new THREE.Path(h.map(([x,z])=>new THREE.Vector2(x,-z))));return s}
 function slab(s,y,height,m){const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:20});g.rotateX(-Math.PI/2);const o=mesh(g,m);o.position.y=y;return o}
 const ellipse=(rx,rz)=>{const s=new THREE.Shape();s.absellipse(0,0,rx,rz,0,Math.PI*2,false,0);return s};const tube=(pts,r,m)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,false,'centripetal'),Math.min(240,pts.length*2),r,5,false),m);
 // Broad continuous mineral paving, reaching the frontage curb seen in main.webp.
 const pavingMaterial=new THREE.MeshStandardMaterial({color:0xc4c5c0,roughness:.9,metalness:.02});
 applyPaving(pavingMaterial);
 for(const contour of data.promenadeParts??[data.promenade]){const paving=slab(shape(contour),-.08,.067,pavingMaterial);paving.name='Road-clipped shopfront promenade and reference forecourt';}addFrontageGrade(group,pavingMaterial);
 const architecture=addForecourtArchitecture(group,{materials,layout:forecourtReference.architecture});
 const combinedLandscape={...forecourtReference.landscape,source:forecourtReference.source};
 for(const key of ['islands','lines','trees','benches','planters','pebbles','mediaColumns'])combinedLandscape[key]=[...(forecourtReference.landscape[key]??[]),...(arenaLandscape[key]??[])];
 const landscape=addForecourtLandscape(group,{materials,layout:combinedLandscape,groundHeight:frontageGroundHeight});
 landscape.metadata.arenaSource=arenaLandscape.source;
 // v33: the nominal image registration placed all three cafe-5 tables
 // inside the architectural podium. Translate this single intact furniture
 // group by the minimum tested offset that clears the new corridor and slab.
 // The original traced data/image bytes are retained; this is an inferred
 // registration correction, not a claim of exact surveyed furniture locations.
 const cafe5Offset=[-.5151517082332822,-4.62164675386429],shift=p=>[p[0]+cafe5Offset[0],p[1]+cafe5Offset[1]];
 const registeredCafes=forecourtReference.cafes.cafes.map(c=>c.id!=='single-cafe-5'?c:{...c,roofs:c.roofs.map(r=>({...r,outer:r.outer.map(shift),center:shift(r.center)})),tables:c.tables.map(t=>({...t,center:shift(t.center)})),chairs:c.chairs.map(t=>({...t,center:shift(t.center)})),registrationCorrection:{revision:33,offset:cafe5Offset,reason:'Keep the same cafe group outside the fixed podium and K1–K2 opening',status:'estimated 4.65-model-unit registration correction'}});
 const cafes=addForecourtCafes(group,{layout:{...forecourtReference.cafes,cafes:registeredCafes,source:forecourtReference.source}});
 cafes.metadata.passageRegistration={cafeId:'single-cafe-5',offset:cafe5Offset,sourceAnchorsUnchanged:true,placementStatus:'estimated correction to the existing architectural registration'};
 const forecourt={architecture,landscape,cafes,reference:forecourtReference};
 const pavilion=architecture.metadata.pavilion;
 const plazaProgram={...architecture,layout:{cube:{...pavilion,angle:0}},replacePavilionIds:['office-plaza','front-lounge']};
 const furnishingColliders=[...architecture.colliders,...landscape.colliders,...cafes.colliders];
 const solids=[...architecture.solids,...landscape.solids,...(cafes.solids??[])];
 for(const points of data.curbParts??[data.curb])for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);box(length,.2,.22,(a[0]+b[0])/2,-.06,(a[1]+b[1])/2,materials.white,-Math.atan2(dz,dx))}
 for(let i=1;i<forecourtReference.frontageCurb.length;i++){const a=forecourtReference.frontageCurb[i-1],b=forecourtReference.frontageCurb[i],dx=b[0]-a[0],dz=b[1]-a[1];box(Math.hypot(dx,dz),.20,.18,(a[0]+b[0])/2,-.50,(a[1]+b[1])/2,materials.white,-Math.atan2(dz,dx));}
 for(const island of data.islands)slab(shape(island),-.09,.10,materials.soil);
 for(const island of data.islands){const pts=island.outer.map(([x,z])=>new THREE.Vector3(x,.043,z));tube(pts,.032,materials.white)}
 // The curved stone edge and timber seat follow their own planting island.
 for(const b of data.benches){slab(shape(b.seat),.06,.34,materials.white);slab(shape(b.seat),.4,.10,materials.wood);const pts=b.points.map(([x,z])=>new THREE.Vector3(x,.84,z));tube(pts,.04,materials.bronze);for(let i=0;i<b.points.length;i+=4){const [x,z]=b.points[i];box(.05,.38,.05,x,.47,z,materials.bronze)}for(let i=0;i<b.points.length-1;i++)furnishingColliders.push({type:'segment',a:b.points[i],b:b.points[i+1],radius:.35})}
 // Small square/rectangular shade pavilions distinguish the forecourt and forest lounges.
 for(const p of data.pavilions.filter(p=>!plazaProgram.replacePavilionIds.includes(p.id))){const co=Math.cos(p.angle),si=Math.sin(p.angle),world=(x,z)=>[p.x+co*x+si*z,p.z-si*x+co*z];
  box(p.width,.06,p.depth,p.x,0,p.z,materials.wood,p.angle);box(p.width+.25,.21,p.depth+.25,p.x,3.08,p.z,materials.white,p.angle);
  for(const x of [-p.width/2+.2,p.width/2-.2])for(const z of [-p.depth/2+.2,p.depth/2-.2]){const q=world(x,z);box(.09,3.02,.09,q[0],.06,q[1],materials.bronze,p.angle);furnishingColliders.push({type:'circle',x:q[0],z:q[1],radius:.09})}
  for(let i=0;i<Math.floor(p.width/.24);i++){const q=world(-p.width/2+.12+i*.24,0);box(.10,.09,p.depth-.2,q[0],3.0,q[1],materials.wood,p.angle)}
  for(const side of [-1,1]){const q=world(0,side*(p.depth/2-.5));box(p.width-1,.35,.65,q[0],.08,q[1],materials.white,p.angle);box(p.width-1,.08,.68,q[0],.43,q[1],materials.wood,p.angle);furnishingColliders.push({type:'box',x:q[0],z:q[1],width:p.width-1,depth:.68,angle:p.angle})}
  const table=slab(ellipse(.9,.66),.75,.07,materials.white);table.position.x=p.x;table.position.z=p.z;table.rotation.y=p.angle;box(.13,.68,.13,p.x,.07,p.z,materials.bronze);furnishingColliders.push({type:'circle',x:p.x,z:p.z,radius:.92});
  for(const side of [-1,1]){const q=world(0,side*(p.depth/2-.15));box(p.width-.3,.04,.06,q[0],3.035,q[1],materials.warm,p.angle)}
 }
 for(const p of data.lamps){const h=p.height??3.16,w=p.tracedWhite?.045:.07;box(w,h,w,p.x,0,p.z,p.tracedWhite?materials.white:materials.dark);box(p.tracedWhite?.42:.78,.055,p.tracedWhite?.11:.24,p.x,h,p.z,materials.white);box(p.tracedWhite?.34:.66,.026,p.tracedWhite?.075:.17,p.x,h-.018,p.z,materials.warm);furnishingColliders.push({type:'circle',x:p.x,z:p.z,radius:.08})}
 const dummy=new THREE.Object3D();function instances(g,m,points,position){const o=new THREE.InstancedMesh(g,m,points.length);points.forEach((p,i)=>{position(dummy,p,i);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix)});o.instanceMatrix.needsUpdate=true;o.castShadow=true;o.receiveShadow=true;group.add(o);return o}
 const shrubs=instances(moundedShrubGeometry(.62,.70),materials.rootedShrub,data.shrubs,(d,[x,z,s],i)=>{d.position.set(x,.012,z);d.rotation.set(0,i*2.399963,0);d.scale.set(s*1.18,s*.77,s*1.06)});shrubs.name='Rooted organic planting across the retained promenade islands';
 const legacyFlowers=instances(perennialSprigGeometry(0xe6e3d3),materials.rootedFlower,data.flowers,(d,[x,z,c],i)=>{d.position.set(x,.014,z);d.rotation.set(0,i*2.399963,0);d.scale.set(.78+(c%4)*.055,.55+(i%5)*.055,.78+(c%4)*.055)});legacyFlowers.name='Fine perennial flowers on stems across the retained promenade islands';
 legacyFlowers.castShadow=false;
 instances(branchingTrunk(.25,4.2),materials.bark,data.trees,(d,[x,z,s])=>{d.position.set(x,2*s,z);d.scale.set(s,s,s)});
 const deciduous=data.trees.filter((_,i)=>i%4!==0),conifers=data.trees.filter((_,i)=>i%4===0);
 const leaves=instances(crownGeometry(1.8,3.3),materials.leaf,deciduous.flatMap(p=>[p,p,p]),(d,[x,z,s],i)=>{const a=i%3*2.4;d.position.set(x+Math.sin(a)*.7*s,(4.7+(i%3)*.42)*s,z+Math.cos(a)*.7*s);d.scale.set(s,s*1.15,s)});
 instances(crownGeometry(1.55,4.5,true),materials.evergreen,conifers,(d,[x,z,s])=>{d.position.set(x,4.1*s,z);d.scale.set(s,s,s)});
 const cafeColliders=furnishingColliders,promenadeFurniture=addPromenadeFurniture(group,materials,data);cafeColliders.push(...promenadeFurniture.colliders);
 // Continuous bands are physical inlays in the paving; glowing spill is a separate soft field.
 const spillSamples=[];for(const line of data.lightLines){const positions=[],normals=[],uv=[];for(let i=0;i<line.points.length-1;i++){const a=line.points[i],b=line.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const nx=-dz/len*.037,nz=dx/len*.037;const corners=[[a[0]+nx,.035,a[1]+nz],[a[0]-nx,.035,a[1]-nz],[b[0]+nx,.035,b[1]+nz],[b[0]-nx,.035,b[1]-nz]];for(const k of [0,2,1,1,2,3]){positions.push(...corners[k]);normals.push(0,1,0);uv.push(k%2,i*.1)}if(i%5===0)spillSamples.push({x:a[0],z:a[1],angle:Math.atan2(dx,dz),color:line.color})}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const o=mesh(g,materials[line.color]);o.castShadow=false}
 const field=createLightField(group,spillSamples.length,{color:0xca92f0});spillSamples.forEach((p,i)=>field.set(i,p.x,.045,p.z,.28,1.5,p.angle,new THREE.Color(p.color==='warm'?0xffd6a4:p.color==='cyan'?0x72d9e8:0xce95f8),.23));field.commit();
 // Physical shopfront frames and both commercial storeys are supplied by commercial-frontage.js.
 const leafMatrices=leaves.instanceMatrix.array.slice(),seasonMatrix=new THREE.Matrix4();
 const signPanes=[];for(const p of commercialPanes){if(p.officeLobby||p.length<5.7||signPanes.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<12))continue;signPanes.push(p)}
 const gallery=forecourtReference.architecture.gallery;
 if(gallery?.signs?.length){
  const nearGallery=p=>gallery.frontEdge.some(([x,z])=>Math.hypot(p.x-x,p.z-z)<3.3);
  for(let i=signPanes.length-1;i>=0;i--)if(nearGallery(signPanes[i]))signPanes.splice(i,1);
  signPanes.push(...gallery.signs);
 }
 const atlas=createRetailSignAtlas(),signMaterial=new THREE.MeshStandardMaterial({color:0xffffff,map:atlas,emissive:0xffedc4,emissiveMap:atlas,emissiveIntensity:0,alphaTest:.22,roughness:.4,side:THREE.DoubleSide});const sg=new THREE.PlaneGeometry(1,1);sg.setAttribute('retailStyle',new THREE.InstancedBufferAttribute(Float32Array.from({length:signPanes.length},(_,i)=>signPanes[i].labelIndex??i%retailLabels.length),1));signMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float retailStyle;\nvarying vec2 vRetailUV;').replace('#include <begin_vertex>',`#include <begin_vertex>\nvRetailUV=vec2((clamp(uv.x,.01,.99)+retailStyle)*${1/retailLabels.length},uv.y);`);s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRetailUV;').replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor *= texture2D(map,vRetailUV);\n#endif').replace('#include <emissivemap_fragment>','#ifdef USE_EMISSIVEMAP\ntotalEmissiveRadiance *= texture2D(emissiveMap,vRetailUV).rgb;\n#endif')};signMaterial.customProgramCacheKey=()=> 'retail-lettering-v25-'+retailLabels.length;const signs=new THREE.InstancedMesh(sg,signMaterial,signPanes.length);signs.name='Six restaurant and cafe names on the white commercial fascia';signPanes.forEach((p,i)=>{dummy.position.set(p.x+p.nx*.045,p.signY??3.55,p.z+p.nz*.045);dummy.rotation.set(0,Math.atan2(p.nx,p.nz),0);dummy.scale.set(p.width&&p.gallerySign?p.width:6.8,.92,1);dummy.updateMatrix();signs.setMatrixAt(i,dummy.matrix)});signs.instanceMatrix.needsUpdate=true;group.add(signs);
 const entrances=[]; // The traced white office gallery replaces the former guessed oval canopy.
 instances(new THREE.BoxGeometry(1,3.15,.065),materials.glass,commercialPanes.filter(p=>p.officeLobby),(d,p)=>{d.position.set(p.x,1.755,p.z);d.rotation.set(0,p.angle,0);d.scale.set(p.width,1,1)});for(const p of commercialPanes.filter(p=>p.officeLobby)){const cx=p.x-p.nx*.5,cz=p.z-p.nz*.5;box(p.width,.12,2.0,cx,.03,cz,materials.white,p.angle);box(p.width,.08,1.5,cx,3.0,cz,materials.white,p.angle);box(p.width*.8,.027,.04,cx,2.96,cz,materials.warm,p.angle);}

 const closeDetails=addRealmDetails(group,{materials,data:{...data,pavilions:data.pavilions.filter(p=>!plazaProgram.replacePavilionIds.includes(p.id))},towers,colliders:cafeColliders});
 const spatialInstances=[shrubs,legacyFlowers,leaves,promenadeFurniture.meadow].map(mesh=>spatiallyPartitionInstances(mesh,{cellSize:20}));
 batchStatic(group);
 function setNight(n){materials.warm.emissiveIntensity=n*4.2;materials.pink.emissiveIntensity=n*3.5;materials.cyan.emissiveIntensity=n*3.5;signMaterial.emissiveIntensity=n*1.8;field.strength.value=n;architecture.setNight(n);landscape.setNight(n);cafes.setNight?.(n)}
 const lamps=[...data.lamps.map(p=>({...p,y:p.y??3.14})),...architecture.lamps];
 setNight(0);
 return{group,closeDetails,plazaProgram,forecourt,promenadeFurniture,data,field,leaves,spatialInstances,signs,signPanes,entrances,retailLabels,lamps,pavingMaterial,colliders:cafeColliders,solids,treePositions:data.trees,
  update(t){field.clock.value=t;architecture.update(t);landscape.update(t);cafes.update?.(t)},
  setNight,
  setWetness(wet){materials.wood.roughness=wet?.48:.8;materials.white.roughness=wet?.4:.65;pavingMaterial.roughness=wet?.43:.9;pavingMaterial.metalness=wet?.14:.02;field.wetness.value=Number(wet);architecture.setWetness(wet);landscape.setWetness(wet);cafes.setWetness(wet)},
  setSeason(winter,month){promenadeFurniture.setSeason(winter);architecture.setSeason(winter,month);landscape.setSeason(winter,month);cafes.setSeason(winter,month);materials.soil.color.set(winter?0xd8e0d7:0x657456);materials.leaf.color.set(winter?0x919789:[8,9,10].includes(month)?0xab9561:0x638057);for(let i=0;i<leaves.count;i++){seasonMatrix.fromArray(leafMatrices,i*16).scale(new THREE.Vector3(winter?.4:1,winter?.4:1,winter?.4:1));leaves.setMatrixAt(i,seasonMatrix)}leaves.instanceMatrix.needsUpdate=true;materials.flower.color.set(winter?0xd9e2df:0xffffff);legacyFlowers.visible=!winter;for(const batch of spatialInstances)batch.sync()},
  dispose(){architecture.dispose();landscape.dispose();cafes.dispose();field.dispose();root.remove(group);atlas.dispose();for(const batch of spatialInstances)batch.dispose();const geometries=new Set(),otherMaterials=new Set(),owned=new Set(Object.values(materials));group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();if(o.material)for(const mat of [o.material].flat())if(!owned.has(mat))otherMaterials.add(mat)});geometries.forEach(g=>g.dispose());disposeOwnedMaterials(materials);otherMaterials.forEach(mat=>mat.dispose())}
 };
}
