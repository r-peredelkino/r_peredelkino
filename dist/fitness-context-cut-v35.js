// @r_peredelkino · RP-CONCEPT-2026-10-07
// A showroom-only section through office 0. The exterior model, its materials,
// source footprints and the neighbouring occupied podium remain unchanged.
import * as T from './vendor/three.module.js';
import polygonClipping from './vendor/polygon-clipping.module.js';
import {complexFootprints as f} from './complex-footprints.js?v=community38';
import {arenaCenter,arenaGroundRadius} from './arena-placement-v35.js?v=community38';
import {retailLevels} from './frontage-zones.js?v=community38';
import {courtyardPassage,passageGroundSolids} from './courtyard-passage.js?v=community38';
import {createUpperPodiumGeometry,createUpperPodiumSurfaceGeometry} from './podium-upper-cut.js?v=community38';
import {smoothWallNormals} from './facade-detail.js?v=community38';
import {stampGeometry} from './baked-authorship.js?v=community38';
import {insideRing,segmentDistance} from './walk-physics.js?v=community38';

const closed=r=>Math.hypot(r[0][0]-r.at(-1)[0],r[0][1]-r.at(-1)[1])<1e-8?r:[...r,r[0]];
const polygon=d=>[closed(d.outer),...(d.holes||[]).map(closed)];
const shapeFrom=rings=>({outer:rings[0].slice(0,-1),holes:rings.slice(1).map(h=>h.slice(0,-1))});
function merge(gs){
 const expanded=gs.map(g=>g.index?g.toNonIndexed():g),out=new T.BufferGeometry();
 for(const [key,size] of [['position',3],['normal',3],['uv',2]]){
  const values=new Float32Array(expanded.reduce((n,g)=>n+g.attributes[key].array.length,0));let at=0;
  for(const g of expanded){values.set(g.attributes[key].array,at);at+=g.attributes[key].array.length;}out.setAttribute(key,new T.BufferAttribute(values,size));
 }
 expanded.forEach((g,i)=>{if(g!==gs[i])g.dispose();gs[i].dispose();});out.computeBoundingBox();out.computeBoundingSphere();return out;
}
function extrude(data,depth,base=0){
 const s=new T.Shape(data.outer.map(([x,z])=>new T.Vector2(x,-z)));
 for(const h of data.holes||[])s.holes.push(new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));
 const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,base,0);return smoothWallNormals(g);
}

