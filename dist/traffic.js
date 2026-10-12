// @r_peredelkino · Traffic follows the same georeferenced lane graph as markings.
// The protected light cycle is illustrative, never claimed as an actual program.
import {trafficPresets} from './traffic-scenarios.js?v=community38';
import * as THREE from './vendor/three.module.js';
import {metersToModel} from './geo-reference.js?v=community38';
import {trafficPaths,signalAt,signalPlan,roadElevation,samplePolyline,transportMetadata} from './transport-data.js?v=community38';
import {createTransportInfrastructure} from './transport-infrastructure.js?v=community38';
import {createVehicleModels} from './vehicle-models-v38.js?v=community38';
const M=metersToModel,clamp=THREE.MathUtils.clamp;
function hash(n){let a=Math.imul(n^0x986daa,0x45d9f3b);a=Math.imul(a^(a>>>16),0x45d9f3b);return((a^(a>>>16))>>>0)/4294967296;}
function toWorld([e,n],y=roadElevation){return new THREE.Vector3(e*-.69716+n*.71691,y,e*.71691+n*.69716);}
export function signalState(type,_junction,seconds){return signalAt(type==='street'?'street':type==='pedestrian'?'pedestrian':'main',Number(seconds)||0);}

export function createTraffic(root,infrastructure=null){
 const ownsInfrastructure=!infrastructure,transport=infrastructure||createTransportInfrastructure(root);
 const group=new THREE.Group();group.name='Directed traffic on OSM roads, smooth permitted connectors and protected phases';root.add(group);
 const lanes=trafficPaths.map(p=>({...p,cars:[],nextIds:p.nextIds.slice(),stops:p.stops.slice()})),pathById=new Map(lanes.map(p=>[p.id,p]));
 const incoming=new Map();for(const p of lanes)for(const id of p.nextIds){if(!incoming.has(id))incoming.set(id,[]);incoming.get(id).push(p.id);}
 const general=lanes.filter(p=>!p.psv);
 const entryLanes=general.filter(p=>p.kind==='lane'&&p.length>M(25)&&!(incoming.get(p.id)||[]).some(id=>!pathById.get(id).psv));
 const sourceLanes=entryLanes.length?entryLanes:general.filter(p=>p.kind==='lane'&&p.length>M(150));
 const cars=[],signals=transport.signalHeads;
 for(const lane of general.filter(l=>l.kind==='lane'&&l.road.type!=='link'&&l.length>M(34))){
  const count=Math.min(6,Math.max(1,Math.floor(lane.length/M(lane.road.type==='highway'?66:78))));
  for(let k=0;k<count;k++){
   const index=cars.length,seed=index*97+19,suv=hash(seed+4)>.69,position=(k+.27+hash(seed+1)*.39)*lane.length/count,speedFactor=.78+hash(seed)*.22;
   const car={lane,position,speedFactor,desiredSpeed:lane.speed*speedFactor,velocity:lane.speed*speedFactor*(.45+hash(seed+2)*.4),
    acceleration:M(1.3+hash(seed+3)*.8),brake:M(3.7+hash(seed+4)*1.4),reaction:.25+hash(seed+5)*.5,
    index,seed,length:M(suv?4.9:4.5),height:suv?1.12:1,spin:hash(seed)*6,waiting:false,launchAt:0,braking:false,
    world:new THREE.Vector3(),heading:0,nextPathId:null,routeVersion:0,committedStops:new Set(),transitionCount:0,respawnCount:0,active:true};
   Object.defineProperties(car,{speed:{get(){return this.velocity}},angle:{get(){return this.heading}}});car.targetSpeed=car.desiredSpeed;lane.cars.push(car);cars.push(car);
  }
 }
 const vehicleModels=createVehicleModels(group,cars);
 const mergeReservations=new Map();let time=0,last=null,enabled=true,night=0,scenario={period:'day',weather:'clear',density:.7,speed:1};

 function chooseNext(car,path=car.lane){
  if(path===car.lane&&car.nextPathId)return pathById.get(car.nextPathId);
  const options=path.nextIds.map(id=>pathById.get(id)).filter(p=>p&&!p.psv);if(!options.length)return null;
  const weights=options.map(p=>p.kind==='connector'&&p.turn!=='through'?1:3),total=weights.reduce((a,b)=>a+b,0);let pick=hash(car.seed+car.routeVersion*557+path.sourceWayId)*total,index=0;
  while(index<options.length-1&&pick>=weights[index])pick-=weights[index++];const next=options[index];if(path===car.lane)car.nextPathId=next.id;return next;
 }
 function frontGap(path,position,car,skip=null){
  let result=Infinity;for(const other of path.cars){if(!other.active||other===car||other===skip)continue;if(other.position>=position-M(.01))result=Math.min(result,other.position-position-(other.length+car.length)/2-M(1.65));}return result;
 }
 function lookAhead(car){
  let available=frontGap(car.lane,car.position,car),distance=car.lane.length-car.position,path=car.lane;
  for(let i=0;i<5&&distance<M(80);i++){
   const next=chooseNext(car,path);if(!next)break;
   const gap=frontGap(next,0,car);if(Number.isFinite(gap))available=Math.min(available,distance+gap);
   distance+=next.length;path=next;
  }
  return Math.max(0,available);
 }
 function moveTo(car,path,position){
  const old=car.lane,index=old.cars.indexOf(car);if(index>=0)old.cars.splice(index,1);car.lane=path;path.cars.push(car);car.position=position;car.nextPathId=null;car.routeVersion++;car.committedStops.clear();car.transitionCount++;
 }
 function respawn(car){
  for(let i=0;i<sourceLanes.length;i++){
   const path=sourceLanes[(Math.floor(hash(car.seed+car.routeVersion*71)*sourceLanes.length)+i)%sourceLanes.length],position=car.length/2+M(.3);
   if(frontGap(path,position,car)<M(10))continue;
   moveTo(car,path,position);car.velocity=Math.min(car.velocity,path.speed*.55);car.respawnCount++;return true;
  }
  return false;
 }
 function integrate(dt){
  for(const [id,reservation] of mergeReservations){const car=reservation.car;if(!reservation.pathIds.has(car.lane.id)||(car.lane.id===(reservation.targetId||id)&&car.position>car.length/2+M(3)))mergeReservations.delete(id);}
  // Front-to-back ordering lets a following car see its leader's updated
  // position. Entry checks also give merging cars a gap in their actual target.
  const ordered=cars.filter(c=>c.active).sort((a,b)=>a.lane.id===b.lane.id?b.position-a.position:a.index-b.index);
  for(const c of ordered){
   let available=lookAhead(c),target=c.lane.speed*c.speedFactor*scenario.speed;
   const upcoming=chooseNext(c);if(upcoming)target=Math.min(target,Math.sqrt((upcoming.speed*c.speedFactor*scenario.speed)**2+2*c.brake*Math.max(0,c.lane.length-c.position-M(2))));
   if(c.lane.kind==='lane'){
    const connector=chooseNext(c),destination=connector?.kind==='connector'?pathById.get(connector.toId):connector;
    // Departures initially share the same physical channel even when the two
    // cars choose different branches. Hold a following car until the first
    // rear bumper has cleared its turn, rather than treating it as vanished.
    if(destination&&c.lane.nextIds.filter(id=>!pathById.get(id).psv).length>1){
     const key=`split:${c.lane.id}`,gateAt=Math.max(M(1),c.lane.length-M(3)),gap=gateAt-c.position-c.length/2-M(.5),held=mergeReservations.get(key);
     const blockedSignal=c.lane.stops.some(s=>s.at>=c.position+c.length/2&&s.at<=gateAt+M(1)&&signalAt(s.flow,time)!=='green');
     if(!held&&gap<M(22)&&!blockedSignal)mergeReservations.set(key,{car:c,targetId:destination.id,pathIds:new Set([c.lane.id,connector.id,destination.id])});
     if(held&&held.car!==c)available=Math.min(available,Math.max(0,gap));
    }
    if(destination&&(incoming.get(destination.id)||[]).filter(id=>!pathById.get(id).psv).length>1){
     const gateAt=Math.max(M(1),c.lane.length-M(11)),gap=gateAt-c.position-c.length/2-M(.5),held=mergeReservations.get(destination.id);
     const blockedSignal=c.lane.stops.some(s=>s.at>=c.position+c.length/2&&s.at<=gateAt+M(1)&&signalAt(s.flow,time)!=='green');
     if(!held&&gap<M(25)&&!blockedSignal)mergeReservations.set(destination.id,{car:c,pathIds:new Set([c.lane.id,connector.id,destination.id])});
     if(held&&held.car!==c)available=Math.min(available,Math.max(0,gap));
    }
   }
   for(const stop of c.lane.stops){
    const distance=stop.at-c.position-c.length/2-M(.4);if(distance< -M(.05)||c.committedStops.has(stop.id))continue;
    const state=signalAt(stop.flow,time),commit=state==='amber'&&distance<c.velocity*1.25&&c.velocity>M(.8);
    if(commit)c.committedStops.add(stop.id);else if(state!=='green')available=Math.min(available,Math.max(0,distance));
   }
   target=Math.min(target,Math.sqrt(2*c.brake*Math.max(0,available)));
   if(target<M(.1)&&c.velocity<M(.15)){c.waiting=true;c.launchAt=Infinity;}else if(c.waiting&&target>M(.5)){c.waiting=false;c.launchAt=time+c.reaction;}
   if(time<c.launchAt&&Number.isFinite(c.launchAt))target=0;c.targetSpeed=target;c.desiredSpeed=c.lane.speed*c.speedFactor*scenario.speed;
   const previous=c.velocity;c.velocity=clamp(c.velocity+clamp(target-c.velocity,-c.brake*dt,c.acceleration*dt),0,c.desiredSpeed);const advance=Math.min(available,c.velocity*dt);c.position+=Math.max(0,advance);if(advance<c.velocity*dt-1e-6)c.velocity=0;c.braking=c.velocity<previous-M(.015);c.spin+=advance/M(.34);
   for(let transitions=0;c.position>=c.lane.length&&transitions<6;transitions++){
    const next=chooseNext(c),over=c.position-c.lane.length;
    if(!next){if(!respawn(c)){c.position=c.lane.length-M(.02);c.velocity=0;}break;}
    const startGap=frontGap(next,0,c);if(startGap<c.length/2+M(.2)){c.position=c.lane.length-M(.02);c.velocity=0;break;}
    moveTo(c,next,Math.min(over,next.length-M(.001)));
   }
  }
 }
 function render(){
  for(const c of cars){
   if(!c.active)continue;
   const p=samplePolyline(c.lane.pointsEN,c.lane.cumulative,c.position);c.world.copy(toWorld(p.point));const d=toWorld(p.direction,0);c.heading=Math.atan2(d.x,d.z);
  }
  vehicleModels.render();transport.setSignalTime(time);
 }

 function update(seconds){
  if(!Number.isFinite(seconds))return;const dt=last===null?0:enabled?clamp(seconds-last,0,.25):0;last=seconds;
  if(dt>0){const steps=Math.ceil(dt/.04),h=dt/steps;for(let i=0;i<steps;i++){time+=h;integrate(h);}}render();
 }
 function setEnabled(value){enabled=!!value;}
 function setNight(value){night=clamp(Number(value)||0,0,1);vehicleModels.setNight(night);}
 function setScenario({period='day',weather='clear'}={}){
  const preset=trafficPresets[period];if(!preset)throw new RangeError('Unknown traffic period');
  scenario={period,weather,density:preset.density,speed:preset.speed*(weather==='rain'?.75:weather==='snow'?.55:1)};
  mergeReservations.clear();
  for(const c of cars){const wanted=hash(c.seed+721)<scenario.density;
   if(c.active&&!wanted){const i=c.lane.cars.indexOf(c);if(i>=0)c.lane.cars.splice(i,1);c.active=false;c.velocity=0;}
   else if(!c.active&&wanted){if(c.lane.cars.every(o=>!o.active||Math.abs(o.position-c.position)>(o.length+c.length)/2+M(4))){c.lane.cars.push(c);c.active=true;c.velocity=0;}else if(respawn(c)){c.active=true;c.velocity=0;}}
  }
  group.userData.traffic.scenario={...scenario,measuredDemand:false};group.userData.traffic.vehicleModels=vehicleModels.getStats();render();
 }
 function getScenario(){return{...scenario,activeCars:cars.filter(c=>c.active).length,poolCars:cars.length,measuredDemand:false};}
 function setQuality(profile){vehicleModels.setQuality(profile);const stats=vehicleModels.getStats();group.userData.traffic.drawCalls=stats.drawCalls;group.userData.traffic.vehicleModels=stats;}
 function getStats(){return{...getScenario(),...vehicleModels.getStats(),lanePaths:lanes.length,signalTime:time,simulationOnly:true};}
 let disposed=false;
 function dispose(){if(disposed)return;disposed=true;root.remove(group);vehicleModels.dispose();if(ownsInfrastructure)transport.dispose();}
 group.userData.traffic={version:38,source:transportMetadata.source,lanePaths:lanes.length,cars:cars.length,drawCalls:vehicleModels.getStats().drawCalls,vehicleModels:vehicleModels.getStats(),sourceEntryLanes:sourceLanes.length,
  simulationOnly:true,signalTimingSource:signalPlan.source,routePolicy:transportMetadata.trafficScope,
  reservedLanePolicy:'No ordinary vehicle spawns in, follows, or ends a connector in a lane tagged as PSV; right-hand position is inferred.',
  stopPolicy:'Front bumper stops upstream of shared stop-line data; committed amber vehicles may clear; merge traffic yields to occupied target lanes.'};
 update(0);
 return {group,lanes,cars,signals,update,setEnabled,setNight,setScenario,getScenario,setQuality,getStats,dispose,bodies:vehicleModels.bodies[0],bodyMeshes:vehicleModels.bodies,vehicleModels,metadata:group.userData.traffic,get time(){return time},get enabled(){return enabled},get signalPlan(){return signalPlan}};
}
