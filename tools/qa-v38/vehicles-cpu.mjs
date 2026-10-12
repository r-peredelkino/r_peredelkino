import * as THREE from '../../dist/vendor/three.module.js';
import {createTraffic} from '../../dist/traffic.js';
import {trafficPaths,roadElevation,signalAt} from '../../dist/transport-data.js';
import {metersToModel as M} from '../../dist/geo-reference.js';
import {vehicleStyles} from '../../dist/vehicle-models-v38.js';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const checks=[];
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});}
const signalTimes=[],transport={signalHeads:[],setSignalTime(time){signalTimes.push(time);},dispose(){throw new Error('Externally owned transport was disposed');}};
const root=new THREE.Group(),traffic=createTraffic(root,transport),other=createTraffic(new THREE.Group(),{signalHeads:[],setSignalTime(){}});
const snapshot=t=>t.cars.map(c=>[c.index,c.lane.id,c.position,c.velocity,c.active,c.routeVersion,c.nextPathId,c.spin,c.waiting,c.braking]);
const matrixAt=(mesh,index)=>new THREE.Matrix4().fromArray(mesh.instanceMatrix.array,index*16);
const stats=traffic.getStats();
check('Original real road graph and vehicle pool retained',traffic.lanes.length===197&&traffic.cars.length===124,{lanePaths:traffic.lanes.length,cars:traffic.cars.length});
check('Vehicles share exactly sixteen batches',traffic.vehicleModels.meshes.length===16&&stats.drawCalls===16);
check('All four distinct silhouettes are represented',vehicleStyles.every(style=>stats.styles.find(s=>s.id===style.id)?.count>0),stats.styles);
check('Complete real car pool remains under 500,000 triangles',stats.triangles<500_000,{triangles:stats.triangles});
check('All street vehicle parts use InstancedMesh',traffic.vehicleModels.meshes.every(mesh=>mesh.isInstancedMesh));
check('Car paint uses a white multiplier and a readable dielectric response',traffic.bodyMeshes.every(mesh=>mesh.material.color.getHex()===0xffffff&&mesh.material.metalness===.20));
const paintLuminance=[];for(const mesh of traffic.bodyMeshes)for(let index=0;index<mesh.count;index++){const color=new THREE.Color();mesh.getColorAt(index,color);paintLuminance.push(color.r*.2126+color.g*.7152+color.b*.0722);}
check('The darkest display paint remains readable before scene illumination',Math.min(...paintLuminance)>.08,{minimumLinearLuminance:Math.min(...paintLuminance)});
check('Road graph identities and allowed successors untouched',traffic.lanes.every((lane,index)=>lane.id===trafficPaths[index].id&&lane.nextIds.join('|')===trafficPaths[index].nextIds.join('|')&&JSON.stringify(lane.pointsEN)===JSON.stringify(trafficPaths[index].pointsEN)));
check('No ordinary vehicle initially occupies a reserved lane',traffic.cars.every(car=>!car.lane.psv));
check('Old collision lengths retained as conservative envelope',traffic.cars.every(car=>car.length===M(car.height>1?4.9:4.5)&&vehicleStyles[car.vehicleStyleIndex].length<=car.length/M(1)));
for(const mesh of traffic.vehicleModels.meshes){
 check(`${mesh.name}: geometry has finite positions and normals`,['position','normal'].every(key=>Array.from(mesh.geometry.getAttribute(key).array).every(Number.isFinite)));
 check(`${mesh.name}: geometry has a valid positive sphere`,mesh.geometry.boundingSphere?.radius>0&&Number.isFinite(mesh.geometry.boundingSphere.radius));
}
check('Separate tyre tread and five-spoke rim geometry',traffic.vehicleModels.tyres.geometry.getAttribute('position').count>200&&traffic.vehicleModels.rims.geometry.getAttribute('position').count>200);
check('Body and glazing silhouettes vary by vehicle type',new Set(traffic.bodyMeshes.map(mesh=>mesh.geometry.boundingBox.max.y.toFixed(4))).size===4&&new Set(traffic.vehicleModels.glass.map(mesh=>mesh.geometry.boundingBox.max.z.toFixed(4))).size===4);
const beforeQuality=JSON.stringify(snapshot(traffic));
traffic.setQuality('fast');
check('Fast quality reduces appearance draws without removing cars',traffic.getStats().drawCalls===11&&traffic.cars.length===124&&traffic.getStats().activeCars===124);
check('Fast quality keeps all wheels and light pairs',traffic.vehicleModels.tyres.visible&&traffic.vehicleModels.heads.visible&&traffic.vehicleModels.tails.visible);
check('Fast quality hides trim and rims only',traffic.vehicleModels.frames.every(mesh=>!mesh.visible)&&!traffic.vehicleModels.rims.visible&&traffic.bodyMeshes.every(mesh=>mesh.visible));
traffic.setQuality('max');
check('Full quality restores all detailed batches',traffic.getStats().drawCalls===16&&traffic.vehicleModels.frames.every(mesh=>mesh.visible)&&traffic.vehicleModels.rims.visible);
check('Appearance changes never mutate simulation state',JSON.stringify(snapshot(traffic))===beforeQuality);
traffic.setNight(1);traffic.update(0);
check('Night mode brightens actual headlight material',traffic.vehicleModels.heads.material.emissiveIntensity>5);
traffic.setNight(0);traffic.update(0);
check('Day mode restores actual headlight material',traffic.vehicleModels.heads.material.emissiveIntensity===.07);
let allOnLane=true,allUnreserved=true,allFinite=true,observedStopped=false,observedBrake=false,observedClearStop=false;
for(let step=1;step<=1600;step++){
 const seconds=step*.1;traffic.update(seconds);other.update(seconds);
 for(const car of traffic.cars){
  allUnreserved&&=!car.lane.psv;
  allFinite&&=[car.position,car.velocity,car.heading,...car.world.toArray()].every(Number.isFinite)&&car.position>=0&&car.position<car.lane.length+.001;
  // Independently project each rendered centre against every source segment.
  const e=car.world.x*-.69716+car.world.z*.71691,n=car.world.x*.71691+car.world.z*.69716,norm=.69716**2+.71691**2,point=[e/norm,n/norm];let minimum=Infinity;
  for(let j=1;j<car.lane.pointsEN.length;j++){const a=car.lane.pointsEN[j-1],b=car.lane.pointsEN[j],dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));minimum=Math.min(minimum,Math.hypot(point[0]-a[0]-u*dx,point[1]-a[1]-u*dy));}
  allOnLane&&=minimum<1e-5&&Math.abs(car.world.y-roadElevation)<1e-9;
  observedStopped||=car.waiting&&car.velocity<M(.15);observedBrake||=car.braking;observedClearStop||=car.committedStops.size>0;
 }
}
check('Road-following centres remain on the source polyline for 160 simulated seconds',allOnLane);
check('Traffic never enters reserved PSV paths throughout integration',allUnreserved);
check('All integration positions and velocities remain finite and bounded',allFinite);
check('Two independent simulations remain deterministic',JSON.stringify(snapshot(traffic))===JSON.stringify(snapshot(other)));
check('Cars transition through allowed road connectors',traffic.cars.some(car=>car.transitionCount>0));
check('Signal and queue stopping is still active',observedStopped);
check('Actual braking states remain active',observedBrake);
check('Signal clocks are still updated through the transport API',signalTimes.length>1600&&Math.abs(signalTimes.at(-1)-traffic.time)<1e-8);
const sample=traffic.cars.find(car=>car.active),body=traffic.bodyMeshes[sample.vehicleStyleIndex],bodyMatrix=matrixAt(body,sample.vehicleSlot),position=new THREE.Vector3().setFromMatrixPosition(bodyMatrix);
check('Rendered vehicle body follows its own current simulation centre',position.distanceTo(sample.world)<1e-4);
const rimBefore=matrixAt(traffic.vehicleModels.rims,sample.index*4).clone();sample.spin+=.7;traffic.update(160);
check('Wheel travel rotates actual shared rim instances',!matrixAt(traffic.vehicleModels.rims,sample.index*4).equals(rimBefore));
sample.braking=true;traffic.update(160);const brakeColor=new THREE.Color();traffic.vehicleModels.tails.getColorAt(sample.index*2,brakeColor);
check('Braking state lights the corresponding rear instance',brakeColor.r>2&&brakeColor.g<.1);
traffic.setEnabled(false);const paused=JSON.stringify(snapshot(traffic)),pausedTime=traffic.time;traffic.update(1000);traffic.update(1001);
check('Paused traffic freezes positions, wheels, routes and velocity',JSON.stringify(snapshot(traffic))===paused);
check('Paused traffic freezes signal time',traffic.time===pausedTime);
traffic.setEnabled(true);traffic.update(1001.1);
check('Resume advances by current frame only, without a catch-up jump',traffic.time>pausedTime&&traffic.time<pausedTime+.11);
traffic.setScenario({period:'night',weather:'snow'});
const night=traffic.getScenario();
check('Scenario density retains its genuine active and pool counts',night.activeCars<night.poolCars&&night.poolCars===124&&night.weather==='snow');
check('Scenario speed retains snow surface reduction',night.speed===.55);
check('Inactive vehicles hide every model part',traffic.cars.filter(car=>!car.active).every(car=>matrixAt(traffic.bodyMeshes[car.vehicleStyleIndex],car.vehicleSlot).elements[0]===0&&matrixAt(traffic.vehicleModels.tyres,car.index*4).elements[0]===0&&matrixAt(traffic.vehicleModels.heads,car.index*2).elements[0]===0));
traffic.setScenario({period:'morning',weather:'clear'});
check('Morning scenario restores available vehicles without exceeding the source pool',traffic.getScenario().activeCars<=124&&traffic.getScenario().activeCars>night.activeCars);
check('All source signal phase names remain unchanged',['main','street','pedestrian'].every(type=>[0,30,60,90].every(seconds=>['green','amber','red'].includes(signalAt(type,seconds)))));
const released=new Map();for(const resource of [...traffic.vehicleModels.resources.geometries,...traffic.vehicleModels.resources.materials]){released.set(resource,0);resource.addEventListener('dispose',()=>released.set(resource,released.get(resource)+1));}
traffic.dispose();traffic.dispose();other.dispose();
check('Vehicle resources dispose exactly once, including repeat cleanup',Array.from(released.values()).every(count=>count===1),{resources:released.size});
check('Disposal removes traffic model group from its root',!root.children.includes(traffic.group)&&traffic.vehicleModels.meshes.every(mesh=>mesh.parent===null));
const report={revision:38,suite:'vehicles-cpu',pass:checks.every(check=>check.pass),checks,vehicleStats:stats};
if(process.env.RP_QA_OUT){await mkdir(process.env.RP_QA_OUT,{recursive:true});await writeFile(path.join(process.env.RP_QA_OUT,'vehicles-cpu.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
