// Geometry/circulation/animation/lifecycle verification of the authored floor2 adaptation.
import * as T from '../../dist/vendor/three.module.js';
import {createOfficeFitness,registerFitnessSourceZone} from '../../dist/office-fitness-v35.js';
import {complexFootprints} from '../../dist/complex-footprints.js';
import {insideRing,solidContains,createWalkWorld} from '../../dist/walk-physics.js';
const checks=[],assert=(name,pass,details={})=>{checks.push({name,pass,...details});if(!pass)throw new Error(name);};
const ownedGeometries=new Set(),ownedMaterials=new Set(),ownedTextures=new Set(),root=new T.Group(),gym=createOfficeFitness({root,floorY:3.6,ownedGeometries,ownedMaterials,ownedTextures});
const office=complexFootprints.buildings.find(b=>b.id===0),registered=registerFitnessSourceZone(office),zone=gym.metadata.fitnessBoundary,sourceWorld=createWalkWorld({boundary:zone,solids:gym.solids,radius:.01});
assert('Declared source3rd-floor unit is adapted to2nd floor',gym.metadata.sourceFloor===3&&gym.metadata.adaptedFloor===2&&gym.floorY===3.6&&gym.metadata.sourceMapping.survey===false&&gym.metadata.sourceMapping.scale===1);
assert('105m2 unit has not been stretched to entire office floor',Math.abs(gym.metadata.fitnessArea-105)<.001&&Math.abs(gym.metadata.boundaryArea-963.93905234)<.001);
assert('Eastern street-facing registration',gym.metadata.sourceMapping.streetFacingNormal[0]>.99);
assert('All9 equipment footprints fit without skipping',gym.equipment.length===9&&gym.metadata.skipped.length===0,{equipment:gym.equipment.map(e=>({id:e.id,kind:e.kind}))});
let outlineOutside=0;
for(let i=0;i<zone.outer.length;i++){const a=zone.outer[i],b=zone.outer[(i+1)%zone.outer.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.03);for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;if(!insideRing(x,z,gym.boundary))outlineOutside++;}}
assert('Whole source unit outline remains inside retained office0',outlineOutside===0,{outsideSamples:outlineOutside});
function corners(o){const c=Math.cos(o.angle),s=Math.sin(o.angle);return[[-o.width/2,-o.depth/2],[o.width/2,-o.depth/2],[o.width/2,o.depth/2],[-o.width/2,o.depth/2]].map(([x,z])=>[o.x+c*x+s*z,o.z-s*x+c*z]);}
function overlaps(a,b){const ap=corners(a),bp=corners(b);for(const p of [ap,bp])for(let i=0;i<4;i++){const q=p[i],r=p[(i+1)%4],nx=-(r[1]-q[1]),nz=r[0]-q[0],pa=ap.map(t=>t[0]*nx+t[1]*nz),pb=bp.map(t=>t[0]*nx+t[1]*nz);if(Math.max(...pa)<=Math.min(...pb)+1e-7||Math.max(...pb)<=Math.min(...pa)+1e-7)return false;}return true;}
for(const e of gym.equipment){const o=e.workingFootprint,c=Math.cos(o.angle),s=Math.sin(o.angle);let outside=0,serviceHits=0;for(let x=-o.width/2;x<=o.width/2+.0001;x+=.04)for(let z=-o.depth/2;z<=o.depth/2+.0001;z+=.04){const wx=o.x+c*x+s*z,wz=o.z-s*x+c*z;if(!insideRing(wx,wz,zone.outer))outside++;if(gym.solids.some(p=>solidContains(wx,wz,p)))serviceHits++;}assert(e.id+' fits105m2 and avoids source service rooms',outside===0&&serviceHits===0,{outside,serviceHits});}
let overlapCount=0;for(let i=0;i<gym.equipment.length;i++)for(let j=i+1;j<gym.equipment.length;j++)if(overlaps(gym.equipment[i].workingFootprint,gym.equipment[j].workingFootprint))overlapCount++;
assert('No equipment working footprints overlap',overlapCount===0,{overlapCount});
assert('Floor2 spawn is clear',gym.world.free(gym.walker.x,gym.walker.z)&&gym.heightAt()===3.6);
assert('Initial walking frame begins past the retained source entrance',Math.hypot(gym.walker.x-gym.sourceEntry.x,gym.walker.z-gym.sourceEntry.z)>2&&Math.hypot(gym.sourceEntry.x-registered.sourceEntry[0],gym.sourceEntry.z-registered.sourceEntry[1])<.001&&gym.metadata.initialSpawn.y===5.28&&Math.abs(gym.spawnYaw+.0875)<.01&&Math.abs(gym.spawnPitch+.072)<.01,{sourceEntry:gym.sourceEntry,initialSpawn:gym.metadata.initialSpawn});
assert('Source and exit POIs retain the original entrance location',['fitness-source','fitness-locker','exit'].every(id=>{const p=gym.pois.find(p=>p.id===id);return Math.hypot(p.x-gym.sourceEntry.x,p.z-gym.sourceEntry.z)<.001;}));
gym.group.updateMatrixWorld(true);const eye=new T.Vector3(gym.walker.x,5.28,gym.walker.z),visible=[];
for(const e of gym.equipment){const o=e.workingFootprint,target=new T.Vector3(o.x,gym.floorY+e.viewTargetHeight,o.z),delta=target.clone().sub(eye),ray=new T.Raycaster(eye,delta.clone().normalize(),.05,delta.length()-.05),blocked=ray.intersectObject(gym.group,true).some(hit=>!hit.object.material.transparent&&hit.object.material.userData.fitnessSurface==='partition');if(!blocked)visible.push(e.id);}
assert('Own source partitions do not hide the initial equipment-row view',visible.length>=8,{visible,scope:'Interior geometry rays only; native cloned context must also be checked'});
assert('Equipment view targets are below human eye height',gym.metadata.workingFootprints.every(e=>e.viewTargetHeight>0&&e.viewTargetHeight<1.68));
for(const p of gym.pois)assert(p.id+' interactive point is free',gym.world.free(p.x,p.z));
const step=.22,key=p=>Math.round(p.x/step)+','+Math.round(p.z/step),queue=[gym.walker],seen=new Set([key(gym.walker)]),reached=new Set();
for(let head=0;head<queue.length&&head<40000;head++){const p=queue[head];for(const poi of gym.pois)if(Math.hypot(poi.x-p.x,poi.z-p.z)<.4)reached.add(poi.id);for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]]){const target={x:p.x+dx,z:p.z+dz},k=key(target);if(seen.has(k)||!gym.world.free(target.x,target.z))continue;const next=gym.world.move(p,dx,dz);if(Math.hypot(next.x-target.x,next.z-target.z)>.001)continue;seen.add(k);queue.push(target);}}
assert('All interactive points are accessible through real world paths',gym.pois.every(p=>reached.has(p.id)),{nodes:queue.length,reached:[...reached],unreachable:gym.pois.filter(p=>!reached.has(p.id)).map(p=>p.id)});
const n=registered.frame.normal,entry=registered.sourceEntry,a={x:entry[0]-.7*n[0],z:entry[1]-.7*n[1]},b={x:entry[0]+.7*n[0],z:entry[1]+.7*n[1]},out=gym.world.move(a,b.x-a.x,b.z-a.z),back=gym.world.move(b,a.x-b.x,a.z-b.z);
assert('Source entrance opening passes in both directions',!out.blocked&&!back.blocked&&Math.hypot(out.x-b.x,out.z-b.z)<.001&&Math.hypot(back.x-a.x,back.z-a.z)<.001);
assert('Source services have visible walls and closed doors',gym.metadata.serviceAccess.includes('closed')&&gym.solids.length===3&&gym.metadata.sourceServices.map(s=>s.advertisedArea).join(',')==='8.4,7.6,4');
assert('Null equipment ID starts all supported animations',gym.setEquipmentRunning(null,true)&&gym.anyRunning&&Object.values(gym.equipmentState).filter(s=>s.animated).every(s=>s.running));
const belts=[];gym.group.traverse(o=>{if(o.name==='Curved continuous running belt')belts.push(o.material.map);});const before=belts.map(t=>t.offset.y);
for(let i=0;i<200;i++)gym.update(i/30);
assert('Both treadmill textures actually scroll',belts.length===2&&belts.every((t,i)=>Math.abs(t.offset.y-before[i])>.01));
assert('Resistance clamps to cosmetic levels1–10',gym.setEquipmentState('treadmill-1',{resistance:45})&&gym.getEquipmentState('treadmill-1').resistance===10);
gym.setEquipmentRunning(null,false);const paused=belts.map(t=>t.offset.y);gym.update(12);
assert('Stopping holds animated textures',!gym.anyRunning&&belts.every((t,i)=>t.offset.y===paused[i]));
let geometryCount=0,triangles=0,bad=[];gym.group.traverse(o=>{if(o.geometry){geometryCount++;const p=o.geometry.attributes.position;triangles+=(o.geometry.index?.count||p.count)/3;for(const [k,a]of Object.entries(o.geometry.attributes))if(['position','normal','uv'].includes(k)&&Array.from(a.array).some(v=>!Number.isFinite(v)))bad.push(o.name+':'+k);}if([...o.position.toArray(),...o.quaternion.toArray()].some(v=>!Number.isFinite(v)))bad.push(o.name+':transform');});
assert('All geometry and200 animation frames are finite',bad.length===0,{bad,geometryCount,triangles,stats:gym.stats});
const partitionMaterials=[...ownedMaterials].filter(m=>m.userData.fitnessSurface==='partition'),screenMaterial=[...ownedMaterials].find(m=>m.userData.fitnessSurface==='instrument-screen');
assert('Authored materials have textured surfaces and shared batches',ownedTextures.size===11&&gym.stats.geometries<45&&gym.stats.materials<=16&&partitionMaterials.length===2&&partitionMaterials.every(m=>m.map?.isDataTexture&&m.roughness>.95&&m.metalness===0)&&gym.ceiling.material.roughness===1&&gym.ceiling.material.metalness===0&&screenMaterial.map?.isDataTexture&&[...ownedTextures].every(t=>t.userData.attribution?.handle==='@r_peredelkino'),{stats:gym.stats,partitions:partitionMaterials.map(m=>m.name),ceiling:{roughness:gym.ceiling.material.roughness,metalness:gym.ceiling.material.metalness},instrumentFace:screenMaterial.map?.name});
gym.dispose();gym.dispose();assert('Idempotent disposal removes resources from parent ownership',ownedGeometries.size===0&&ownedMaterials.size===0&&ownedTextures.size===0&&root.children.length===0);
console.log(JSON.stringify({pass:checks.every(c=>c.pass),checks},null,2));