export function applyFitnessContextCut(clone,{model,spec=model?.towers?.get(0)?.spec,ownedGeometries}={}){
 if(!clone||!spec?.shape)throw new TypeError('Fitness context cut requires a cloned model and office-0 source contour');
 if(clone===model?.root)throw new TypeError('A fitness section must never be applied to the original exterior model');
 const ring=spec.shape.map(([x,z])=>[spec.x+x,spec.z+z]),bounds=[Math.min(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[1]))],officePolygon=[closed(ring)],owned=new Set(),replacements=[],filtered=[],hiddenInstances=[];
 const outsideOffice=data=>polygonClipping.difference(polygon(data),officePolygon).map(shapeFrom);
 const podiumPlans=outsideOffice(f.podium),terracePlans=outsideOffice(f.terrace),roofY=retailLevels.roof+.008;
 const sourceCircle=Array.from({length:192},(_,i)=>{const a=i/192*Math.PI*2;return[arenaCenter[0]+Math.cos(a)*arenaGroundRadius,arenaCenter[1]+Math.sin(a)*arenaGroundRadius];});
 const fasciaPlans=polygonClipping.difference(polygonClipping.union(polygon(f.podium),[closed(sourceCircle)]),officePolygon).map(shapeFrom);
 const volumeBuilders=new Map([
  ['Ground mineral plinth below the commercial volumes',()=>{const depth=.32,h=Math.min(depth,courtyardPassage.clearHeight),parts=fasciaPlans.flatMap(plan=>passageGroundSolids(plan).map(p=>extrude(p,h)));if(depth>h)parts.push(...fasciaPlans.map(p=>extrude(p,depth-h,h)));return merge(parts);}],
  ['Unified commercial ground floor including cyber arena',()=>{
   const depth=retailLevels.dividerBottom,h=Math.min(depth,courtyardPassage.clearHeight),parts=fasciaPlans.flatMap(plan=>passageGroundSolids(plan).map(p=>extrude(p,h)));
   if(depth>h)parts.push(...fasciaPlans.map(p=>extrude(p,depth-h,h)));return merge(parts);
  }],
  ['Upper commercial volume meeting the unchanged arena shoulders',()=>merge(podiumPlans.map(p=>createUpperPodiumGeometry(p,retailLevels.upperTop-retailLevels.upperBottom,{bottom:retailLevels.upperBottom})).map(g=>g.translate(0,retailLevels.upperBottom,0)))],
  ['Continuous white commercial cornice abutting the arena capsule',()=>merge(podiumPlans.map(p=>createUpperPodiumGeometry(p,retailLevels.corniceTop-retailLevels.corniceBottom,{bottom:retailLevels.corniceBottom})).map(g=>g.translate(0,retailLevels.corniceBottom,0)))],
  ['Podium roof slab closed against the rounded arena',()=>merge(terracePlans.map(p=>createUpperPodiumGeometry(p,.08,{bottom:retailLevels.roofSlabBottom})).map(g=>g.translate(0,retailLevels.roofSlabBottom,0)))],
  ['Continuous white band joining the podium and projecting arena',()=>merge(fasciaPlans.map(p=>extrude(p,retailLevels.dividerTop-retailLevels.dividerBottom,retailLevels.dividerBottom)))],
  ['Exposed gravel roof under the separate furnished terraces',()=>merge(terracePlans.map(p=>createUpperPodiumSurfaceGeometry(p,{y:roofY})).map(g=>g.translate(0,roofY,0)))]
 ]);
 clone.updateMatrixWorld(true);
 const own=(g,label)=>{g.computeBoundingBox();g.computeBoundingSphere();g.userData.fitnessContextCut={version:36,officeId:0,cloneOnly:true,sourceRingUnchanged:true};stampGeometry(g,{label:'fitness-context-cut/'+label});owned.add(g);ownedGeometries?.add(g);return g;};
 clone.traverse(o=>{
  const build=volumeBuilders.get(o.name);if(!o.isMesh||!build)return;
  // The gravel is a batch with its Y baked into vertices; other volumes use
  // Object3D translation. Convert the regenerated world plan to either local frame.
  const g=build().applyMatrix4(o.matrixWorld.clone().invert());o.geometry=own(g,o.name);replacements.push({name:o.name,vertices:g.attributes.position.count});
 });
 const nearOffice=(x,z,margin=.35)=>x>=bounds[0]-margin&&x<=bounds[1]+margin&&z>=bounds[2]-margin&&z<=bounds[3]+margin&&(insideRing(x,z,ring)||ring.some((p,i)=>segmentDistance(x,z,p,ring[(i+1)%ring.length])<=margin));
 const panes=model?.commercialFrontage?.allCommercialPanes||[];
 const windows=clone.getObjectByName('Connected shop interiors across adjacent glazing with quieter upper galleries');
 if(windows?.isInstancedMesh){
  if(windows.instanceMatrix===model?.commercialFrontage?.shopWindows?.instanceMatrix)throw new TypeError('Fitness context window instances must own their matrix buffer');
  const matrix=new T.Matrix4(),p=new T.Vector3(),zero=new T.Matrix4().makeScale(0,0,0);
  for(let i=0;i<windows.count;i++){
   const pane=panes[i];windows.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(windows.matrixWorld);
   const c=pane?Math.cos(pane.angle):0,s=pane?Math.sin(pane.angle):0,w=(pane?.width||0)/2;
   if(pane?.officeLobby||nearOffice(p.x,p.z)||nearOffice(p.x+c*w,p.z-s*w)||nearOffice(p.x-c*w,p.z+s*w)){windows.setMatrixAt(i,zero);hiddenInstances.push(i);}
  }
  windows.instanceMatrix.needsUpdate=true;windows.boundingBox=windows.boundingSphere=null;
 }
 // These batches are composed of small individual frame/privacy boxes. Remove
 // only their office-local triangles, including the 35 cm facade assembly allowance.
 // The large coordinated plan volumes above use exact polygon differences instead.
 const frameNames=new Set(['Fine dark shop mullions, door leaves and opening transoms','Paired metal handles on the gastro street doors','Smooth white courtyard side of the two-storey connecting podium','Dark private tower plinths beside the commercial volumes','Continuous second-storey separators in commercial tower bases']);
 clone.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||(!frameNames.has(o.name)&&o.parent?.name!=='Service roofs · mineral gravel, parapets and ventilation'))return;
  if(volumeBuilders.has(o.name))return;
  const source=o.geometry,flat=source.index?source.toNonIndexed():source,position=flat.attributes.position,keep=[];let removed=0;
  const pts=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
  for(let i=0;i<position.count;i+=3){
   for(let j=0;j<3;j++)pts[j].fromBufferAttribute(position,i+j).applyMatrix4(o.matrixWorld);
   const cx=(pts[0].x+pts[1].x+pts[2].x)/3,cz=(pts[0].z+pts[1].z+pts[2].z)/3;
   if(nearOffice(cx,cz)||pts.some(p=>nearOffice(p.x,p.z))){removed++;continue;}keep.push(i,i+1,i+2);
  }
  if(removed){
   const g=new T.BufferGeometry();for(const [name,a]of Object.entries(flat.attributes)){
    const data=new a.array.constructor(keep.length*a.itemSize);for(let i=0;i<keep.length;i++)for(let j=0;j<a.itemSize;j++)data[i*a.itemSize+j]=a.array[keep[i]*a.itemSize+j];g.setAttribute(name,new T.BufferAttribute(data,a.itemSize,a.normalized));
   }
   g.userData={fitnessContextFrameFilter:{version:36,officeId:0,cloneOnly:true,assemblyAllowance:.35,removedTriangles:removed}};o.geometry=own(g,o.name);filtered.push({name:o.name,parent:o.parent?.name,removedTriangles:removed,retainedTriangles:keep.length/3});
  }
  if(flat!==source)flat.dispose();
 });
 const metadata={revision:36,kind:'showroom-only office section',officeId:0,officeRing:ring,officeRingBounds:bounds,sourceGeometryUnchanged:true,sourceMaterialsUnchanged:true,mainExteriorUnchanged:true,neighbouringPodiumPreserved:true,
  method:'Boolean difference of the exact office-0 world footprint from clone plan volumes; local clone glazing/frame suppression',replacements,frameFilters:filtered,hiddenShopInstances:hiddenInstances,frameAssemblyAllowance:.35,
  viewLimit:'The neighbouring two-storey podium remains visible outside the office footprint; the first-floor street view is not guaranteed unobstructed'};
 clone.userData.fitnessContextCut=metadata;let dead=false;
 return{metadata,dispose(){if(dead)return;dead=true;for(const g of owned){g.dispose();ownedGeometries?.delete(g);}owned.clear();}};
}
