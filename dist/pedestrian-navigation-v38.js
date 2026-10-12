// @r_peredelkino · one ground collision model for visitors and animated residents.
import * as THREE from './vendor/three.module.js';
import {complexFootprints as footprints} from './complex-footprints.js?v=community38';
import {createWalkWorld} from './walk-physics.js?v=community38';
import {forecourtWalkRoute} from './forecourt-walking-layout.js?v=community38';
import {frontageGroundHeight} from './forecourt-ground.js?v=community38';

export function groundWalkInputs(model){
 const solids=[...(model.passage?.solids??[footprints.podium]),model.arenaFootprint??footprints.arena,model.courtyard.bridgeCollision,...model.courtyard.data.islands,...model.publicRealm.data.islands,...(model.publicRealm.solids??[]),...(model.salesOffice?.solids??[]),...Object.values(model.neighborhood?.backdrop?.footprints??{})].filter(Boolean);
 for(const tower of model.towers.values()){
  const c=Math.cos(tower.spec.angle),s=Math.sin(tower.spec.angle);
  solids.push({outer:tower.shape.getPoints(32).map(p=>{const x=p.x*1.027,z=-p.y*1.027;return[tower.spec.x+c*x+s*z,tower.spec.z-s*x+c*z]}),holes:[]});
 }
 const obstacles=[...(model.passage?.colliders??[]),...model.courtyard.colliders,...model.publicRealm.colliders,...model.publicRealm.treePositions.map(([x,z,scale])=>({type:'circle',x,z,radius:.25*scale})),...model.treePositions.map(([x,z])=>({type:'circle',x,z,radius:.48})),...(model.salesOffice?.colliders??[]),...(model.neighborhood?.backdropGarden?.colliders??[]),...(model.cyberCourtyard?.obstacles??[]),...(model.cyberGarden?.obstacles??[])];
 // Some forest-edge shrubs were outside the legacy polygon islands. Their
 // rendered envelopes now block movement as well as their planting polygons.
 for(const [x,z,scale] of model.courtyard.data.shrubs??[])obstacles.push({type:'circle',x,z,radius:.73*scale,source:'courtyard-shrub'});
 for(const [x,z,scale] of model.publicRealm.data.shrubs??[])obstacles.push({type:'circle',x,z,radius:.75*scale,source:'promenade-shrub'});
 const matrix=new THREE.Matrix4();model.salesOffice?.group?.traverse(mesh=>{
  if(!mesh.isInstancedMesh||mesh.material!==model.salesOffice.materials.shrub)return;
  let radius=0;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const e=matrix.elements;obstacles.push({type:'circle',x:e[12],z:e[14],radius:radius*Math.max(Math.hypot(e[0],e[2]),Math.hypot(e[8],e[10])),source:'sales-office-shrub'})}
 });
 // Road-clipped paving missed five centreline vertices at the curved Borovskoe
 // service-road junction. Keep every active carriageway out of walk space too.
 for(const lane of model.traffic?.lanes??[]){const points=lane.pointsWorld;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];obstacles.push({type:'segment',a:[a[0],a[2]],b:[b[0],b[2]],radius:Math.max(.55,(lane.laneWidth??2.8)/2-.12),source:'active-road:'+lane.id})}}
 return{boundary:model.publicRealm.data.boundary,boundaryExtensions:[...(model.publicRealm.data.boundaryExtensions??[]),...(model.salesOffice?.boundaryExtensions??[])],solids,obstacles};
}

export function createGroundWalkWorld(model,{radius=.36}={}){
 return createWalkWorld({...groundWalkInputs(model),radius});
}

const point=p=>Array.isArray(p)?[Number(p[0]),Number(p[1])]:[Number(p.x),Number(p.z)];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// Segment subdivision is deliberately radius-dependent. Endpoints alone allow
// a diagonal to cut through a tree, a narrow wall, or a planting corner.
export function walkSegmentFree(world,a,b,spacing=Math.min(.16,world.radius*.3)){
 const n=Math.max(1,Math.ceil(distance(a,b)/spacing));
 for(let i=0;i<=n;i++){const t=i/n;if(!world.free(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))return false}
 return true;
}

class MinHeap{
 constructor(){this.items=[]}
 push(value){const a=this.items;let i=a.length;a.push(value);while(i){const parent=(i-1)>>1;if(a[parent].f<=value.f)break;a[i]=a[parent];i=parent}a[i]=value}
 pop(){const a=this.items,top=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1].f<a[child].f)child++;if(a[child].f>=last.f)break;a[i]=a[child];i=child}a[i]=last}return top}
 get length(){return this.items.length}
}

