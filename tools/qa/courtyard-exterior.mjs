import assert from 'node:assert/strict';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {createTourWorld} from '../../dist/walking-tour.js';

const model=createComplex(),courtyard=model.courtyard,world=createTourWorld(model),pavilion=courtyard.playPavilion.metadata;
model.root.updateMatrixWorld(true);
assert.equal(pavilion.roofLoops,2);
assert.equal(pavilion.openToSky,true);
assert.equal(pavilion.archedOpenings,5);
assert.equal(pavilion.roundedOculi,3);
assert.ok(courtyard.loungeCanopy.perforations>150);
assert.equal(courtyard.swings.length,2);
assert.equal(courtyard.revision.fitnessZones,1);
assert.equal(courtyard.data.zones.filter(z=>z.id==='sport').length,1);
assert.deepEqual(pavilion.unsupportedEquipment,[]);
const sceneMeshes=courtyard.group.children;
// The thin fitness shade needs a real underside in the ground-level tour.
const sport=courtyard.data.zones.find(z=>z.id==='sport'),shadePoint=courtyard.revision.programme.shade.center,shadeMeshes=sceneMeshes.filter(o=>o.isMesh&&o.material===courtyard.materials.cyan);
for(const {from,direction,height,normalSign} of [{from:2,direction:1,height:2.57,normalSign:-1},{from:3,direction:-1,height:2.61,normalSign:1}]){
 const ray=new THREE.Raycaster(new THREE.Vector3(shadePoint[0],from,shadePoint[1]),new THREE.Vector3(0,direction,0),0,1),hit=ray.intersectObjects(shadeMeshes,true)[0];
 assert.ok(hit&&Math.abs(hit.point.y-height)<.002,'Fitness shade has its true top and bottom surfaces');assert.ok(hit.face.normal.y*normalSign>.99,'Fitness shade face winding is visible from that side');
}
// Passages must agree in the rendered wall geometry and the walking simulation.
for(const [index,entry] of pavilion.archEntries.entries()){
 const start={x:entry.outside[0],z:entry.outside[1]},delta=[entry.inside[0]-start.x,entry.inside[1]-start.z];
 for(const point of [entry.outside,entry.point,entry.inside])assert.ok(world.free(...point),`Clear arch ${index+1}`);
 const result=world.move(start,...delta);assert.equal(result.blocked,false,`Walk through arch ${index+1}`);
 const from=new THREE.Vector3(start.x,1.68,start.z),to=new THREE.Vector3(...[entry.inside[0],1.68,entry.inside[1]]),ray=new THREE.Raycaster(from,to.clone().sub(from).normalize(),0,from.distanceTo(to));
 assert.equal(ray.intersectObjects(sceneMeshes,true).length,0,`Real opening at eye level ${index+1}`);
}
// Small rounded holes are transparent apertures, while their low solid sill blocks walking.
for(const opening of pavilion.roundWindows){
 const normal=new THREE.Vector3(...opening.normal),center=new THREE.Vector3(...opening.point),ray=new THREE.Raycaster(center.clone().addScaledVector(normal,.75),normal.clone().negate(),0,1.5);
 assert.equal(ray.intersectObjects(sceneMeshes,true).length,0,'Open circular wall aperture');
 assert.equal(world.free(opening.point[0],opening.point[2]),false,'Oculus sill remains solid');
}
// A vertical ray through each sky court must miss all roof surfaces.
for(const ring of pavilion.holes){
 const center=ring.reduce((sum,p)=>[sum[0]+p[0]/ring.length,sum[1]+p[1]/ring.length],[0,0]);
 const ray=new THREE.Raycaster(new THREE.Vector3(center[0],8,center[1]),new THREE.Vector3(0,-1,0));
 assert.equal(ray.intersectObjects(sceneMeshes,true).filter(hit=>hit.point.y>=pavilion.minDeckHeight).length,0,'No roof closes a sky court');
}
const play=courtyard.data.zones.find(z=>z.id==='play');
for(const [x,z] of pavilion.outer)assert.ok(((x-play.x)/play.rx)**2+((z-play.z)/play.rz)**2<1,'Pavilion stays within the existing play zone');
// Natural perforations must be actual openings in the active rendered geometry.
for(const hole of courtyard.loungeCanopy.holes.filter((_,i)=>i%5===0)){
 const ray=new THREE.Raycaster(new THREE.Vector3(hole.center[0],4,hole.center[1]),new THREE.Vector3(0,-1,0),0,.7);
 assert.equal(ray.intersectObjects(sceneMeshes,true).length,0,'Cellular canopy aperture passes a ray');
}
// Grass formerly sat below the plaza. Verify its live faces are visible from
// above, at the intended height, including the former central exercise court.
const turfMeshes=sceneMeshes.filter(o=>o.isMesh&&!o.isInstancedMesh&&o.material===courtyard.materials.grass);
for(const [x,z] of [[9,-12],[14.7,6.8],[-14.789,-26.398]]){
 const ray=new THREE.Raycaster(new THREE.Vector3(x,.2,z),new THREE.Vector3(0,-1,0),0,.4),hit=ray.intersectObjects(turfMeshes,true)[0];
 assert.ok(hit&&hit.point.y>.02,'Continuous grass is above the plaza');assert.ok(hit.face.normal.y>0,'Turf has upward visible faces');
}
assert.ok(courtyard.revision.turfArea>1500);
assert.equal(world.free(11,-1),true,'Central garden route remains open');
const lounge=courtyard.data.zones.find(z=>z.id==='lounge'),fountain=courtyard.data.zones.find(z=>z.id==='fountain'),events=courtyard.data.zones.find(z=>z.id==='events');
assert.equal(fountain.entranceId,3);
assert.ok(Math.hypot(fountain.x-lounge.x,fountain.z-lounge.z)>12,'Fountain is a separate programme at K3');
for(const [x,z] of courtyard.jetPoints){assert.ok(((x-fountain.x)/fountain.rx)**2+((z-fountain.z)/fountain.rz)**2<1,'Jets stay on the dry fountain paving');assert.ok(((x-lounge.x)/lounge.rx)**2+((z-lounge.z)/lounge.rz)**2>1,'No jets inside the event canopy');}
assert.equal(courtyard.eventProgramme.ottomans,6);
assert.equal(courtyard.eventProgramme.programme.includes('cinema screen'),true);
assert.equal(courtyard.playPavilion.metadata.stairSteps,22);
assert.ok(courtyard.playPavilion.upperGuards.material.transparent);
assert.deepEqual(courtyard.playProgramme.equipment.map(e=>e.type),['tiered mound','slide','sandbox','trampolines','climbing frame','busy board','child swing']);
const panna=courtyard.revision.programme.panna;assert.equal(panna.goals.length,2);
const pannaStart={x:panna.entry[0],z:panna.entry[1]+.7},pannaResult=world.move(pannaStart,0,-1.7);assert.equal(pannaResult.blocked,false,'Actual side entrance into panna court');
const pannaRay=new THREE.Raycaster(new THREE.Vector3(pannaStart.x,.75,pannaStart.z),new THREE.Vector3(0,0,-1),0,1.7);assert.equal(pannaRay.intersectObjects(sceneMeshes,true).length,0,'Panna entry is an open gap in the rendered fence');
const table=courtyard.revision.programme.tableTennis;assert.equal(world.free(table.x,table.z),false,'Table has a physical footprint');
const slide=courtyard.playProgramme.slide,slideRay=new THREE.Raycaster(new THREE.Vector3((slide.start[0]+slide.end[0])/2,2,(slide.start[2]+slide.end[2])/2),new THREE.Vector3(0,-1,0),0,2);const slideHit=slideRay.intersectObjects(sceneMeshes,true)[0];assert.ok(slideHit&&slideHit.face.normal.y>0,'Slide has an upward visible surface');
for(const [x,z] of courtyard.playProgramme.trampolines)assert.equal(world.free(x,z),true,'Flush trampolines remain walkable');
for(const check of model.publicRealm.plazaProgram.metadata.walkChecks){const result=world.move({x:check.from[0],z:check.from[1]},check.to[0]-check.from[0],check.to[1]-check.from[1]);assert.equal(result.blocked,false,'Integrated plaza passage '+check.name);}
const furniture=model.publicRealm.promenadeFurniture;assert.equal(furniture.tableCount,furniture.umbrellaCount);assert.equal(furniture.chairCount,furniture.tableCount*4);assert.equal(model.publicRealm.retailLabels.length,6);
for(const cafe of furniture.cafes)for(const table of cafe.tables)assert.equal(world.free(table.x,table.z),false,'Cafe tables have precise physical footprints');
for(const {x,z} of courtyard.mediaColumns)assert.ok(Math.hypot(x-events.x,z-events.z)<events.rx,'Light columns agree with effective event layout');
assert.ok(courtyard.revision.meadow.count>=400);
assert.ok(courtyard.revision.latticePatches.length>=4);
assert.ok(courtyard.revision.whiteInlayLength>100);
for(const destination of Object.values(courtyard.destinations))assert.equal(world.free(...destination.point),true,'Destination has a clear real landing point');
const summer=courtyard.revision.meadow.instanceMatrix.array.slice();model.setSeason(true,11);assert.equal(courtyard.jets.visible,false);assert.equal(courtyard.spray.visible,false);model.setSeason(false,6);assert.equal(courtyard.jets.visible,true);assert.equal(courtyard.spray.visible,true);assert.deepEqual(courtyard.revision.meadow.instanceMatrix.array,summer);

model.dispose();
console.log('PASS v25: five real arched passages, three rounded apertures, two open sky courts, irregular through-perforations, one fitness island, visible continuous turf, fountain/layout alignment, safe destinations and seasonal water/planting');
