import assert from 'node:assert/strict';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {signalState} from '../../dist/traffic.js';
const m=createComplex(),camera=new THREE.PerspectiveCamera(48,1,.1,1000);camera.position.set(-60,35,-12);
m.lighting.setAtmosphere({elevation:-12,hour:21,weather:'rain'});m.update(0);m.lighting.update(m.life.time,camera);
const lit=[];for(const [id,t] of m.towers){assert.ok(t.windowLights.litCount>0&&t.windowLights.litCount<t.windows.count,`Mixed windows on tower ${id}`);assert.equal(t.windowLights.night.value,1);lit.push([id,t.windowLights.litCount,t.windows.count]);
 // Every pane lies on the outside of its façade contour, rather than behind the opaque wall.
 const poly=t.spec.shape,mat=new THREE.Matrix4(),p=new THREE.Vector3();let inside=0;
 for(let j=0;j<t.columns;j++){const i=j+(id===0?0:t.columns);t.windows.getMatrixAt(i,mat);p.set(0,0,t.windows.geometry.attributes.paneBend.getX(i)).applyMatrix4(mat);let hit=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++)if((poly[a][1]>p.z)!==(poly[b][1]>p.z)&&p.x<(poly[b][0]-poly[a][0])*(p.z-poly[a][1])/(poly[b][1]-poly[a][1])+poly[a][0])hit=!hit;if(hit)inside++}assert.equal(inside,0,`Actual curved pane surfaces outside tower ${id}`);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};t.windowLights.material.onBeforeCompile(shader);assert.ok(shader.vertexShader.includes('vPaneGlow=paneGlow'));assert.ok(shader.fragmentShader.includes('vPaneGlow * nightFactor'));assert.equal(shader.uniforms.nightFactor,t.windowLights.night);
}
assert.ok(m.commercialLights.litCount>0&&m.commercialLights.litCount<m.shopWindows.count);assert.equal(m.lighting.wetness,1);assert.equal(m.lighting.headLights.length+m.lighting.lampLights.length+m.lighting.arenaLights.length,10);assert.ok(m.lighting.lampLights.every(l=>l.intensity>0));assert.ok(m.lighting.headLights.every(l=>l.intensity>0));
assert.equal(m.lighting.windowLights.length,2);assert.ok(m.lighting.windowLights.every(l=>l.decay===2&&l.intensity>0&&l.intensity<=100));
const arrays=[...m.towers.values()].map(t=>Array.from(t.windowLights.strengths));m.life.setEnabled(false);m.update(100);m.lighting.update(m.life.time,camera);assert.deepEqual([...m.towers.values()].map(t=>Array.from(t.windowLights.strengths)),arrays);
m.lighting.setAtmosphere({elevation:28,hour:12,weather:'clear'});m.lighting.update(m.life.time,camera);assert.equal(m.lighting.strength,0);assert.ok(m.lighting.headLights.every(l=>l.intensity===0));assert.ok([...m.towers.values()].every(t=>t.windowLights.night.value===0));assert.equal(m.lighting.wetness,0);
assert.ok(m.lighting.windowLights.every(l=>l.intensity===0));
// All junctions: opposing movement has a protected all-red interval and never shares green.
for(const junction of [...new Set(m.traffic.signals.map(s=>s.junction))])for(let t=0;t<64;t+=.05){assert.ok(!(signalState('street',junction,t)==='green'&&signalState('highway',junction,t)==='green'))}
const traffic=m.traffic;traffic.setEnabled(true);traffic.update(0);let crossings=0,stopped=0;
for(let frame=1;frame<4000;frame++){const before=traffic.cars.map(c=>({p:c.position,v:c.velocity}));traffic.update(frame*.1);for(const c of traffic.cars){const old=before[c.index];if(c.velocity<.01)stopped++;if(c.position<old.p)continue;for(const s of c.lane.stops)if(old.p<s.at-.001&&c.position>s.at+.001){const phase=signalState(c.lane.road.type,s.junction,traffic.time);assert.ok(phase==='green'||phase==='amber',`Crossed a red signal: ${c.lane.road.name}`);crossings++}}}
assert.ok(crossings>100&&stopped>100);assert.ok(new Set(traffic.cars.map(c=>c.desiredSpeed.toFixed(2))).size>40);
assert.ok(m.courtyard.data.trees.length>=35);assert.ok(m.courtyard.data.shrubs.length>=1000);assert.equal(m.courtyard.swings.length,2,'Two suspended lilac rings in the courtyard reference');assert.equal(m.courtyard.materials.pink.emissiveIntensity,0,'Courtyard accents switch off in daylight');
m.dispose();console.log('PASS: mixed facade panes',JSON.stringify(lit),'; shop lighting; daylight shutoff; wetness; 10 PBR lights; pane/shader attributes; pause; protected signals;',crossings,'legal crossings; variable traffic; planted courtyard');
