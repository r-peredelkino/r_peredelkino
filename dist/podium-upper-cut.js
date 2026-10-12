// @r_peredelkino · RP-CONCEPT-2026-10-07
// v34: the two-storey podium abuts the existing circular arena shoulder.
// The old rectangular exclusion removed an entire shop bay at either side.
// Source footprints and the arena facade stay untouched; only the upper
// construction and its partial end bays follow the shared opaque shell.
import * as THREE from './vendor/three.module.js';
import polygonClipping from './vendor/polygon-clipping.module.js';
import {complexFootprints as footprint} from './complex-footprints.js?v=publication371';
import {location} from './solar.js?v=publication371';
import {retailLevels} from './frontage-zones.js?v=publication371';
import {smoothWallNormals} from './facade-detail.js?v=publication371';
import {arenaShoulderProfile,arenaShoulderRadiusAt,arenaSectionCutRadius} from './arena-shell-profile.js?v=publication371';
import {arenaCenter,arenaGroundRadius,arenaPlacement} from './arena-placement-v35.js?v=publication371';

const centre=arenaCenter,radius=arenaGroundRadius;
const normal=[...arenaPlacement.outward],tangent=[normal[1],-normal[0]],segments=192,overlap=.024;
export const arenaUpperRelief=Object.freeze({version:35,centre:[...centre],normal,tangent,radius,placement:arenaPlacement,
 shape:'circular section of the unchanged arena capsule',maxRadius:Math.max(...arenaShoulderProfile(radius).map(p=>p.x)),
 shoulderOverlap:overlap,source:'promo_new.jpg and 21.48.23/21.48.46/21.50.09; 23.50.18: projecting arena closes against the unchanged podium',sourceGroundFootprintUnchanged:true,arenaFacadeUnchanged:true});
const ringArea=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0]},0)/2;
const sourceArea=data=>Math.abs(ringArea(data.outer))-(data.holes||[]).reduce((sum,h)=>sum+Math.abs(ringArea(h)),0);
const closed=ring=>Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-8?ring:[...ring,ring[0]];
const circleRing=r=>closed(Array.from({length:segments},(_,i)=>{const a=i/segments*Math.PI*2;return[centre[0]+r*Math.cos(a),centre[1]+r*Math.sin(a)];}));
const cache=new WeakMap();
function clippedPlan(data,r){
 let byRadius=cache.get(data);if(!byRadius){byRadius=new Map();cache.set(data,byRadius);}const key=r.toFixed(9);if(byRadius.has(key))return byRadius.get(key);
 const polygons=polygonClipping.difference([closed(data.outer),...(data.holes||[]).map(closed)],[circleRing(r)]);
 const remainingArea=polygons.reduce((sum,p)=>sum+Math.abs(ringArea(p[0]))-p.slice(1).reduce((s,h)=>s+Math.abs(ringArea(h)),0),0);
 const result={polygons,sourceArea:sourceArea(data),remainingArea};result.removedArea=result.sourceArea-remainingArea;byRadius.set(key,result);return result;
}
function merge(geometries){
 const source=geometries.map(g=>g.index?g.toNonIndexed():g),count=source.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;
 for(let i=0;i<source.length;i++){const g=source[i],size=g.attributes.position.count;positions.set(g.attributes.position.array,at*3);normals.set(g.attributes.normal.array,at*3);uv.set(g.attributes.uv.array,at*2);at+=size;if(g!==geometries[i])g.dispose();geometries[i].dispose();}
 const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(positions,3));out.setAttribute('normal',new THREE.BufferAttribute(normals,3));out.setAttribute('uv',new THREE.BufferAttribute(uv,2));return out;
}
function planGeometry(polygons,depth){
 const parts=polygons.map(rings=>{
  const s=new THREE.Shape(rings[0].slice(0,-1).map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const h of rings.slice(1))s.holes.push(new THREE.Path(h.slice(0,-1).map(([x,z])=>new THREE.Vector2(x,-z))));
  const g=depth?new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:1,steps:1}):new THREE.ShapeGeometry(s,1);g.rotateX(-Math.PI/2);return g;
 });
 const g=smoothWallNormals(merge(parts));g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function geometry(data,depth,bottom){
 const cutRadius=arenaSectionCutRadius(radius,bottom,bottom+(depth||0),overlap),plan=clippedPlan(data,cutRadius);
 const g=planGeometry(plan.polygons,depth);
 g.userData.arenaUpperRelief={...arenaUpperRelief,sourceArea:plan.sourceArea,remainingArea:plan.remainingArea,removedArea:plan.removedArea,
  bottom,top:bottom+(depth||0),depth:depth||0,cutRadius,cutSegments:segments,profileMatched:true,noExposedRadialGap:true};return g;
}
export function createUpperPodiumGeometry(data,depth,{bottom=retailLevels.upperBottom}={}){if(!(depth>0))throw new Error('The upper podium extrusion must have a positive depth');return geometry(data,depth,bottom);}
export function createUpperPodiumSurfaceGeometry(data,{y=retailLevels.roof+.008}={}){return geometry(data,0,y);}
export function createGroundArenaUnionGeometry(data,depth){
 const polygons=polygonClipping.union([closed(data.outer),...(data.holes||[]).map(closed)],[circleRing(radius)]);
 const g=planGeometry(polygons,depth);g.userData.arenaGroundUnion={version:35,centre:[...centre],radius,sourceContourUnchanged:true,placement:arenaPlacement};return g;
}

