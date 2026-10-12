// @r_peredelkino · exterior revision from the supplied 8 October 2026 panoramas.
// Equipment dimensions and placement are visual estimates; the traced footprints stay authoritative.
import * as THREE from './vendor/three.module.js';
import {complexFootprints as footprint} from './complex-footprints.js?v=references37';
import {insideRing,segmentDistance} from './walk-physics.js?v=references37';
import {batchStatic} from './scene-batches.js?v=references37';
import {attribution} from './attribution.js?v=references37';
import {retailLevels} from './frontage-zones.js?v=references37';
import {officeTerraceReserved} from './office-terrace-v33.js?v=references37';
import {inArenaUpperRelief,segmentsOutsideArenaRelief,createUpperPodiumSurfaceGeometry} from './podium-upper-cut.js?v=references37';
import {createArenaServiceEquipment} from './arena-service-equipment.js?v=references37';
import {arenaFootprint} from './arena-placement-v35.js?v=references37';

// Keep gravel above the shared two-storey podium slab and below the separately
// furnished terrace tiles. All three systems use the same model datum.
const roofLevel=retailLevels.roof+.008;
const buildingRings=footprint.buildings.map(b=>b.shape.map(([x,z])=>[b.x+x,b.z+z]));
const distanceToRing=(x,z,ring)=>ring.reduce((d,p,i)=>Math.min(d,segmentDistance(x,z,p,ring[(i+1)%ring.length])),Infinity);
const railPaths=footprint.terraces.flatMap(t=>t.rails);
const nearGlassRail=(x,z)=>railPaths.some(path=>path.some((p,i)=>i&&segmentDistance(x,z,path[i-1],p)<.55));

// Service equipment belongs to the unoccupied roof, outside balconies and their walking routes.
export function serviceRoofContains(x,z,margin=.55){
 if(inArenaUpperRelief(x,z,margin)||officeTerraceReserved(x,z,margin))return false;
 if(!insideRing(x,z,footprint.podium.outer)||distanceToRing(x,z,footprint.podium.outer)<margin)return false;
 if(footprint.podium.holes.some(h=>insideRing(x,z,h)||distanceToRing(x,z,h)<margin))return false;
 if(buildingRings.some(r=>insideRing(x,z,r)||distanceToRing(x,z,r)<margin))return false;
 if(insideRing(x,z,arenaFootprint.outer)||distanceToRing(x,z,arenaFootprint.outer)<margin)return false;
 return !footprint.terraces.some(t=>insideRing(x,z,t.outer)||distanceToRing(x,z,t.outer)<margin);
}

function gravelTexture(){
 const size=128,pixels=new Uint8Array(size*size*4);let seed=23911;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // The source roof is a pale warm mineral surface. Store the albedo in this
 // map once; multiplying a dark map by another grey diffuse colour caused
 // the blue-grey slab in v30. Stone positions and the base mesh stay fixed.
 const stones=Array.from({length:480},()=>({x:rand()*size,y:rand()*size,r:.7+rand()*1.8,tone:174+rand()*42}));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let v=181+rand()*20;
  for(const s of stones){let dx=Math.abs(x-s.x),dy=Math.abs(y-s.y);dx=Math.min(dx,size-dx);dy=Math.min(dy,size-dy);const d=Math.hypot(dx,dy);if(d<s.r){v=s.tone*(.83+.17*(1-d/s.r));break;}}
  const i=(y*size+x)*4;pixels.set([Math.round(v),Math.round(v*.985),Math.round(v*.94),255],i);
 }
 const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
 texture.name='Fine mineral gravel · roof surfaces';texture.userData.attribution={...attribution};texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.5,1.5);
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 return texture;
}

