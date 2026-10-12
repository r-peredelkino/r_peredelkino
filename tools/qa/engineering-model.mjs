import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../dist/vendor/three.module.js';
import {complexFootprints as f} from '../../dist/complex-footprints.js';
import {createComplex} from '../../dist/complex-model.js';
const source=JSON.parse(fs.readFileSync(new URL('../engineering-layout.json',import.meta.url)));
const model=createComplex();
assert.equal(model.towers.size,6);
assert.deepEqual([...model.towers.keys()],[0,1,2,3,4,5]);
assert.equal(f.fan.holes.length,5);
for(const spec of f.buildings){const ref=source.buildings.find(b=>b.id===spec.id);const center=[0,1].map(i=>ref.vertices.reduce((s,p)=>s+p[i],0)/ref.vertices.length);assert.ok(Math.abs(spec.x-(center[0]-source.origin[0])*source.scale)<1e-4);assert.ok(Math.abs(spec.z-(center[1]-source.origin[1])*source.scale)<1e-4);const tower=model.towers.get(spec.id);assert.equal(tower.group.rotation.y,0);assert.equal(tower.group.position.x,spec.x);assert.equal(tower.group.position.z,spec.z)}
let meshes=0,positions=0;model.root.updateMatrixWorld(true);model.root.traverse(o=>{if(o.isMesh){meshes++;for(const [name,attribute] of Object.entries(o.geometry.attributes)){for(const value of attribute.array)assert.ok(Number.isFinite(value),`${o.name}: ${name}`)}if(o.instanceMatrix)for(const value of o.instanceMatrix.array)assert.ok(Number.isFinite(value));positions+=o.geometry.attributes.position?.count||0}});
assert.ok(meshes<2000);assert.ok(f.arenaCenter[1]>model.towers.get(2).spec.z);assert.ok(f.arenaCenter[0]<model.towers.get(3).spec.x);
const radius=source.arena.radii[0]*source.scale;for(const [x,z] of f.arena.outer)assert.ok(Math.abs(Math.hypot(x-f.arenaCenter[0],z-f.arenaCenter[1])-radius)<.001);
model.select(1,6);assert.equal(model.towers.get(1).belt.visible,true);assert.equal(model.towers.get(0).belt.visible,false);assert.equal(model.towers.get(1).belt.position.y,19);
model.update(1);model.update(2);const time=model.life.time,walker=model.life.walkers[0].g.position.clone();model.life.setEnabled(false);model.update(100);assert.equal(model.life.time,time);assert.ok(model.life.walkers[0].g.position.equals(walker));model.life.setEnabled(true);model.update(101);assert.equal(model.life.time,time+1);
model.life.setSkyVisible(false);model.life.setSkyVisible(true);
const camera=new THREE.OrthographicCamera(-125*380/465,125*380/465,125,-125,1,900);camera.position.set(0,270,.01);camera.lookAt(0,0,0);camera.updateMatrixWorld();for(const b of f.buildings){const p=new THREE.Vector3(b.x,b.h,b.z).project(camera),base=new THREE.Vector3(b.x,0,b.z).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,`Visible label ${b.id}`);assert.ok(Math.abs(p.x-base.x)<1e-6&&Math.abs(p.y-base.y)<.0001,`No perspective drift ${b.id}`)}
const sampledRoutes=model.life.routes.map(r=>Array.from({length:1001},(_,i)=>{const p=r.curve.getPoint(i/1000);return[p.x,p.z]}));fs.writeFileSync('/tmp/engineering-routes.json',JSON.stringify(sampledRoutes));
model.dispose();console.log(`PASS: source placement, six footprints, shared scene, finite ${positions} vertices, owned selection, life pause, orthographic alignment; ${meshes} mesh objects`);