function segmentInterval(a,b,r){
 const ax=a[0]-centre[0],az=a[1]-centre[1],dx=b[0]-a[0],dz=b[1]-a[1],A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-r*r;
 if(A<1e-16)return C<=0?[0,1]:null;const D=B*B-4*A*C;if(D<0)return null;
 const lo=Math.max(0,(-B-Math.sqrt(Math.max(0,D)))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(Math.max(0,D)))/(2*A));return hi-lo>1e-10?[lo,hi]:null;
}
export function inArenaUpperRelief(x,z,margin=0,y=retailLevels.roof){return Math.hypot(x-centre[0],z-centre[1])<=arenaShoulderRadiusAt(radius,y)+margin;}
export function segmentsOutsideArenaRelief(a,b,margin=0,{bottom=retailLevels.roof,top=bottom}={}){
 const r=arenaSectionCutRadius(radius,bottom,top,overlap)+margin,interval=segmentInterval(a,b,r);if(!interval)return[[a,b]];
 const [lo,hi]=interval,point=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],parts=[];
 if(lo>1e-9)parts.push([a,point(lo)]);if(hi<1-1e-9)parts.push([point(hi),b]);return parts;
}
export function clipUpperPaneToArena(pane){
 const c=Math.cos(pane.angle),s=Math.sin(pane.angle),a=[pane.x-c*pane.width/2,pane.z+s*pane.width/2],b=[pane.x+c*pane.width/2,pane.z-s*pane.width/2];
 const interval={bottom:pane.bottom??retailLevels.upperBottom,top:pane.top??retailLevels.upperTop},cutRadius=arenaSectionCutRadius(radius,interval.bottom,interval.top,overlap);
 return segmentsOutsideArenaRelief(a,b,0,interval).map(([start,end])=>{
  const width=Math.hypot(end[0]-start[0],end[1]-start[1]);
  return{...pane,x:(start[0]+end[0])/2,z:(start[1]+end[1])/2,width,pitch:width,arenaJunction:{version:34,sourceWidth:pane.width,cutRadius,trimmed:width<pane.width-1e-7,sourceBayId:pane.id,overlap}};
 }).filter(p=>p.width>.08);
}
export function upperPaneIntersectsArenaRelief(pane){const pieces=clipUpperPaneToArena(pane);return pieces.reduce((sum,p)=>sum+p.width,0)<pane.width-1e-7;}