// One radial profile preserves the circular engineering footprint while rounding the crown.
// Split strips keep the two recessed step joints crisp instead of smoothing the entire roof.
export function createArenaCrownGeometry(radius){
 const profile=[[radius,7.1],[radius+.22,7.18],[radius+.22,7.74],[radius+.15,7.84],
  [radius*.944,7.84],[radius*.944,8.05],[radius*.939,8.11],
  [radius*.811,8.11],[radius*.811,8.26],[radius*.806,8.32],
  [radius*.74,8.41],[radius*.66,8.52],[radius*.42,8.61],[radius*.18,8.65],[0,8.66]];
 const segments=192,positions=[],normals=[],uvs=[],indices=[];
 for(let strip=0;strip<profile.length-1;strip++){
  const [r0,y0]=profile[strip],[r1,y1]=profile[strip+1],dr=r1-r0,dy=y1-y0,len=Math.hypot(dr,dy),offset=positions.length/3;
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2,cos=Math.cos(a),sin=Math.sin(a);
   for(const [r,y] of [[r0,y0],[r1,y1]]){positions.push(r*cos,y,r*sin);normals.push(dy/len*cos,-dr/len,dy/len*sin);uvs.push(r*cos,r*sin);}
   if(i<segments){const v=offset+i*2;indices.push(v,v+1,v+2);if(r1>0)indices.push(v+2,v+1,v+3);}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.roofProfile={steps:3,subtleCrown:true,ringRadii:[.944,.811],source:'2026-10-11 arena panorama',sectionStatus:'Top ring diameter measured at approximately .80 of the outer roof in source projection; outer footprint and heights preserved'};
 return geometry;
}

export function createExteriorRoofs(root,{whiteMaterial}){
 const group=new THREE.Group();group.name='Service roofs · mineral gravel, parapets and ventilation';root.add(group);
 const texture=gravelTexture();
 const materials={
  gravel:new THREE.MeshStandardMaterial({color:0xffffff,map:texture,bumpMap:texture,bumpScale:.014,roughness:.98}),
  metal:new THREE.MeshStandardMaterial({color:0x606d72,roughness:.66,metalness:.35}),
  dark:new THREE.MeshStandardMaterial({color:0x303b42,roughness:.73,metalness:.26}),
  white:whiteMaterial
 };
 const add=(geometry,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);return m;};
 const box=(w,h,d,x,y,z,material,angle=0)=>{const m=add(new THREE.BoxGeometry(w,h,d),material,x,y+h/2,z);m.rotation.y=angle;return m;};
 const gravelGeometry=createUpperPodiumSurfaceGeometry(footprint.terrace,{y:roofLevel});
 const surface=add(gravelGeometry,materials.gravel,0,roofLevel,0);surface.name='Exposed gravel roof under the separate furnished terraces';

 let parapetSegments=0;
 for(const contour of [footprint.podium.outer,...footprint.podium.holes]){
  for(let i=0;i<contour.length;i++){
   for(const [p,q] of segmentsOutsideArenaRelief(contour[i],contour[(i+1)%contour.length],0,{bottom:roofLevel,top:roofLevel+.465})){
    const dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);
    if(length<.025)continue;const x=(p[0]+q[0])/2,z=(p[1]+q[1])/2;
    if(nearGlassRail(x,z)||buildingRings.some(r=>insideRing(x,z,r)||distanceToRing(x,z,r)<.34)||distanceToRing(x,z,arenaFootprint.outer)<.7)continue;
    const angle=-Math.atan2(dz,dx);
    box(length+.015,.42,.23,x,roofLevel,z,materials.white,angle);
    box(length+.025,.045,.28,x,roofLevel+.42,z,materials.metal,angle);parapetSegments++;
   }
  }
 }

 const equipmentClusters=[];
 const candidates=[{x:20,z:-73,angle:0},{x:-32,z:-50,angle:-.68},
  {x:-25,z:45,angle:.72},{x:25,z:73,angle:0},{x:65,z:-80,angle:.75}];
 const halfWidth=3.6,halfDepth=2.7;
 const toWorld=(x,z,angle,u,v)=>[x+Math.cos(angle)*u+Math.sin(angle)*v,z-Math.sin(angle)*u+Math.cos(angle)*v];
 const safeFootprint=(x,z,angle)=>[-halfWidth,0,halfWidth].every(u=>[-halfDepth,0,halfDepth].every(v=>serviceRoofContains(...toWorld(x,z,angle,u,v))));
 for(const candidate of candidates){
  let spot=null;
  for(let r=0;r<=4&&!spot;r+=.5)for(let i=0;i<(r?16:1);i++){
   const a=i/16*Math.PI*2,x=candidate.x+Math.cos(a)*r,z=candidate.z+Math.sin(a)*r;
   if(safeFootprint(x,z,candidate.angle)){spot={...candidate,x,z};break;}
  }
  if(!spot)continue;
  const {x,z,angle}=spot,at=(u,v)=>toWorld(x,z,angle,u,v);
  const B=(w,h,d,u,y,v,material)=>{const p=at(u,v);return box(w,h,d,p[0],roofLevel+y,p[1],material,angle);};
  // Independent rails keep the air-handling casing clear of the gravel.
  for(const v of [-.64,.64])B(4.5,.16,.13,0,.04,v,materials.dark);
  B(4.4,1.23,1.72,0,.20,0,materials.metal);B(4.52,.075,1.83,0,1.43,0,materials.metal);
  for(const u of [-1.1,0,1.1])B(.026,1.15,.014,u,.24,.867,materials.dark);
  for(let i=0;i<9;i++)B(1.12,.032,.026,-1.30,.40+i*.093,.887,materials.dark);
  B(1.45,.60,1.05,-2.78,.43,0,materials.metal);B(.79,.60,2.05,-3.08,.43,1.0,materials.metal);
  // Circular fan face with a recessed centre, rim and six blades.
  const fan=at(.85,.92),fanGeometry=new THREE.CylinderGeometry(.45,.45,.12,32);fanGeometry.rotateX(Math.PI/2);
  add(fanGeometry,materials.dark,fan[0],roofLevel+.90,fan[1]).rotation.y=angle;
  const rimGeometry=new THREE.TorusGeometry(.44,.035,6,32);add(rimGeometry,materials.metal,fan[0],roofLevel+.90,fan[1]).rotation.y=angle;
  for(let i=0;i<6;i++){
   const a=i/6*Math.PI*2,u=.85+Math.cos(a)*.21,y=.90+Math.sin(a)*.21,p=at(u,.996);
   const blade=add(new THREE.BoxGeometry(.29,.085,.025),materials.metal,p[0],roofLevel+y,p[1]);blade.rotation.set(0,angle,a+.25);
  }
  B(1.42,.75,1.04,.8,.14,1.95,materials.metal);
  for(const u of [.40,1.18]){
   const p=at(u,1.95);add(new THREE.CylinderGeometry(.16,.16,.46,16),materials.metal,p[0],roofLevel+1.09,p[1]);
   add(new THREE.CylinderGeometry(.25,.25,.055,20),materials.dark,p[0],roofLevel+1.34,p[1]);
  }
  equipmentClusters.push({...spot,width:halfWidth*2,depth:halfDepth*2,base:roofLevel,height:1.52,
   footprint:[[-halfWidth,-halfDepth],[halfWidth,-halfDepth],[halfWidth,halfDepth],[-halfWidth,halfDepth]].map(p=>at(...p))});
 }
 const arenaService=createArenaServiceEquipment({materials,roofLevel,serviceRoofContains});
 group.add(...arenaService.meshes);equipmentClusters.push(arenaService.metadata);
 batchStatic(group);
 for(const child of group.children)if(child.material===materials.gravel)child.name=surface.name;
 group.userData.reference={date:'2026-10-08',frames:['21.59.57','22.01.42','22.03.17'],placement:'estimated inside unoccupied roof area'};
 group.userData.roofRevision={equipmentClusters:equipmentClusters.length,parapetSegments,roofLevel,arenaService:arenaService.metadata};
 return{group,materials,equipmentClusters,arenaService:arenaService.metadata,roofLevel,parapetSegments,
  setSeason(winter){const nextMap=winter?null:texture;if(materials.gravel.map!==nextMap){materials.gravel.map=nextMap;materials.gravel.needsUpdate=true;}materials.gravel.color.set(winter?0xf0f2ed:0xffffff);materials.gravel.bumpScale=winter?.006:.014;},
  dispose(){texture.dispose();group.traverse(o=>o.geometry?.dispose());for(const [name,m] of Object.entries(materials))if(name!=='white')m.dispose();root.remove(group);}
 };
}
