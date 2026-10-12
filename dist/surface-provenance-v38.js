// Distributed surface records for the concept group. Existing scene resources
// remain owned by their scene; records do not enforce access or prevent copying.
import * as T from './vendor/three.module.js';
import {attribution} from './attribution.js?v=community38';

const HANDLE='@r_peredelkino',VERSION=38,OWNER_ATTRIBUTE='rpPaneOwner',KEY_ATTRIBUTE='rpPaneKey';
const encoder=new TextEncoder(),decoder=new TextDecoder(),handleBytes=encoder.encode(HANDLE);
const TEXTURE_BLOCK=8,TEXTURE_PACKET=23,MAX_TEXTURE_PIXELS=1048576;
const colorSlots=['map','emissiveMap','alphaMap'];
const installedRoots=new WeakMap();
const digest=text=>{let value=2166136261;for(const byte of encoder.encode(text)){value^=byte;value=Math.imul(value,16777619);}return value>>>0;};
const packetDigest=bytes=>{let value=2166136261;for(const byte of bytes){value^=byte;value=Math.imul(value,16777619);}return value>>>0;};
const materials=o=>Array.isArray(o.material)?o.material:o.material?[o.material]:[];
const own=o=>o?.userData?.attribution?.handle===HANDLE||o?.userData?.authored===true;
const excluded=o=>o?.userData?.authored===false||o?.userData?.thirdParty===true||o?.userData?.referenceAsset===true;
const excludedTree=o=>{for(let current=o;current;current=current.parent)if(excluded(current))return true;return false;};
const foreignImage=/\.(?:png|jpe?g|webp|avif|gif|svg|heic)(?:$|[?#])/i;

function sourceIsForeign(texture){
 if(excluded(texture)||texture.userData?.sourceAsset||texture.userData?.developerImage)return true;
 if(/source[- ]pixel|developer.*(?:image|render|photo)|original.*(?:panorama|floor|image)/i.test(texture.name||''))return true;
 if(typeof texture.image?.src==='string'&&texture.image.src)return true;
 const data=texture.userData||{},source=data.source;
 if(typeof source==='string'&&foreignImage.test(source))return true;
 for(const object of [data,source,data.reference])if(object&&typeof object==='object')for(const [key,value]of Object.entries(object))if(/url|href|src|path|file/i.test(key)&&typeof value==='string'&&foreignImage.test(value))return true;
 return false;
}

function panePacket(scopeKey,index){
 const bytes=new Uint8Array(16);bytes.set(handleBytes);
 const checksum=digest(HANDLE+'|'+VERSION+'|'+scopeKey+'|'+index)&65535;
 bytes[14]=checksum&255;bytes[15]=checksum>>>8;
 return Array.from({length:4},(_,i)=>(bytes[i*4]|bytes[i*4+1]<<8|bytes[i*4+2]<<16|bytes[i*4+3]<<24)>>>0);
}

function installPaneRecords(mesh,scope,ranges=null){
 const geometry=mesh.geometry,instanced=!!mesh.isInstancedMesh,count=instanced?mesh.count:geometry.attributes.position?.count;
 if(!Number.isInteger(count)||count<0)return null;
 const prior=geometry.userData.surfaceProvenanceV38;
 if(prior){
  if(prior.instanced!==instanced||ranges&&ranges.length!==prior.paneCount)throw new Error('Shared surface carriers require the same attribute layout.');
  // Neighboring buildings intentionally share one instanced pane template.
  // Keep that sharing, extend its codes to the largest live instance buffer,
  // and let each mesh retain its own record count. No geometry is unpacked.
  let addedBytes=0;
  if(count>prior.recordCount){
   const owners=new Uint32Array(count*4),keys=new Uint32Array(count*2);owners.set(geometry.getAttribute(OWNER_ATTRIBUTE).array);keys.set(geometry.getAttribute(KEY_ATTRIBUTE).array);
   for(let i=prior.recordCount;i<count;i++){owners.set(panePacket(prior.scopeKey,i),i*4);keys[i*2]=prior.scopeKey;keys[i*2+1]=i;}
   geometry.setAttribute(OWNER_ATTRIBUTE,new T.InstancedBufferAttribute(owners,4,false));geometry.setAttribute(KEY_ATTRIBUTE,new T.InstancedBufferAttribute(keys,2,false));
   addedBytes=(count-prior.recordCount)*24;prior.recordCount=count;prior.paneCount=count;prior.bytes=owners.byteLength+keys.byteLength;
  }
  return {mesh,geometry,...prior,scope,carrierScope:prior.scope,recordCount:count,paneCount:instanced?count:prior.paneCount,reused:true,addedBytes};
 }
 if(geometry.getAttribute(OWNER_ATTRIBUTE)||geometry.getAttribute(KEY_ATTRIBUTE))throw new Error('Existing surface attributes require a matching record descriptor.');
 const owners=new Uint32Array(count*4),keys=new Uint32Array(count*2),scopeKey=digest(scope);
 let paneCount=instanced?count:1;
 if(ranges){
  if(instanced)throw new Error('Vertex ranges apply only to merged static panes.');
  let total=0;for(const range of ranges){if(!Number.isInteger(range.count)||range.count<=0)throw new Error('Each merged pane requires a positive vertex range.');total+=range.count;}
  if(total!==count)throw new Error('Merged pane ranges must cover the exact existing geometry.');
  paneCount=ranges.length;
 }
 let rangeAt=0,rangeEnd=ranges?.[0]?.count??count;
 for(let i=0;i<count;i++){
  if(ranges&&i>=rangeEnd){rangeAt++;rangeEnd+=ranges[rangeAt].count;}
  const index=instanced?i:ranges?rangeAt:0;owners.set(panePacket(scopeKey,index),i*4);keys[i*2]=scopeKey;keys[i*2+1]=index;
 }
 const Attribute=instanced?T.InstancedBufferAttribute:T.BufferAttribute;
 geometry.setAttribute(OWNER_ATTRIBUTE,new Attribute(owners,4,false));geometry.setAttribute(KEY_ATTRIBUTE,new Attribute(keys,2,false));
 // Prevent primitive serializers from regenerating arrays without custom data.
 // Geometry positions, normals, UVs, indices, groups and matrices stay intact.
 if(geometry.parameters){geometry.userData.sourcePrimitive??=geometry.type;delete geometry.parameters;geometry.type=geometry.isInstancedBufferGeometry?'InstancedBufferGeometry':'BufferGeometry';geometry.toJSON=T.BufferGeometry.prototype.toJSON;}
 const record={version:VERSION,handle:HANDLE,scope,scopeKey,instanced,recordCount:count,paneCount,bytes:owners.byteLength+keys.byteLength,channels:[OWNER_ATTRIBUTE,KEY_ATTRIBUTE]};
 geometry.userData.surfaceProvenanceV38=record;
 return {mesh,scope,geometry,...record,reused:false,addedBytes:record.bytes};
}

export function readPaneProvenance(geometry,index){
 const owner=geometry?.getAttribute(OWNER_ATTRIBUTE),key=geometry?.getAttribute(KEY_ATTRIBUTE);
 if(!owner||!key||!Number.isInteger(index)||index<0||index>=owner.count||index>=key.count)return {complete:false,handle:'',index};
 const bytes=new Uint8Array(16);for(let i=0;i<4;i++){const word=owner.array[index*4+i]>>>0;for(let b=0;b<4;b++)bytes[i*4+b]=(word>>>(b*8))&255;}
 const handle=decoder.decode(bytes.subarray(0,14)),version=VERSION,scopeKey=key.array[index*2]>>>0,paneIndex=key.array[index*2+1]>>>0,checksum=bytes[14]|bytes[15]<<8;
 return {handle,version,scopeKey,paneIndex,checksum,complete:handle===HANDLE&&version===VERSION&&checksum===(digest(handle+'|'+version+'|'+scopeKey+'|'+paneIndex)&65535)};
}

function texturePixels(texture){
 const image=texture?.image;if(!image)return null;
 const width=image.width,height=image.height,data=image.data;
 if(!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0)return null;
 const channels=data.length/(width*height);if(channels!==3&&channels!==4)return null;
 return {data,width,height,channels};
}
function texturePacket(index){
 const bytes=new Uint8Array(TEXTURE_PACKET);bytes.set([82,80]);bytes.set(handleBytes,2);bytes[16]=VERSION;
 for(let b=0;b<4;b++)bytes[17+b]=(index>>>(b*8))&255;
 const sum=packetDigest(bytes.subarray(0,21))&65535;bytes[21]=sum&255;bytes[22]=sum>>>8;return bytes;
}
function textureBlock(image,index,write=null){
 const {data,width,height,channels}=image,columns=Math.ceil(width/TEXTURE_BLOCK),rows=Math.ceil(height/TEXTURE_BLOCK);
 if(!Number.isInteger(index)||index<0||index>=columns*rows)return null;
 const x0=index%columns*TEXTURE_BLOCK,y0=Math.floor(index/columns)*TEXTURE_BLOCK,x1=Math.min(width,x0+TEXTURE_BLOCK),y1=Math.min(height,y0+TEXTURE_BLOCK),capacity=(x1-x0)*(y1-y0)*3;
 const bytes=write??new Uint8Array(TEXTURE_PACKET);let bitAt=0,maxDelta=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)for(let c=0;c<3;c++){
  const at=(y*width+x)*channels+c,bit=(bytes[(bitAt>>>3)%TEXTURE_PACKET]>>>(7-(bitAt&7)))&1;
  if(write){const old=data[at];data[at]=(old&253)|(bit<<1);maxDelta=Math.max(maxDelta,Math.abs(data[at]-old));}
  else if(bitAt<TEXTURE_PACKET*8)bytes[bitAt>>>3]|=((data[at]>>>1)&1)<<(7-(bitAt&7));
  bitAt++;
 }
 return {bytes,capacity,completeCapacity:capacity>=TEXTURE_PACKET*8,maxDelta};
}

export function readTextureSurfaceProvenance(texture,index=0){
 const image=texturePixels(texture),block=image&&textureBlock(image,index);
 if(!block)return {complete:false,handle:'',block:index};
 const bytes=block.bytes,handle=decoder.decode(bytes.subarray(2,16)),version=bytes[16];let encodedIndex=0;
 for(let b=0;b<4;b++)encodedIndex|=bytes[17+b]<<(b*8);encodedIndex>>>=0;
 const checksum=bytes[21]|bytes[22]<<8,expected=packetDigest(bytes.subarray(0,21))&65535;
 return {handle,version,block:index,encodedIndex,complete:block.completeCapacity&&bytes[0]===82&&bytes[1]===80&&handle===HANDLE&&version===VERSION&&encodedIndex===index&&checksum===expected};
}

function stampOwnedTexture(texture){
 if(sourceIsForeign(texture))return {status:'foreign-source-excluded',texture};
 if(!own(texture))return {status:'ownership-unconfirmed',texture};
 if(texture.userData.surfaceProvenanceV38)return {...texture.userData.surfaceProvenanceV38,texture,reused:true};
 const image=texturePixels(texture);
 if(!image)return {status:texture.image?.getContext?'dynamic-canvas-existing-frame-record':'unsupported-pixel-source',texture};
 if(image.width*image.height>MAX_TEXTURE_PIXELS)return {status:'pixel-budget-exceeded',texture,pixels:image.width*image.height};
 const blocks=Math.ceil(image.width/TEXTURE_BLOCK)*Math.ceil(image.height/TEXTURE_BLOCK);let completeBlocks=0,maxDelta=0;
 for(let i=0;i<blocks;i++){const block=textureBlock(image,i,texturePacket(i));if(block.completeCapacity)completeBlocks++;maxDelta=Math.max(maxDelta,block.maxDelta);}
 texture.needsUpdate=true;
 const record={version:VERSION,handle:HANDLE,status:completeBlocks?'encoded':'capacity-limited',rgbBitPlane:1,alphaUnchanged:true,existingBitPlane0Unchanged:true,blockSize:TEXTURE_BLOCK,blocks,completeBlocks,pixels:image.width*image.height,maxDelta};
 texture.userData.surfaceProvenanceV38=record;
 return {...record,texture,reused:false};
}

function installMissingGeometryRecord(geometry,scope){
 if(geometry.getAttribute('rpAuthor')||!geometry.attributes.position)return 0;
 const sequence=encoder.encode(HANDLE+'|'+attribution.modelId+'|RP38|'+scope),bytes=new Uint8Array(geometry.attributes.position.count*4);
 for(let i=0;i<bytes.length;i++)bytes[i]=sequence[i%sequence.length];geometry.setAttribute('rpAuthor',new T.Uint8BufferAttribute(bytes,4));
 geometry.userData.attribution={handle:HANDLE,modelId:attribution.modelId,scope:'Concept group procedural geometry'};
 if(geometry.parameters){geometry.userData.sourcePrimitive??=geometry.type;delete geometry.parameters;geometry.type=geometry.isInstancedBufferGeometry?'InstancedBufferGeometry':'BufferGeometry';geometry.toJSON=T.BufferGeometry.prototype.toJSON;}
 return bytes.byteLength;
}

function isGlass(mesh,glassMaterials){
 return materials(mesh).some(m=>glassMaterials.has(m)||m.userData?.referenceGlazing||m.transparent&&m.opacity<.65&&!/screen|television|mirror|light|glow|shadow/i.test(mesh.name))||/glazing|glass|window|balustrade/i.test(mesh.name)&&!(/frame|mullion|shadow/i.test(mesh.name));
}

function apply(input,{label='scene',authored=false,glassMaterials=new Set(),paneMeshes=[]}={}){
 const root=input?.root??input;if(!root?.isObject3D)throw new TypeError('A scene or its model wrapper is required.');
 if(installedRoots.has(root))return installedRoots.get(root);
 if(!authored&&!own(root))throw new Error('Surface records require an explicitly authored concept scene.');
 const panes=[],textures=[],geometries=new Set(),textureSeen=new Set(),meshSeen=new Set();let addedGeometryBytes=0,existingGeometryRecords=0;
 const addPane=(mesh,scope,ranges)=>{if(!mesh?.geometry||meshSeen.has(mesh)||excludedTree(mesh)||excluded(mesh.geometry))return;meshSeen.add(mesh);const record=installPaneRecords(mesh,scope,ranges);if(record)panes.push(record);};
 for(const pane of paneMeshes)addPane(pane.mesh,pane.scope,pane.ranges);
 root.traverse(mesh=>{
  if(!mesh.isMesh||excludedTree(mesh)||excluded(mesh.geometry))return;
  const geometry=mesh.geometry;if(!geometries.has(geometry)){geometries.add(geometry);if(geometry.getAttribute('rpAuthor'))existingGeometryRecords++;else addedGeometryBytes+=installMissingGeometryRecord(geometry,label+'/geometry-'+geometries.size);}
  if(isGlass(mesh,glassMaterials))addPane(mesh,label+'/glass-'+panes.length);
  for(const material of materials(mesh))for(const slot of colorSlots){const texture=material[slot];if(texture&&!textureSeen.has(texture)){textureSeen.add(texture);textures.push(stampOwnedTexture(texture));}}
 });
 const stats={version:VERSION,geometries:geometries.size,existingGeometryRecords,addedGeometryBytes,paneMeshes:panes.length,paneCount:panes.reduce((n,p)=>n+p.paneCount,0),instancePanes:panes.filter(p=>p.instanced).reduce((n,p)=>n+p.paneCount,0),paneBytes:panes.reduce((n,p)=>n+p.addedBytes,0),textures:textures.length,encodedTextures:textures.filter(t=>t.completeBlocks>0).length,completeTextureBlocks:textures.reduce((n,t)=>n+(t.completeBlocks||0),0),texturePixels:textures.filter(t=>t.rgbBitPlane===1).reduce((n,t)=>n+(t.pixels||0),0),excludedTexturePixels:textures.filter(t=>t.status==='pixel-budget-exceeded').reduce((n,t)=>n+(t.pixels||0),0),additionalMeshes:0,additionalDrawCalls:0,additionalMaterials:0,additionalTextures:0};
 root.userData.surfaceProvenanceV38={handle:HANDLE,...stats};let disposed=false;
 const api={stats,panes,textures,geometries,verify(){
  const paneResults=panes.map(p=>{let complete=0;for(let i=0;i<p.recordCount;i++)if(readPaneProvenance(p.geometry,i).complete)complete++;return {scope:p.scope,recordCount:p.recordCount,paneCount:p.paneCount,completeRecords:complete,complete:complete===p.recordCount};});
  const textureResults=textures.map(t=>{let complete=0;for(let i=0;i<(t.blocks||0);i++)if(readTextureSurfaceProvenance(t.texture,i).complete)complete++;return {name:t.texture.name,status:t.status,completeBlocks:complete,expectedCompleteBlocks:t.completeBlocks||0,complete:complete===(t.completeBlocks||0)};});
  return {panes:paneResults,textures:textureResults,complete:paneResults.every(p=>p.complete)&&textureResults.every(t=>t.complete)};
 },dispose(){if(disposed)return;disposed=true;installedRoots.delete(root);panes.length=0;textures.length=0;geometries.clear();},get disposed(){return disposed;}};
 installedRoots.set(root,api);return api;
}

export function applySurfaceProvenance(model,options={}){
 const paneMeshes=[],glassMaterials=new Set(options.glassMaterials||[]);
 for(const [id,tower]of model.towers||[])paneMeshes.push({mesh:tower.windows,scope:'complex/tower-'+id+'/windows'});
 if(model.shopWindows)paneMeshes.push({mesh:model.shopWindows,scope:'complex/commercial/windows'});
 for(const material of [model.salesOffice?.materials?.glass,model.arenaExterior?.materials?.glass])if(material)glassMaterials.add(material);
 return apply(model,{label:'complex',...options,paneMeshes,glassMaterials});
}

export function applyGeometryTree(input,options={}){
 const paneMeshes=[];
 if(input?.glazing&&input?.facadeRegistration?.windows){
  const ranges=input.facadeRegistration.windows.flatMap(w=>w.panes.map(p=>({count:(p.points.length-1)*6})));
  paneMeshes.push({mesh:input.glazing,scope:'apartment/'+(input.data?.id??options.label??'plan')+'/windows',ranges});
 }
 return apply(input,{...options,paneMeshes});
}
