// Animated landscape and original neighbourhood life · concept creators @r_peredelkino.
import * as THREE from './vendor/three.module.js';
import {direction} from './solar.js?v=community38';
import {frontageGroundHeight} from './forecourt-ground.js?v=community38';
import {createLifeActorFactory,populationRoles,poseLifeActor,alignCoordinates} from './life-actors-v38.js?v=community38';

const QUALITY={fast:{population:.45,updateHz:15},balanced:{population:.7,updateHz:24},full:{population:1,updateHz:30},max:{population:1,updateHz:40}};
const TAU=Math.PI*2;
function foldedDistance(distance,length){const cycle=((distance%(length*2))+length*2)%(length*2);return cycle>length?length*2-cycle:cycle;}
function travelDirection(actor,distance=actor.distance){return Math.floor(distance/actor.route.length)%2===0?actor.direction:-actor.direction;}
function angleDelta(a,b){return ((a-b+Math.PI)%TAU+TAU)%TAU-Math.PI;}
function pointRoute(id,points,radius){const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));return{id,points,cumulative,radius,length:cumulative.at(-1),closed:false,interpolation:'polyline',drawSurface:false,sampleGround:true};}

// Positions use the same ground collision model as the visitor. No guessed
// route ribbons are painted over the traced courtyard/public-realm paving.
export function createComplexLife(root){
 const life=new THREE.Group();life.name='Clouds, birds and neighbourhood life';root.add(life);
 const cloudMat=new THREE.MeshStandardMaterial({color:0xf5f8fa,roughness:1,transparent:true,opacity:.67,depthWrite:false});
 const puffGeo=new THREE.SphereGeometry(1,12,8),clouds=[];
 for(let i=0;i<7;i++){
  const g=new THREE.Group();g.name='Drifting cloud';
  for(const [x,y,z,sx,sy,sz]of [[-12,0,0,13,4.2,7],[-3,2,1,11,6,8],[7,1,-2,12,5,7],[17,-1,0,9,3.4,6],[-1,-2,6,17,2.5,5]]){const m=new THREE.Mesh(puffGeo,cloudMat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);}
  g.position.set(-50+i*40,140+(i%3)*11,150+(i%3)*35);g.scale.setScalar(.55+(i%3)*.14);life.add(g);clouds.push({g,x:g.position.x,z:g.position.z,speed:1.4+(i%3)*.35});
 }
 const birdMat=new THREE.MeshStandardMaterial({color:0x34434b,roughness:1,side:THREE.DoubleSide}),wingGeo=new THREE.BufferGeometry();
 wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.08,.95,0,-.12,.48,0,-.43],3));wingGeo.computeVertexNormals();
 const birdBodyGeo=new THREE.SphereGeometry(.13,6,4),birds=[];
 for(let i=0;i<9;i++){const g=new THREE.Group();g.name='Bird in flight';const body=new THREE.Mesh(birdBodyGeo,birdMat);body.scale.set(.6,.6,2.2);g.add(body);const l=new THREE.Mesh(wingGeo,birdMat),r=new THREE.Mesh(wingGeo,birdMat);l.scale.x=-1;g.add(l,r);g.scale.setScalar(1.05+(i%3)*.14);life.add(g);birds.push({g,l,r,phase:i*.57,flap:4.5+i%3,height:106+(i%4)*6});}
 const pathMat=new THREE.MeshStandardMaterial({color:0xd7d4c8,roughness:1}),makeActor=createLifeActorFactory(),actors=[];
 for(const [role,count]of Object.entries(populationRoles))for(let i=0;i<count;i++){const actor=makeActor(role,i);life.add(actor.g);actors.push(actor);}
 const walkers=actors.filter(actor=>actor.person),ownedGeometries=new Set(),ownedMaterials=new Set([pathMat]),buckets=new Map();
 const skyGeometries=new Set([puffGeo,wingGeo,birdBodyGeo]);
 life.traverse(o=>{
  if(!o.isMesh)return;ownedGeometries.add(o.geometry);ownedMaterials.add(o.material);
  const palette=!!o.userData.actorPalette,surface=o.material.userData.actorSurface??'fabric',key=o.geometry.uuid+':'+(palette?surface:o.material.uuid);
  let bucket=buckets.get(key);
  if(!bucket){const material=palette?o.material.clone():o.material;if(palette){material.color.set(0xffffff);ownedMaterials.add(material);}bucket={geometry:o.geometry,material,palette,objects:[],owners:[],sky:skyGeometries.has(o.geometry)};buckets.set(key,bucket);}
  let owner=o;while(owner.parent&&owner.parent!==life)owner=owner.parent;
  bucket.objects.push(o);bucket.owners.push(owner);o.visible=false;
 });
 for(const bucket of buckets.values()){
  bucket.cachedMatrices=new Float32Array(bucket.objects.length*16);bucket.cachedDisplay=new Uint8Array(bucket.objects.length);bucket.cachedColors=bucket.palette?new Float32Array(bucket.objects.length*3):null;
  const mesh=bucket.mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.objects.length);mesh.name=bucket.sky?'Batched animated sky':'Batched articulated neighbourhood parts';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(bucket.palette)bucket.objects.forEach((o,i)=>mesh.setColorAt(i,o.material.color));
  mesh.castShadow=!bucket.sky&&bucket.objects.some(o=>o.castShadow);mesh.receiveShadow=!bucket.sky;mesh.frustumCulled=false;mesh.userData.noAutomaticCollider=true;mesh.userData.populationBatch=!bucket.sky;
  if(bucket.sky)mesh.userData.excludeFromSolarShadow=true;life.add(mesh);
 }
 const inverse=new THREE.Matrix4(),instanceMatrix=new THREE.Matrix4(),wind=new THREE.Vector3(),sample={},dogSample={};
 let enabled=true,elapsed=0,lastSeconds=null,viewer=null,nav=null,disposed=false,quality={id:'full',...QUALITY.full,reducedMotion:false},lastUpload=-Infinity,skyVisible=true,seatingVisible=true;
 let weather={cloudCover:35,windDirection:225,windSpeed:2},routes=[],navigationRevision=0;
 function sampleAt(actor,distance,out){return nav.sampleRoute(actor.route,foldedDistance(distance,actor.route.length)/actor.route.length,out);}
 function safeSegment(world,from,to){const n=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.12));for(let i=1;i<=n;i++){const t=i/n;if(!world.free(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t))return false;}return true;}
 function assignQuality(){
  for(const [role]of Object.entries(populationRoles)){
   const list=actors.filter(a=>a.role===role),limit=Math.max(1,Math.ceil(list.length*quality.population));
   list.forEach((a,i)=>{a.qualityVisible=i<limit;a.g.userData.qualityVisible=a.qualityVisible;});
  }
 }
 function fallbackRoutes(radius){
  const result=[],world=nav.worldForRadius(radius),seeds=nav.routes?.flatMap(route=>route.points.slice(0,2))??[];
  for(const seed of seeds.slice(0,8)){
   const start=nav.nearest(seed,{radius,maxDistance:5});if(!start)continue;
   for(const offset of [[8,0],[0,8],[-8,0],[0,-8]]){
    const target=nav.nearest([start.x+offset[0],start.z+offset[1]],{radius,maxDistance:3});if(!target)continue;
    const points=nav.planPath(start,target,{radius,maxDistance:0});if(!points||points.length<2)continue;
    const route=pointRoute('local-safe-'+radius+'-'+result.length,points,radius);if(route.length>4&&nav.validateRoute(route,{radius})&&world.free(...points[0])){result.push(route);break;}
   }
   if(result.length>=2)break;
  }
  return result;
 }
 function setNavigation(value){
  if(disposed)return;nav=value;navigationRevision++;routes=nav?.routes??[];
  const sets=new Map();
  for(const radius of [.48,.75,.95]){let candidates=(nav?.routesForRadius?.(radius)??routes).filter(r=>r.length>(radius===.95?24:6)&&(!nav.validateRoute||nav.validateRoute(r,{radius})));if(nav&&!candidates.length)candidates=fallbackRoutes(radius);sets.set(radius,candidates);}
  for(const actor of actors){
   actor.active=false;actor.blocked=false;actor.route=null;actor.g.userData.active=false;
   if(!nav)continue;
   if(actor.role==='seated'){
    const bench=nav.benches?.[Math.floor(actor.index/2)];if(!bench)continue;
    const side=actor.index%2?.48:-.48,c=Math.cos(bench.yaw),s=Math.sin(bench.yaw),x=bench.point[0]+c*side,z=bench.point[1]-s*side;
    // Centres follow the actual bench's circular seat, facing its open side.
    const bow=.07,surfaceHeight=bench.surfaceHeight??bench.height-(bench.owner==='cyberCourtyard'?.01:0);actor.g.position.set(x+s*bow,surfaceHeight-.805,z+c*bow);actor.g.rotation.y=bench.yaw;actor.bench=bench;actor.seatSurfaceHeight=surfaceHeight;
    const shoeSurface=frontageGroundHeight(actor.g.position.x,actor.g.position.z)+.035;actor.seatedThighAngle=Math.acos(THREE.MathUtils.clamp((surfaceHeight-shoeSurface-.369)/.43,-1,1));actor.active=true;actor.g.userData.active=true;continue;
   }
   const candidates=sets.get(actor.radius);if(!candidates?.length)continue;
   actor.route=candidates[actor.index%candidates.length];actor.world=nav.worldForRadius(actor.radius);const offset={walker:.13,runner:.41,dogwalker:.67,cyclist:.24,courier:.83,robot:.57}[actor.role]??.17;actor.distance=((actor.index*.381966+offset)%1)*actor.route.length;actor.direction=actor.index%3===0?-1:1;actor.motionTime=actor.distance/actor.speed;
   sampleAt(actor,actor.distance,sample);actor.g.position.set(sample.x,sample.y??frontageGroundHeight(sample.x,sample.z)+.035,sample.z);actor.g.rotation.y=Math.atan2(sample.dx*actor.direction,sample.dz*actor.direction);
   actor.active=actor.world.free(sample.x,sample.z);actor.g.userData.active=actor.active;
  }
  assignQuality();lastUpload=-Infinity;renderFrame();
 }
 function setQuality(profile){
  const options=typeof profile==='string'?{id:profile}:profile??{},id=QUALITY[options.id]?options.id:'balanced',defaults=QUALITY[id];
  const population=Number(options.population??options.populationFraction??defaults.population),updateHz=Number(options.updateHz??defaults.updateHz);
  const next={id,population:THREE.MathUtils.clamp(Number.isFinite(population)?population:defaults.population,.15,1),updateHz:THREE.MathUtils.clamp(Number.isFinite(updateHz)?updateHz:defaults.updateHz,8,60),reducedMotion:!!options.reducedMotion};
  if(next.id===quality.id&&next.population===quality.population&&next.updateHz===quality.updateHz&&next.reducedMotion===quality.reducedMotion)return;
  quality=next;assignQuality();lastUpload=-Infinity;renderFrame();
 }
 function setSeatingVisible(value){
  if(disposed)return false;const next=!!value;if(next===seatingVisible)return false;seatingVisible=next;
  // The courtyard switch is independent of the animation clock. Rebuild its
  // submitted instances immediately, including while the landscape is paused.
  for(const actor of actors){if(actor.role!=='seated')continue;actor.g.userData.seatingHidden=!seatingVisible;actor.g.visible=seatingVisible;actor.g.userData.ownerHidden=!!actor.bench?.owner&&nav?.model?.[actor.bench.owner]?.visible===false;}
  submitInstances(true);return true;
 }
 function placeDog(actor){
  if(!actor.dog||!actor.route)return;const previous=actor.distance-actor.direction*.78;sampleAt(actor,previous,dogSample);
  const dx=dogSample.x-actor.g.position.x,dz=dogSample.z-actor.g.position.z,c=Math.cos(actor.g.rotation.y),s=Math.sin(actor.g.rotation.y);
  actor.dog.g.position.set(c*dx-s*dz,(dogSample.y??frontageGroundHeight(dogSample.x,dogSample.z)+.035)-actor.g.position.y,s*dx+c*dz);
  const sign=travelDirection(actor,previous);actor.dog.g.rotation.y=Math.atan2(dogSample.dx*sign,dogSample.dz*sign)-actor.g.rotation.y;
  const headX=actor.dog.g.position.x+Math.sin(actor.dog.g.rotation.y)*.29,headZ=actor.dog.g.position.z+Math.cos(actor.dog.g.rotation.y)*.29;
  alignCoordinates(actor.dog.leash,-.22,.96,.25,headX,actor.dog.g.position.y+.60,headZ);
  actor.dog.worldPosition??=new THREE.Vector3();actor.dog.worldPosition.set(dogSample.x,dogSample.y??frontageGroundHeight(dogSample.x,dogSample.z)+.035,dogSample.z);
 }
 function renderFrame(){
  if(disposed)return;
  for(const actor of actors){
   actor.g.userData.seatingHidden=actor.role==='seated'&&!seatingVisible;actor.g.visible=!actor.g.userData.seatingHidden;
   actor.g.userData.hideNearViewer=!!viewer&&viewer.y<12&&Math.hypot(actor.g.position.x-viewer.x,actor.g.position.z-viewer.z)<2.2;
   actor.g.userData.active=actor.active;
   if(!actor.active)continue;
   poseLifeActor(actor,elapsed,{reducedMotion:quality.reducedMotion,moving:!actor.blocked});placeDog(actor);
   if(actor.role==='seated'&&actor.bench?.owner&&nav?.model?.[actor.bench.owner]?.visible===false)actor.g.userData.ownerHidden=true;else actor.g.userData.ownerHidden=false;
  }
  life.updateMatrixWorld(true);inverse.copy(life.matrixWorld).invert();
  submitInstances(false);lastUpload=elapsed;
 }
 function submitInstances(seatingOnly){
  for(const bucket of buckets.values()){
   let written=0;
   for(let i=0;i<bucket.objects.length;i++){
    const owner=bucket.owners[i];
    let visible;
    if(seatingOnly){visible=owner.userData.role==='seated'?owner.userData.active!==false&&owner.userData.qualityVisible!==false&&!owner.userData.hideNearViewer&&!owner.userData.ownerHidden&&!owner.userData.seatingHidden:!!bucket.cachedDisplay[i];instanceMatrix.fromArray(bucket.cachedMatrices,i*16);}
    else {visible=bucket.sky||!(owner.userData.active===false||owner.userData.qualityVisible===false||owner.userData.hideNearViewer||owner.userData.ownerHidden||owner.userData.seatingHidden);if(!visible&&owner.userData.role!=='seated'){bucket.cachedDisplay[i]=0;continue;}instanceMatrix.multiplyMatrices(inverse,bucket.objects[i].matrixWorld);instanceMatrix.toArray(bucket.cachedMatrices,i*16);if(bucket.palette)bucket.objects[i].material.color.toArray(bucket.cachedColors,i*3);}
    bucket.cachedDisplay[i]=Number(visible);if(!visible)continue;
    bucket.mesh.setMatrixAt(written,instanceMatrix);
    if(bucket.palette){const colors=bucket.mesh.instanceColor.array;for(let c=0;c<3;c++)colors[written*3+c]=bucket.cachedColors[i*3+c];}written++;
   }
   // Compact the visible instances: economy profiles reduce actual submitted
   // vertices instead of merely collapsing hidden people to zero-size meshes.
   bucket.mesh.count=written;if(bucket.palette)bucket.mesh.instanceColor.needsUpdate=true;
   bucket.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 function update(seconds){
  if(disposed||!Number.isFinite(seconds))return;const dt=lastSeconds===null||!enabled?0:Math.max(0,Math.min(.08,seconds-lastSeconds));lastSeconds=seconds;elapsed+=dt;
  if(dt>0){
   const d=direction(weather.windDirection+180,0,Math.max(.4,weather.windSpeed*.5));wind.set(...d);
   for(const cloud of clouds){cloud.g.position.x=((cloud.x+220+elapsed*wind.x*cloud.speed)%440+440)%440-220;cloud.g.position.z=((cloud.z+220+elapsed*wind.z*cloud.speed)%440+440)%440-220;}
   for(const bird of birds){const angle=elapsed*.08+bird.phase;bird.g.position.set(Math.sin(angle)*95,bird.height+Math.sin(angle*2)*3,Math.cos(angle)*79-20);bird.g.rotation.y=Math.atan2(Math.cos(angle)*95,-Math.sin(angle)*79);bird.g.rotation.z=Math.sin(angle)*.14;const flap=Math.sin(elapsed*bird.flap+bird.phase)*.65;bird.l.rotation.z=-flap;bird.r.rotation.z=flap;}
   for(const actor of actors){
    if(!actor.active||!actor.route)continue;
    const next=actor.distance+actor.direction*actor.speed*dt;sampleAt(actor,next,sample);
    let dogSafe=true;if(actor.dog){sampleAt(actor,next-actor.direction*.78,dogSample);dogSafe=actor.world.free(dogSample.x,dogSample.z)&&(!actor.dog.worldPosition||safeSegment(actor.world,actor.dog.worldPosition,dogSample));}
    if(dogSafe&&safeSegment(actor.world,actor.g.position,sample)){
     actor.distance=next;actor.motionTime+=dt;actor.g.position.set(sample.x,sample.y??frontageGroundHeight(sample.x,sample.z)+.035,sample.z);actor.blocked=false;
     const travelSign=travelDirection(actor,next),target=Math.atan2(sample.dx*travelSign,sample.dz*travelSign);actor.g.rotation.y+=angleDelta(target,actor.g.rotation.y)*Math.min(1,dt*10);
    }else {actor.blocked=true;actor.direction*=-1;}
   }
  }
  // Movement integrates on every frame; articulated matrices upload at the
  // chosen cadence. Paused landscapes keep their exact clock and limb pose.
  let visibilityChanged=false;
  for(const actor of actors){const hidden=!!viewer&&viewer.y<12&&Math.hypot(actor.g.position.x-viewer.x,actor.g.position.z-viewer.z)<2.2,ownerHidden=actor.role==='seated'&&actor.bench?.owner&&nav?.model?.[actor.bench.owner]?.visible===false;if(hidden!==!!actor.g.userData.hideNearViewer||!!ownerHidden!==!!actor.g.userData.ownerHidden){visibilityChanged=true;break;}}
  if(dt>0&&elapsed-lastUpload>=1/quality.updateHz||lastUpload===-Infinity||visibilityChanged)renderFrame();
 }
 for(const bird of birds){const angle=bird.phase;bird.g.position.set(Math.sin(angle)*95,bird.height+Math.sin(angle*2)*3,Math.cos(angle)*79-20);bird.g.rotation.y=Math.atan2(Math.cos(angle)*95,-Math.sin(angle)*79);}
 assignQuality();renderFrame();
 return{
  pathMaterial:pathMat,group:life,clouds,birds,walkers,actors,update,setNavigation,setQuality,setSeatingVisible,
  get routes(){return routes;},
  setViewer(camera){viewer=camera?.position??null;},
  setSkyVisible(value){skyVisible=!!value;for(const bucket of buckets.values())if(bucket.sky)bucket.mesh.visible=skyVisible;},
  setEnabled(value){enabled=!!value;},
  setWeather(value){weather={...weather,...value};cloudMat.opacity=Math.max(0,Math.min(.85,weather.cloudCover/100*.8));},
  get enabled(){return enabled;},get time(){return elapsed;},
  get stats(){const roles={};for(const role of Object.keys(populationRoles)){const list=actors.filter(a=>a.role===role);roles[role]={total:list.length,active:list.filter(a=>a.active).length,visible:list.filter(a=>a.active&&a.qualityVisible&&(role!=='seated'||seatingVisible&&!a.g.userData.ownerHidden&&!a.g.userData.hideNearViewer)).length,blocked:list.filter(a=>a.blocked).length};}return{roles,actors:actors.length,active:actors.filter(a=>a.active).length,drawBatches:buckets.size,actorDrawBatches:[...buckets.values()].filter(b=>!b.sky).length,quality:{...quality},navigationRevision,routes:routes.length,skyVisible,seatingVisible};},
  dispose(){if(disposed)return;disposed=true;root.remove(life);for(const geometry of ownedGeometries)geometry.dispose();for(const material of ownedMaterials)material.dispose();for(const bucket of buckets.values())bucket.mesh.dispose();nav=null;},
 };
}
