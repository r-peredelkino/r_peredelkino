import {createHash} from 'node:crypto';
import * as T from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {createApartment} from '../../dist/apartment-model.js';
import {apartmentPlans} from '../../dist/apartment-plans.js';
import {applySurfaceProvenance,applyGeometryTree,readPaneProvenance,readTextureSurfaceProvenance} from '../../dist/surface-provenance-v38.js';
import {embedPixelSignature,readPixelSignature} from '../../dist/baked-authorship.js';

const checks=[],assert=(name,pass,details={})=>{checks.push({name,pass,...details});if(!pass)throw new Error(name+' '+JSON.stringify(details));};
const hash=bytes=>createHash('sha256').update(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength)).digest('hex');
function sceneSnapshot(root){
 const objects=[],geometry=new Map(),material=new Map();
 root.traverse(o=>{
  objects.push(o);
  if(o.geometry&&!geometry.has(o.geometry)){const g=o.geometry;geometry.set(g,{attributes:Object.fromEntries(['position','normal','uv'].filter(k=>g.attributes[k]).map(k=>[k,hash(g.attributes[k].array)])),index:g.index&&hash(g.index.array),groups:JSON.stringify(g.groups),drawRange:JSON.stringify(g.drawRange)});}
  if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(!material.has(m))material.set(m,{compile:m.onBeforeCompile,key:m.customProgramCacheKey});}
 });
 return {objects,geometry,material,meshes:objects.filter(o=>o.isMesh),instances:objects.filter(o=>o.isInstancedMesh).map(o=>({mesh:o,count:o.count,matrix:hash(o.instanceMatrix.array),colors:o.instanceColor&&hash(o.instanceColor.array)}))};
}
function sameScene(root,snapshot){
 const after=sceneSnapshot(root);
 return after.objects.length===snapshot.objects.length&&after.objects.every((o,i)=>o===snapshot.objects[i])&&after.geometry.size===snapshot.geometry.size&&after.material.size===snapshot.material.size&&Array.from(snapshot.geometry).every(([g,original])=>JSON.stringify(after.geometry.get(g))===JSON.stringify(original))&&Array.from(snapshot.material).every(([m,original])=>after.material.get(m)?.compile===original.compile&&after.material.get(m)?.key===original.key)&&snapshot.instances.every(o=>o.mesh.count===o.count&&hash(o.mesh.instanceMatrix.array)===o.matrix&&(!o.colors||hash(o.mesh.instanceColor.array)===o.colors));
}
const bytesFor=(width,height)=>{const data=new Uint8Array(width*height*4);for(let i=0;i<data.length;i++)data[i]=(Math.imul(i+3,71)+11)&255;return data;};
function resetFixturePaneRecords(model){
 // Factories install before their first browser draw. For this CPU fixture,
 // recreate that first installation against the same real source arrays.
 // Remove only v38 records in memory; no application file or source geometry
 // attribute is rewritten, and the older physical/rpAuthor records stay live.
 model.surfaceProvenance?.dispose();const seen=new Set();model.root.traverse(o=>{const g=o.geometry;if(g&&!seen.has(g)){seen.add(g);g.deleteAttribute('rpPaneOwner');g.deleteAttribute('rpPaneKey');delete g.userData.surfaceProvenanceV38;}});
}
let metrics={};
try{
 const model=createComplex(),factoryStats=model.surfaceProvenance?.stats;resetFixturePaneRecords(model);
 const before=sceneSnapshot(model.root),start=performance.now(),records=applySurfaceProvenance(model),elapsed=performance.now()-start;
 assert('Full reconstructed site keeps every position, normal, UV, index, group, instance matrix and source material callback',sameScene(model.root,before),{meshes:before.meshes.length,geometries:before.geometry.size});
 assert('All six tower window buffers carry a recoverable record at every original instance index',Array.from(model.towers).every(([id,t])=>{const record=records.panes.find(p=>p.mesh===t.windows);return record?.recordCount===t.windows.count&&Array.from({length:t.windows.count},(_,i)=>readPaneProvenance(t.windows.geometry,i)).every(r=>r.complete&&r.handle==='@r_peredelkino'&&r.paneIndex<t.windows.count);}),{towerWindows:Array.from(model.towers,([id,t])=>({id,count:t.windows.count}))});
 assert('Every commercial and arena frontage pane is covered in the existing single instanced draw',records.panes.some(p=>p.mesh===model.shopWindows&&p.recordCount===model.shopWindows.count)&&Array.from({length:model.shopWindows.count},(_,i)=>readPaneProvenance(model.shopWindows.geometry,i)).every(r=>r.complete),{shopWindows:model.shopWindows.count});
 assert('All original owned scene geometry retains its independently encoded rpAuthor attribute',Array.from(records.geometries).every(g=>g.getAttribute('rpAuthor'))&&records.stats.addedGeometryBytes===0);
 assert('Distributed attributes add no meshes, materials, textures, draw groups or shader modifications',records.stats.additionalMeshes===0&&records.stats.additionalDrawCalls===0&&records.stats.additionalMaterials===0&&records.stats.additionalTextures===0&&sameScene(model.root,before));
 const actualPaneBytes=Array.from(new Set(records.panes.map(p=>p.geometry))).reduce((n,g)=>n+g.getAttribute('rpPaneOwner').array.byteLength+g.getAttribute('rpPaneKey').array.byteLength,0);
 assert('Actual full-site allocation stays below 1.5 MB and each own texture scan is at most one million pixels',actualPaneBytes===records.stats.paneBytes&&actualPaneBytes<1500000&&records.textures.filter(t=>t.rgbBitPlane===1).every(t=>t.pixels<=1048576),{paneBytes:actualPaneBytes,texturePixels:records.stats.texturePixels,excludedTexturePixels:records.stats.excludedTexturePixels,installationMs:elapsed});
 const verify=records.verify();assert('Readback verifies all actual pane records and all complete authored texel blocks',verify.complete&&verify.panes.length===records.panes.length&&records.stats.encodedTextures>0&&records.stats.completeTextureBlocks>0,{instancePanes:records.stats.instancePanes,completeTextureBlocks:records.stats.completeTextureBlocks});
 assert('Installing twice on one scene reuses the helper and allocates nothing again',applySurfaceProvenance(model)===records);
 const sample=model.towers.get(1).windows.geometry,owner=sample.getAttribute('rpPaneOwner'),saved=owner.array[104];owner.array[104]^=1;
 assert('A damaged individual window record is detected independently',!readPaneProvenance(sample,26).complete&&!records.verify().complete&&readPaneProvenance(sample,25).complete);owner.array[104]=saved;
 assert('Restoring an individual record restores complete verification',records.verify().complete);
 const physical=model.watermarks.verify();assert('All twelve existing physical marks remain fully recoverable',physical.length===12&&physical.every(r=>r.complete&&r.text==='@r_peredelkino'));
 metrics={fullSite:records.stats,initialFactoryStats:factoryStats,installationMs:elapsed,sourceGeometryHashes:Array.from(before.geometry.values()).map(g=>g.attributes.position)};
 let geometryDisposes=0,materialDisposes=0,textureDisposes=0;
 sample.addEventListener('dispose',()=>geometryDisposes++);model.towers.get(1).windows.material.addEventListener('dispose',()=>materialDisposes++);const ownedTexture=records.textures.find(t=>t.completeBlocks>0).texture;ownedTexture.addEventListener('dispose',()=>textureDisposes++);
 records.dispose();records.dispose();assert('Helper disposal is idempotent and leaves all parent-owned GPU resources live',records.disposed&&records.panes.length===0&&records.textures.length===0&&records.geometries.size===0&&geometryDisposes===0&&materialDisposes===0&&textureDisposes===0);
 const again=applySurfaceProvenance(model);assert('Rebinding an intact scene after helper disposal reuses encoded attributes and pixels',again.stats.paneBytes===0&&again.stats.addedGeometryBytes===0&&again.verify().complete);again.dispose();model.dispose();

 const root=new T.Group();root.userData.authored=true;
 const procedural=new T.DataTexture(bytesFor(16,16),16,16,T.RGBAFormat);procedural.userData.attribution={handle:'@r_peredelkino'};procedural.name='Concept procedural fixture';embedPixelSignature(procedural.image.data,{label:'fixture'});
 const original=procedural.image.data.slice(),oldSignature=readPixelSignature(original),foreign=new T.DataTexture(bytesFor(16,16),16,16,T.RGBAFormat),foreignOriginal=foreign.image.data.slice();foreign.userData={attribution:{handle:'@r_peredelkino'},sourceUrl:'https://example.invalid/developer-original.png'};
 const normal=new T.DataTexture(bytesFor(16,16),16,16,T.RGBAFormat),normalOriginal=normal.image.data.slice();normal.userData.attribution={handle:'@r_peredelkino'};
 const fixtureMaterial=new T.MeshStandardMaterial({map:procedural,normalMap:normal}),fixture=new T.Mesh(new T.BoxGeometry(2,1,1),fixtureMaterial);root.add(fixture,new T.Mesh(new T.PlaneGeometry(),new T.MeshStandardMaterial({map:foreign})));
 const foreignGroup=new T.Group();foreignGroup.userData.thirdParty=true;const importedMesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());foreignGroup.add(importedMesh);root.add(foreignGroup);
 const fixtureBefore=sceneSnapshot(root),p=applyGeometryTree(root,{label:'procedural-fixture'});
 assert('Every 8 by 8 authored color block independently recovers exact handle and block index',Array.from({length:4},(_,i)=>readTextureSurfaceProvenance(procedural,i)).every(r=>r.complete&&r.encodedIndex===r.block&&r.handle==='@r_peredelkino'));
 assert('Pixel changes preserve alpha, previous bit plane 0, and differ by at most two RGB levels',procedural.image.data.every((v,i)=>i%4===3?v===original[i]:((v&1)===(original[i]&1)&&Math.abs(v-original[i])<=2))&&readPixelSignature(procedural.image.data)===oldSignature);
 assert('Foreign source images are byte-exact and receive no concept record even if earlier metadata is overly broad',hash(foreign.image.data)===hash(foreignOriginal)&&!foreign.userData.surfaceProvenanceV38&&p.textures.some(t=>t.texture===foreign&&t.status==='foreign-source-excluded'));
 assert('Imported foreign model subtrees never receive new geometry ownership records',!importedMesh.geometry.getAttribute('rpAuthor')&&!importedMesh.geometry.userData.surfaceProvenanceV38);
 assert('Data-only normal and bump response maps remain byte-exact',hash(normal.image.data)===hash(normalOriginal)&&!normal.userData.surfaceProvenanceV38);
 assert('Previously unrecorded authored geometry gets a code without altering primitive shape, UVs or draw ranges',fixture.geometry.getAttribute('rpAuthor')&&sameScene(root,fixtureBefore));
 const pixelAt=0,savedPixel=procedural.image.data[pixelAt];procedural.image.data[pixelAt]^=2;assert('A damaged color block fails independently without invalidating the other blocks',!readTextureSurfaceProvenance(procedural,0).complete&&readTextureSurfaceProvenance(procedural,1).complete);procedural.image.data[pixelAt]=savedPixel;
 const rawImageOnly={image:{data:procedural.image.data.slice(),width:16,height:16}};assert('Pixel recovery survives removing all texture name and userData metadata',readTextureSurfaceProvenance(rawImageOnly,3).complete);
 assert('Out-of-range pane and texture requests cannot produce a false positive',!readPaneProvenance(fixture.geometry,-1).complete&&!readPaneProvenance(fixture.geometry,999999).complete&&!readTextureSurfaceProvenance(procedural,-1).complete&&!readTextureSurfaceProvenance(procedural,4).complete);
 p.dispose();root.traverse(o=>{o.geometry?.dispose();for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])m.dispose();});procedural.dispose();foreign.dispose();normal.dispose();

 const sharedRoot=new T.Group();sharedRoot.userData.authored=true;const sharedGeometry=new T.PlaneGeometry(1,2),glassMaterial=new T.MeshStandardMaterial({transparent:true,opacity:.4}),a=new T.InstancedMesh(sharedGeometry,glassMaterial,3),b=new T.InstancedMesh(sharedGeometry,glassMaterial,7);a.name='Warm neighboring windows';b.name='Cool neighboring windows';sharedRoot.add(a,b);
 const sharedBefore=sceneSnapshot(sharedRoot),sharedRecords=applyGeometryTree(sharedRoot,{label:'shared-pane-fixture'});
 assert('Different-sized neighboring pane buffers preserve one shared geometry and allocate only their largest carrier',a.geometry===b.geometry&&sharedGeometry.getAttribute('rpPaneOwner').count===7&&sharedRecords.stats.paneBytes===7*24&&sharedRecords.verify().complete&&sameScene(sharedRoot,sharedBefore));
 const json=a.toJSON();delete json.object.userData;for(const geometry of json.geometries)delete geometry.userData;const loaded=new T.ObjectLoader().parse(json);
 assert('Three.js JSON restores independent per-window bytes without name or provenance metadata',loaded.geometry.getAttribute('rpPaneOwner').isInstancedBufferAttribute&&Array.from({length:loaded.count},(_,i)=>readPaneProvenance(loaded.geometry,i)).every(r=>r.complete));
 sharedRecords.dispose();sharedGeometry.dispose();glassMaterial.dispose();loaded.geometry.dispose();loaded.material.dispose();

 const apartmentMetrics=[];
 for(const id of Object.keys(apartmentPlans)){
  const apt=createApartment(id);resetFixturePaneRecords(apt);
  const snapshot=sceneSnapshot(apt.root),expected=apt.facadeRegistration.windows.flatMap(w=>w.panes),provenance=applyGeometryTree(apt,{label:'apartment-'+id});
  const glazingRecord=provenance.panes.find(pane=>pane.mesh===apt.glazing),vertices=apt.glazing.geometry.attributes.position.count;
  assert(id+' every merged curved pane has its own recovered ID without changing registered glazing or batching',glazingRecord?.paneCount===expected.length&&glazingRecord.recordCount===vertices&&provenance.verify().complete&&sameScene(apt.root,snapshot),{panes:expected.length,vertices,paneBytes:provenance.stats.paneBytes});
  let vertex=0;const indices=[];for(const pane of expected){indices.push(readPaneProvenance(apt.glazing.geometry,vertex).paneIndex);vertex+=(pane.points.length-1)*6;}
  assert(id+' each source bay range maps to one exact contiguous pane code',indices.every((index,i)=>index===i)&&vertex===vertices&&apt.voxelAuthorship.verify().every(r=>r.complete));
  apartmentMetrics.push({id,panes:expected.length,paneBytes:provenance.stats.paneBytes});provenance.dispose();apt.dispose();
 }
 metrics.apartments=apartmentMetrics;
 console.log(JSON.stringify({revision:38,pass:true,checkCount:checks.length,checks,metrics},null,2));
}catch(error){console.log(JSON.stringify({revision:38,pass:false,checkCount:checks.length,checks,metrics,error:String(error.stack||error)},null,2));process.exitCode=1;}
