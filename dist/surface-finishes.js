// @r_peredelkino · shared, deterministic mineral/wood/metal finishes.
// These are authored visual finishes, not measured developer material specifications.
import * as T from './vendor/three.module.js';
import {attribution} from './attribution.js?v=community38';
import {embedPixelSignature} from './baked-authorship.js?v=community38';
export function createSurfaceFinishes(root){
 const size=128,sets=new Map(),materials=new Set();let applied=0;
 function finish(kind){
  if(sets.has(kind))return sets.get(kind);
  let seed=32671;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const color=new Uint8Array(size*size*4),height=new Uint8Array(color.length),rough=new Uint8Array(color.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const at=(y*size+x)*4,n=rnd(),wave=Math.sin(x/size*Math.PI*12+Math.sin(y/size*Math.PI*4)*.9);
   const v=kind==='wood'?239+wave*9+n*7:kind==='metal'?249+Math.sin(y*Math.PI/2)*2+n*3:kind==='asphalt'?226+n*28:244+n*10;
   const h=kind==='wood'?128+wave*38+n*15:kind==='metal'?128+Math.sin(y*Math.PI/2)*10:110+n*36;
   const r=kind==='metal'?156+n*22:kind==='asphalt'?225+n*29:210+n*24;
   color.set([v,v,v,255],at);height.set([h,h,h,255],at);rough.set([r,r,r,255],at);
  }
  const make=(bytes,slot)=>{embedPixelSignature(bytes,{label:'finish/'+kind+'/'+slot});const map=new T.DataTexture(bytes,size,size,T.RGBAFormat);map.name=`${attribution.handle} · ${kind} · ${slot}`;map.wrapS=map.wrapT=T.RepeatWrapping;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=4;map.colorSpace=slot==='color'?T.SRGBColorSpace:T.NoColorSpace;map.userData.attribution={...attribution};map.userData.finish={kind,procedural:true,sourceSpecification:false};map.needsUpdate=true;return map;};
  const set={map:make(color,'color'),bumpMap:make(height,'height'),roughnessMap:make(rough,'roughness')};sets.set(kind,set);return set;
 }
 root.traverse(o=>{for(const mat of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){
  if(materials.has(mat))continue;materials.add(mat);
  if(!mat.isMeshStandardMaterial||mat.map||mat.transparent||mat.alphaTest||mat.userData.foliage||mat.roughness<.32||mat.emissiveIntensity>.8)continue;
  const name=(o.name+' '+mat.name).toLowerCase();
  const kind=/trunk|bark|\bwood\b|bench|timber/.test(name)?'wood':/road|street|carriage|asphalt/.test(name)?'asphalt':mat.metalness>.3?'metal':'mineral';
  const set=finish(kind);mat.map=set.map;
  const architectural=/office|ribbon|slab|cornice|mineral|acoustic|retail|shelv|gallery|floor/.test(name);
  if(architectural)mat.roughnessMap=set.roughnessMap;
  if(architectural&&!mat.bumpMap){mat.bumpMap=set.bumpMap;mat.bumpScale=kind==='wood'?.018:kind==='asphalt'?.012:.004;}
  mat.userData.surfaceFinish={kind,revision:32,measured:false};mat.needsUpdate=true;applied++;
 }});
 root.userData.surfaceFinishes={applied,sharedTextureSets:sets.size,authored:true};
 return{get stats(){return root.userData.surfaceFinishes},dispose(){for(const set of sets.values())for(const map of Object.values(set))map.dispose();}};
}