function routeRecord(id,points,radius){
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+distance(points[i-1],points[i]));
 return{id,points,closed:false,interpolation:'polyline',drawSurface:false,sampleGround:true,radius,length:cumulative.at(-1),cumulative};
}

export function samplePedestrianRoute(route,progress,out={}){
 const points=route.points,cumulative=route.cumulative;
 const t=Math.max(0,Math.min(1,progress))*route.length;let lo=0,hi=points.length-2;
 while(lo<hi){const m=(lo+hi)>>1;if(cumulative[m+1]<t)lo=m+1;else hi=m}
 const a=points[lo],b=points[lo+1],len=cumulative[lo+1]-cumulative[lo],u=len?(t-cumulative[lo])/len:0;
 out.x=a[0]+(b[0]-a[0])*u;out.z=a[1]+(b[1]-a[1])*u;out.dx=(b[0]-a[0])/len;out.dz=(b[1]-a[1])/len;out.y=frontageGroundHeight(out.x,out.z)+.035;
 return out;
}

export function createPedestrianNavigation(model){
 let inputs=groundWalkInputs(model);const worlds=new Map(),routeSets=new Map(),pathCache=new Map(),cellCaches=new Map();
 const getBounds=()=>inputs.boundaryExtensions.concat(inputs.boundary).flatMap(s=>s.outer).reduce((b,[x,z])=>[Math.min(b[0],x),Math.max(b[1],x),Math.min(b[2],z),Math.max(b[3],z)],[Infinity,-Infinity,Infinity,-Infinity]);let bounds=getBounds();
 const sourceSignature=()=>[model.courtyard.colliders.length,model.publicRealm.colliders.length,model.publicRealm.solids?.length??0,model.salesOffice?.colliders?.length??0,model.neighborhood?.backdropGarden?.colliders?.length??0,model.cyberCourtyard?.obstacles?.length??0,model.cyberGarden?.obstacles?.length??0,model.courtyard.data.shrubs?.length??0,model.publicRealm.data.shrubs?.length??0,model.publicRealm.treePositions.length,model.treePositions.length,model.towers.size,model.publicRealm.data.boundaryExtensions?.length??0,model.salesOffice?.boundaryExtensions?.length??0,model.traffic?.lanes?.length??0].join(':');let signature=sourceSignature();
 let searchedNodes=0,plans=0,cacheHits=0;
 function worldForRadius(radius=.48){const r=Math.max(.12,Math.min(1.5,Number(radius)||.48)),key=r.toFixed(3);if(!worlds.has(key))worlds.set(key,createWalkWorld({...inputs,radius:r}));return worlds.get(key)}
 worldForRadius(.36);
 function nearest(p,{radius=.48,maxDistance=6}={}){return worldForRadius(radius).nearest(point(p),maxDistance)}
 function simplify(world,points){const out=[points[0]];for(let i=0;i<points.length-1;){let next=points.length-1;while(next>i+1&&!walkSegmentFree(world,points[i],points[next]))next--;out.push(points[next]);i=next}return out}
 function search(actualWorld,start,end,pad){
  const step=.8,radiusKey=actualWorld.radius.toFixed(3);let cellCache=cellCaches.get(radiusKey);if(!cellCache)cellCaches.set(radiusKey,cellCache=new Map());
  const key=(x,z)=>x+','+z,coord=(x,z)=>[x*step,z*step],free=(x,z)=>{const k=key(x,z);if(!cellCache.has(k))cellCache.set(k,actualWorld.free(x*step,z*step));return cellCache.get(k)};
  const area=[Math.max(bounds[0],Math.min(start[0],end[0])-pad),Math.min(bounds[1],Math.max(start[0],end[0])+pad),Math.max(bounds[2],Math.min(start[1],end[1])-pad),Math.min(bounds[3],Math.max(start[1],end[1])+pad)];
  const open=new MinHeap(),best=new Map(),closed=new Set();
  const ix=Math.round(start[0]/step),iz=Math.round(start[1]/step);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
   const x=ix+dx,z=iz+dz,p=coord(x,z);if(!free(x,z)||!walkSegmentFree(actualWorld,start,p))continue;
   const g=distance(start,p),node={x,z,g,f:g+distance(p,end),parent:null};open.push(node);best.set(key(x,z),g);
  }
  let visited=0;
  while(open.length&&visited<(actualWorld.radius>.7?2500:16000)){
   const current=open.pop(),k=key(current.x,current.z);if(closed.has(k))continue;closed.add(k);visited++;const p=coord(current.x,current.z);
   if(distance(p,end)<step*2.8&&walkSegmentFree(actualWorld,p,end)){
    searchedNodes+=visited;const points=[end];let node=current;while(node){points.push(coord(node.x,node.z));node=node.parent}points.push(start);return simplify(actualWorld,points.reverse());
   }
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const x=current.x+dx,z=current.z+dz,q=coord(x,z),nextKey=key(x,z);
    if(q[0]<area[0]||q[0]>area[1]||q[1]<area[2]||q[1]>area[3]||closed.has(nextKey)||!free(x,z))continue;
    const g=current.g+Math.hypot(dx,dz)*step;if(g>=(best.get(nextKey)??Infinity)||!walkSegmentFree(actualWorld,p,q))continue;
    best.set(nextKey,g);open.push({x,z,g,f:g+distance(q,end),parent:current});
   }
  }
  searchedNodes+=visited;return null;
 }
 function planPath(from,to,{radius=.48,maxDistance=6}={}){
  plans++;const actualWorld=worldForRadius(radius+.085),a=actualWorld.nearest(point(from),maxDistance),b=actualWorld.nearest(point(to),maxDistance);if(!a||!b)return null;
  const start=[a.x,a.z],end=[b.x,b.z];if(distance(start,end)<1e-8)return[start];
  const cacheKey=actualWorld.radius+':'+start.concat(end).map(n=>n.toFixed(3)).join(',');
  if(pathCache.has(cacheKey)){cacheHits++;return pathCache.get(cacheKey).map(p=>p.slice())}
  let result=walkSegmentFree(actualWorld,start,end)?[start,end]:null;
  if(!result)for(const pad of (actualWorld.radius>.7?[10,28]:[10,28,70])){result=search(actualWorld,start,end,pad);if(result)break}
  if(result){if(pathCache.size>256)pathCache.delete(pathCache.keys().next().value);pathCache.set(cacheKey,result);return result.map(p=>p.slice())}return null;
 }
 function validateRoute(route,{radius=route.radius??.48}={}){
  const actualWorld=worldForRadius(radius),points=route.points;return points.length>1&&points.every((a,i)=>actualWorld.free(...a)&&(i===0||walkSegmentFree(actualWorld,points[i-1],a)));
 }
 function repairRoute(id,seeds,radius){
  const actualWorld=worldForRadius(radius+.085),points=[];let previous=null,part=0;const finished=[];
  const flush=()=>{if(points.length>1){const route=routeRecord(id+(part?'-'+part:''),points.slice(),radius);if(route.length>6&&validateRoute(route))finished.push(route)}points.length=0;previous=null;part++};
  for(const seed of seeds){const p=actualWorld.nearest(seed,6);if(!p)continue;const q=[p.x,p.z];if(previous&&distance(previous,q)<.05)continue;
   const path=previous?planPath(previous,q,{radius,maxDistance:0}):[q];
   if(path){points.push(...path.slice(previous?1:0));previous=q}else{flush();points.push(q);previous=q}
  }
  flush();return finished;
 }
 const seeds=[
  {id:'courtyard-garden',points:footprints.walkRoutes[0].points},
  {id:'office-east',points:footprints.walkRoutes[1].points},
  {id:'promenade',points:forecourtWalkRoute.points},
  {id:'courtyard-passage',points:model.passage?.data?.route??[]},
  {id:'forest-front',points:footprints.walkRoutes[2].points.slice(6)},
 ];
 function routesForRadius(radius=.48){const key=Number(radius).toFixed(3);if(!routeSets.has(key))routeSets.set(key,seeds.flatMap(seed=>repairRoute(seed.id,seed.points,radius)));return routeSets.get(key)}
 routesForRadius(.48);
 const benches=(model.cyberCourtyard?.interactions??[]).filter(i=>i.type==='seat'&&!i.world).flatMap(item=>{
  const approach=nearest(item.point,{radius:.48,maxDistance:2});if(!approach)return[];
  const p=item.seatPoint,look=item.lookAt;return[{id:item.id,point:p.slice(),height:item.seatHeight??.5,yaw:Math.atan2(look[0]-p[0],look[1]-p[1]),approach:[approach.x,approach.z],owner:'cyberCourtyard'}];
 });
 function refresh({force=false}={}){const next=sourceSignature();if(!force&&next===signature)return false;signature=next;inputs=groundWalkInputs(model);bounds=getBounds();worlds.clear();routeSets.clear();pathCache.clear();cellCaches.clear();return true;}
 return{model,get world(){return worldForRadius(.36)},worldForRadius,nearest,planPath,get routes(){return routesForRadius(.48)},routesForRadius,benches,validateRoute,sampleRoute:samplePedestrianRoute,refresh,
  get stats(){return{plans,cacheHits,searchedNodes,routeSets:routeSets.size,cachedPaths:pathCache.size,cachedCells:Array.from(cellCaches.values()).reduce((n,c)=>n+c.size,0)}},
  dispose(){worlds.clear();routeSets.clear();pathCache.clear();cellCaches.clear()}};
}
