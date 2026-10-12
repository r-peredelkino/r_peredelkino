// Pure geometry and circulation checks, no WebGL/browser or developer source assets required.
import * as T from '../../dist/vendor/three.module.js';
import {createConceptInterior,addArenaCluster} from '../../dist/showroom-spaces-v34.js';
import {createWalkWorld} from '../../dist/walk-physics.js';
const checks=[];
function assert(name,pass,details={}){checks.push({name,pass,...details});if(!pass)throw new Error(name);}
function environment(){
 const root=new T.Group(),ownedGeometries=new Set(),ownedMaterials=new Set(),mats={};
 for(const name of ['stone','dark','wood','white','metal','glass','neon']){mats[name]=new T.MeshStandardMaterial({color:0xaabbbb});ownedMaterials.add(mats[name]);}
 const mesh=(geo,mat,name,parent=root)=>{ownedGeometries.add(geo);const o=new T.Mesh(geo,mat);o.name=name;parent.add(o);return o;};
 const box=(w,h,d,x,y,z,mat,name='',parent=root)=>{const o=mesh(new T.BoxGeometry(w,h,d),mat,name,parent);o.position.set(x,y+h/2,z);return o;};
 const luminous=(w,h,x,y,z)=>box(w,h,.05,x,y,z,mats.neon);
 const makeLabel=(text,w,h,x,y,z)=>{const o=mesh(new T.PlaneGeometry(w,h),mats.neon,text);o.position.set(x,y,z);return o;};
 return{root,mats,ownedGeometries,ownedMaterials,box,mesh,luminous,makeLabel};
}
function reachable(world,start,target){
 // Conservative BFS within the actual room; point must be close enough to interact (3.2 m).
 const step=.35,key=(x,z)=>Math.round(x/step)+','+Math.round(z/step),queue=[start],seen=new Set([key(start.x,start.z)]);
 for(let head=0;head<queue.length&&head<20000;head++){const p=queue[head];if(Math.hypot(p.x-target.x,p.z-target.z)<.55)return true;for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){const x=p.x+dx,z=p.z+dz,k=key(x,z);if(seen.has(k)||!world.free(x,z))continue;seen.add(k);const next=world.move(p,dx,dz);if(Math.hypot(next.x-x,next.z-z)>.01)continue;queue.push({x,z});}}
 return false;
}
for(const [kind,building]of [['lobby',1],['lobby',2],['lobby',3],['lobby',4],['lobby',5],['office',0],['sales','sales-office']]){
 const env=environment(),space=createConceptInterior(kind,{...env,building}),world=createWalkWorld({boundary:space.boundary,obstacles:space.obstacles,radius:.24}),prefix=kind+' '+building;
 assert(prefix+' source/concept status',space.metadata.concept===true&&space.metadata.sourceInteriorPlan===false&&space.metadata.building===building);
 assert(prefix+' entry spawn clear',world.free(space.walker.x,space.walker.z));
 assert(prefix+' focus clear',world.free(space.focus.x,space.focus.z));
 for(const p of space.poi){assert(prefix+' '+p.id+' clear',world.free(p.x,p.z));assert(prefix+' '+p.id+' accessible',reachable(world,space.walker,p));}
 if(kind==='office'){assert(prefix+' meeting threshold clear',world.free(6.4,-2.45));assert(prefix+' meeting inside accessible',reachable(world,space.walker,{x:6.4,z:-3.25}));}
 if(kind==='sales')assert(prefix+' inner pavilion bounds',space.metadata.interiorBounds[0]===14.2&&space.metadata.interiorBounds[1]===16.8&&space.metadata.exteriorPavilionUnchanged===true);
 let count=0,bad=[];env.root.traverse(o=>{if(!o.geometry)return;count++;for(const key of ['position','normal']){const a=o.geometry.attributes[key];if(a&&Array.from(a.array).some(v=>!Number.isFinite(v)))bad.push(o.name+':'+key);}});
 assert(prefix+' finite geometry',bad.length===0,{meshes:count,geometries:env.ownedGeometries.size,bad});
 // Authorship is stamped by openShowroom using the existing project workflow.
 for(const g of env.ownedGeometries)g.dispose();for(const m of env.ownedMaterials)m.dispose();
}
for(const radius of [10,15,24]){const env=environment(),cluster=addArenaCluster({...env,radius});assert('arena '+radius+' 5v5 concept',cluster.metadata.players===10&&cluster.metadata.modes.length===3);assert('arena '+radius+' POI finite',cluster.poi.every(p=>Number.isFinite(p.x+p.z)));for(const g of env.ownedGeometries)g.dispose();for(const m of env.ownedMaterials)m.dispose();}
console.log(JSON.stringify({pass:checks.every(c=>c.pass),checks},null,2));
