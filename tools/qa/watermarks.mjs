import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {attribution} from '../../dist/attribution.js';
const model=createComplex(),texture=model.watermarks.texture;
assert.equal(attribution.handle,'@r_peredelkino');assert.equal(texture.image.width,512);assert.equal(texture.image.height,128);assert.equal(texture.flipY,false);
const alphas=[];for(let i=3;i<texture.image.data.length;i+=4)alphas.push(texture.image.data[i]);assert.ok(alphas.some(a=>a===255)&&alphas.some(a=>a===0));
// Window marks use the same embedded bitmap; shade only the existing emission, never illuminate dark panes.
for(const tower of model.towers.values()){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};tower.windowLights.material.onBeforeCompile(shader);assert.equal(shader.uniforms.paneBrandMap.value,texture);assert.ok(shader.fragmentShader.includes('totalEmissiveRadiance *= 1.0-paneAuthorInk*.88'));assert.ok(shader.fragmentShader.indexOf('vPaneGlow * nightFactor')<shader.fragmentShader.indexOf('1.0-paneAuthorInk*.88'));assert.ok(model.watermarks.objects.filter(o=>o.parent===tower.group).length>=2)}
assert.equal(model.commercialLights.brandTexture,texture);
model.root.traverse(o=>{assert.equal(o.userData.attribution.handle,'@r_peredelkino');if(o.geometry)assert.equal(o.geometry.userData.attribution.handle,'@r_peredelkino')});
// Model-level marks survive the standard Three.js JSON export without needing the page overlay.
const serialized=model.root.toJSON(),visit=o=>{assert.equal(o.userData.attribution.handle,'@r_peredelkino');for(const child of o.children??[])visit(child)};visit(serialized.object);assert.ok(serialized.textures.some(t=>t.name.includes('@r_peredelkino')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../ATTRIBUTION.json',import.meta.url)));for(const [path,expected] of Object.entries(manifest.files)){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+path,import.meta.url))).digest('hex'),expected,path)}
model.dispose();console.log('PASS: embedded glyph mask; lit-only pane shader; all six tower surface/roof marks; commercial panes; scene and geometry metadata; textured model JSON; provenance hashes');
