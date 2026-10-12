import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {bakeSceneAuthorship,readPixelSignature} from '../../dist/baked-authorship.js';
const prefix='@r_peredelkino|RP-CONCEPT-2026-10-07|RP13',m=createComplex();let maxDelta=0,geometries=0;
for(const texture of m.bakedAuthorship.textures){if(texture.image?.data instanceof Uint8Array)assert.equal(readPixelSignature(texture.image.data),prefix,texture.name)}
for(const geometry of m.bakedAuthorship.geometries){const attr=geometry.attributes.rpAuthor;assert.ok(attr);assert.equal(new TextDecoder().decode(attr.array.slice(0,Math.min(prefix.length,attr.array.length))),prefix.slice(0,attr.array.length));assert.ok(geometry.userData.pixelProvenance.maxDelta<=.00008);maxDelta=Math.max(maxDelta,geometry.userData.pixelProvenance.maxDelta);geometries++}
m.root.traverse(o=>{if(!o.isMesh)return;assert.ok(o.geometry.attributes.uv,`${o.name}: UV`);for(const material of [o.material].flat()){if(material.isShaderMaterial){assert.ok(material.uniforms.rpSurfaceMap.value.isTexture);assert.ok(material.fragmentShader.includes('texture2D(rpSurfaceMap,vUv)'))}else assert.ok(material.map?.isTexture,`${o.name}: baked texture`)}});
// New objects and mutable weather coordinates use the same pipeline; they never gain geometry drift.
const group=new THREE.Group(),lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0],3)),new THREE.LineBasicMaterial({color:0xaabbcc})),points=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,1,0],3)),new THREE.PointsMaterial());group.add(lines,points);const before=Array.from(lines.geometry.attributes.position.array),weather=bakeSceneAuthorship(group,{mutable:true,label:'weather-test'});assert.deepEqual(Array.from(lines.geometry.attributes.position.array),before);assert.ok(lines.geometry.attributes.color);assert.ok(points.material.map);weather.dispose();
// The portable v22/v23 source package intentionally omits the historical v13 export.
// Keep the full historical gate by default; --runtime-only explicitly checks the live model.
const runtimeOnly=process.argv.includes('--runtime-only');
if(!runtimeOnly){
 const snapshot=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../exports/rodina-authored-v13/scene.three.json.gz',import.meta.url))));assert.ok(snapshot.geometries.every(g=>g.data?.attributes?.rpAuthor));assert.ok(snapshot.textures.length>=100);assert.ok(snapshot.images.filter(i=>i.url?.data).length>=100);
 const restored=new THREE.ObjectLoader().parse(snapshot);let restoredMeshes=0;restored.traverse(o=>{if(o.isMesh){assert.ok(o.geometry.attributes.rpAuthor);restoredMeshes++}});assert.equal(restoredMeshes,snapshot.object.userData.bakedAuthorship.meshes);
}
m.dispose();console.log(`PASS: per-texture RGB signatures, ${geometries} geometry signatures, all mesh UV/maps, max static deviation ${maxDelta} m, mutable positions unchanged; ${runtimeOnly?'live model only (historical v13 snapshot not requested)':'source texture/geometry snapshot'}`);
