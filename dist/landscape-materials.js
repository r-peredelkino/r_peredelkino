// @r_peredelkino · porous leaf surfaces and mineral finishes for the reference landscape.
import * as THREE from './vendor/three.module.js';
import {attribution} from './attribution.js?v=community38';

function randomSource(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function authoredTexture(bytes,size,name){
 const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
 texture.name=name;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 texture.userData.attribution={...attribution};texture.needsUpdate=true;return texture;
}

export function createLeafTexture(evergreen=false,dense=false){
 const size=128,bytes=new Uint8Array(size*size*4),random=randomSource(evergreen?241027:241009);
 for(let i=0;i<bytes.length;i+=4){bytes[i]=bytes[i+1]=bytes[i+2]=220;bytes[i+3]=0}
 // Many individual leaflets leave small gaps through each three-dimensional crown.
 // Tiling is periodic, so the poles and seams never form rectangular cut-outs.
 const count=dense?(evergreen?330:190):(evergreen?210:104);
 for(let leaf=0;leaf<count;leaf++){
  const cx=random()*size,cy=random()*size,a=random()*Math.PI*2;
  const rx=evergreen?2.0+random()*2.2:4.3+random()*4.9,ry=evergreen?6.0+random()*4.0:2.6+random()*3.1;
  const reach=Math.ceil(Math.max(rx,ry))+1,c=Math.cos(a),s=Math.sin(a),tone=.76+random()*.24;
  for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
   const u=(dx*c+dy*s)/rx,v=(-dx*s+dy*c)/ry,d=u*u+v*v;
   if(d>1)continue;const x=(Math.floor(cx)+dx+size)%size,y=(Math.floor(cy)+dy+size)%size,at=(y*size+x)*4;
   const edge=Math.min(1,(1-d)*6),light=tone*(.91+.09*(1-u));
   bytes[at]=Math.round(255*light);bytes[at+1]=Math.round(255*light);bytes[at+2]=Math.round(238*light);bytes[at+3]=Math.max(bytes[at+3],Math.round(edge*255));
  }
 }
 return authoredTexture(bytes,size,evergreen?'Fine pine needles · authored foliage':'Individual leaflets · authored foliage');
}

export function createFoliageMaterial(color,{evergreen=false,dense=false}={}){
 const map=createLeafTexture(evergreen,dense);
 // Dense interior leaf clusters keep mature crowns opaque in the distance;
 // fine alpha-cut leaf edges remain visible in a close pedestrian view.
 const material=new THREE.MeshStandardMaterial({color,map,alphaTest:dense?.28:.40,side:THREE.DoubleSide,
  roughness:.90,metalness:0,vertexColors:true});
 material.userData.foliage={evergreen,dense};return material;
}

export function createMineralMaterial(color,{grain=.08,scale=1,name='Mineral surface'}={}){
 const size=128,bytes=new Uint8Array(size*size*4),random=randomSource(246911);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const at=(y*size+x)*4,n=1-grain+random()*grain,v=Math.round(255*n);
  bytes.set([v,v,v,255],at);
 }
 const map=authoredTexture(bytes,size,name);map.repeat.set(scale,scale);
 return new THREE.MeshStandardMaterial({color,map,bumpMap:map,bumpScale:.008,roughness:.94});
}

export function disposeOwnedMaterials(materials){
 const maps=new Set();for(const material of new Set(Object.values(materials))){
  for(const slot of ['map','bumpMap','normalMap','alphaMap','emissiveMap'])if(material[slot])maps.add(material[slot]);
  material.dispose();
 }for(const map of maps)map.dispose();
}
