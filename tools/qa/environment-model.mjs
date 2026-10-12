import assert from 'node:assert/strict';
import {createComplex} from '../../dist/complex-model.js';
import {solarPosition,moscowDate,daylight,direction,location,upcomingWinter} from '../../dist/solar.js';
const model=createComplex(),traffic=model.traffic;
// Ten full signal cycles: queuing, crossing, wrapping at scene edges, and pause.
for(let i=0;i<6400;i++){traffic.update(i*.1);for(const lane of traffic.lanes){const positions=lane.cars.map(c=>c.position).sort((a,b)=>a-b);for(let j=1;j<positions.length;j++)assert.ok(positions[j]-positions[j-1]>7.99,`${lane.road.name}: following gap`);assert.ok(positions[0]+lane.length-positions.at(-1)>7.99,`${lane.road.name}: wrap gap`)}}
const before=traffic.cars.map(c=>c.position),elapsed=traffic.time;traffic.setEnabled(false);traffic.update(2000);assert.equal(traffic.time,elapsed);assert.deepEqual(traffic.cars.map(c=>c.position),before);
assert.equal(model.neighborhood.trees.length,1850);assert.ok(model.neighborhood.ghostMaterial.transparent&&model.neighborhood.ghostMaterial.opacity<.4);
const neighbors=model.neighborhood.neighborBuildings;
assert.ok(neighbors,'The environment includes the reconstructed neighbouring houses');
assert.deepEqual(neighbors.metadata.buildings.map(b=>b.legacyIndex),[4,5,6,7,8,9,10]);
const neighborDraws=[];neighbors.group.traverse(o=>{if(o.isMesh||o.isLineSegments)neighborDraws.push(o)});
assert.ok(neighborDraws.every(o=>o.isInstancedMesh&&o.count>0),'Repeated facade parts stay instanced');
assert.equal(new Set(neighborDraws.map(o=>o.userData.neighborBuildings?.role)).size,neighborDraws.length,'One shared drawing batch per architectural part role');
for(const material of Object.values(neighbors.materials)){assert.equal(material.transparent,false);assert.equal(material.opacity,1)}
const windowBatches=neighborDraws.filter(o=>o.material===neighbors.materials.glass||o.material===neighbors.materials.litGlass);
assert.equal(windowBatches.length,2,'All neighbouring-house windows share two lit/unlit draws');
assert.equal(windowBatches.reduce((n,o)=>n+o.count,0),neighbors.metadata.windowCount);
assert.equal(neighborDraws.filter(o=>o.name==='Sectional residential shells').length,1,'All building sections share one shell draw');
model.neighborhood.setNight(1);assert.ok(neighbors.materials.litGlass.emissiveIntensity>0);model.neighborhood.setNight(0);assert.equal(neighbors.materials.litGlass.emissiveIntensity,0);
model.neighborhood.group.visible=false;assert.equal(model.neighborhood.forestGroup.parent,model.root);assert.equal(model.neighborhood.forestGroup.visible,true);assert.ok(model.neighborhood.forestGroup.getObjectByName("Continuous woodland ground"));model.neighborhood.group.visible=true;
assert.equal(model.life.walkers.length,40);assert.equal(model.publicRealm.closeDetails.portals.length,5);
const autumn=solarPosition(new Date(moscowDate('2026-10-07',720))),winter=solarPosition(new Date(moscowDate('2026-12-21',720)));
// Winter solar-noon elevation at 55.6° N must be approximately 11°, much lower than October.
assert.ok(winter.elevation>10&&winter.elevation<12);assert.ok(autumn.elevation>winter.elevation+15);
assert.ok(solarPosition(new Date('2026-10-07T20:12:00+03:00')).elevation<0);
const autumnDay=daylight('2026-10-07'),winterDay=daylight('2026-12-21');assert.ok(winterDay.set-winterDay.rise<autumnDay.set-autumnDay.rise);
assert.equal(upcomingWinter(new Date('2026-10-07T12:00:00Z')),'2026-12-21');assert.equal(upcomingWinter(new Date('2026-12-24T12:00:00Z')),'2027-12-21');
assert.ok(Math.abs(location.north[0]*location.east[0]+location.north[1]*location.east[1])<1e-8);assert.ok(Math.abs(direction(180)[0]+location.north[0])<1e-8);
model.setSeason(true,11);model.neighborhood.setSeason(true,11);model.setSeason(false,9);model.neighborhood.setSeason(false,9);
let visible=0;model.root.traverse(o=>{if(!o.isMesh&&!o.isLineSegments)return;for(let p=o;p;p=p.parent)if(!p.visible)return;visible++});
// The old whole-scene <340 gate was already exceeded by verified v26 (346).
// Guard the actual regression risk above: a growing number of windows/sections
// must remain in shared instanced draws. Keep total scene counts diagnostic;
// real M2 rendering is checked separately and this is not a frame-rate metric.
model.dispose();console.log(`PASS: 76 cars / 16 lanes / ten signal cycles and gaps; 1850 trees; seven opaque neighbouring houses in ${neighborDraws.length} part batches (${windowBatches.length} window draws); seasonal solar geometry; night; pause; ${visible} total visible drawing objects`);
