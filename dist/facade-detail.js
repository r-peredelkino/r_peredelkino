// @r_peredelkino · curved glazing and facade profiles, shared by overview and walking tour.
import * as THREE from './vendor/three.module.js';
import {attribution} from './attribution.js?v=publication371';

// Average only coincident wall normals. Horizontal caps keep their crisp slab edges.
export function smoothWallNormals(g){
 const p=g.attributes.position,n=g.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))>.5)continue;const key=`${Math.round(p.getX(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`;let r=groups.get(key);if(!r){r={x:0,z:0,indices:[]};groups.set(key,r)}r.x+=n.getX(i);r.z+=n.getZ(i);r.indices.push(i)}
 for(const r of groups.values()){const l=Math.hypot(r.x,r.z)||1;for(const i of r.indices)n.setXYZ(i,r.x/l,0,r.z/l)}n.needsUpdate=true;return g;
}

// Each bay bends through its measured arc midpoint, so glass continues around every corner.
export function bendPaneMaterial(material){
 const previous=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.side=THREE.DoubleSide;
 material.onBeforeCompile=shader=>{previous(shader);shader.vertexShader=shader.vertexShader
  .replace('#include <common>','#include <common>\nattribute float paneBend;')
  .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal.x+=8.0*paneBend*position.x/(.98*.98); objectNormal=normalize(objectNormal);')
  .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=paneBend*(1.0-4.0*position.x*position.x/(.98*.98));');};
 material.customProgramCacheKey=()=>cache()+'-curved18';return material;
}

// Shared facade section: white band / frame / glazing stay aligned when their
// source-observed ratio is adjusted. The full floor pitch and tower height do
// not change; the wider band reduces the clear opening below its next datum.
export const residentialFacadeSection=Object.freeze({ribbonHeight:1.08,windowAllowance:1.12,frameAllowance:1.22,centerOffset:.38});

// Restrained grey-green day interiors from the new developer close-ups. Warm
// lamp emission is supplied by the independent night schedule, not painted as
// a yellow checkerboard into a daytime facade.
export function createRoomInteriorTexture(brand){
 const w=512,h=256,bytes=new Uint8Array(w*h*4);
 const styles=[[116,126,115],[107,119,112],[134,137,126],[123,129,121]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const theme=Math.floor(x/128),u=(x%128)/128,v=y/h,base=styles[theme];
  const curtain=u<.2||u>.85,fold=curtain?(.72+.20*Math.cos(u*160)):1;
  const ceiling=v>.87,floor=v<.21,sofa=v>.20&&v<.39&&u>.25&&u<.8;
  const lamp=Math.exp(-((u-.69)**2/.008+(v-.65)**2/.015));
  const silhouette=sofa?.56:floor?.55:ceiling?.81:1,shade=fold*silhouette*(.9+.1*Math.cos(v*3));
  const i=(y*w+x)*4;bytes.set(base.map((c,k)=>Math.min(255,Math.round(c*shade+lamp*[10,12,9][k]))).concat(255),i);
 }
 // Keep authorship in metadata and non-visible pixel provenance only.
 // The source architecture contains no application handle on its windows.
 const t=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.name='Curtained residential interiors · '+attribution.handle;t.userData.attribution={...attribution};return t;
}

// A collar around the authored exterior outline. Shape XY becomes world X,-Z;
// the bottom is Y=0 and the top is Y=height, ready for one instance per storey.
// Closing a clone matters: THREE.Shape(vertices) leaves the final side open for
// arc-length sampling even though ExtrudeGeometry closes that side itself.
export function createFacadeRibbonGeometry(shape,{columns=72,height=.72,projection=.18,wave=.28,wavePlateau=.16}={}){
 if(shape?.type!=='Shape'||!shape.curves?.length)throw new TypeError('A non-empty THREE.Shape is required for a facade ribbon.');
 if(![columns,height,projection,wave,wavePlateau].every(Number.isFinite)||columns<1||height<=0||projection<0||wave<0||wavePlateau<0||wavePlateau>=.5)throw new RangeError('Facade ribbon dimensions must be finite and non-negative; height and columns must be positive; the wave plateau must be below one half.');
 const count=Math.max(288,Math.min(432,Math.round(columns*5))),outline=shape.clone().closePath();
 const points=outline.getSpacedPoints(count).slice(0,count);
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new RangeError('The facade outline contains non-finite points.');
 const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%count];return sum+p.x*q.y-q.x*p.y},0);
 if(Math.abs(area)<1e-8)throw new RangeError('The facade outline must enclose a non-zero area.');
 // A consistent winding makes every profile face point outwards, including
// the inner return and both caps. Keep the original first point as the UV seam.
 if(area<0)points.splice(1,count-1,...points.slice(1).reverse());
 const normals=[],curvature=[],span=Math.max(2,Math.min(Math.floor(count/12),Math.round(count/columns)));
 let perimeter=0;
 for(let i=0;i<count;i++){
  const previous=points[(i+count-1)%count],p=points[i],next=points[(i+1)%count];
  const tx=next.x-previous.x,ty=next.y-previous.y,length=Math.hypot(tx,ty);
  if(length<1e-8)throw new RangeError('The facade outline has a degenerate tangent.');
  normals.push(new THREE.Vector2(ty/length,-tx/length));
  perimeter+=p.distanceTo(next);
  const a=points[(i+count-span%count)%count],b=points[(i+span)%count];
  const ax=p.x-a.x,ay=p.y-a.y,bx=b.x-p.x,by=b.y-p.y;
  const turn=Math.atan2(Math.abs(ax*by-ay*bx),ax*bx+ay*by);
  curvature.push(turn/Math.max(1e-6,(Math.hypot(ax,ay)+Math.hypot(bx,by))*.5));
 }
 // Measure bend over approximately a facade bay. A smooth envelope keeps the
// plan wave on long faces and fades it before the real rounded corner glass.
 const cycles=Math.max(1,Math.min(Math.round(columns/6),Math.floor(count/20)));
 const offsets=points.map((_,i)=>{
  const bend=(curvature[(i+count-1)%count]+2*curvature[i]+curvature[(i+1)%count])*.25;
  const t=THREE.MathUtils.clamp((bend-.012)/(.070-.012),0,1),straight=1-t*t*(3-2*t);
  // The October 11 close-ups show broad, nearly level crests joined by short
  // soft shoulders. A bare sine wave loses that silhouette even when its
  // depth is increased. Preserve the complete original outline and fade the
  // plan modulation before its rounded glazed corners, as in the source.
  const phase=.5-.5*Math.cos(i/count*Math.PI*2*cycles);
  const profile=wavePlateau?THREE.MathUtils.smoothstep(phase,wavePlateau,1-wavePlateau):phase;
  return projection+wave*straight*profile;
 });
 const bevel=Math.min(.035,height*.12),inner=-.20;
 // Six edges keep the visible chamfers without spending repeated-storey
// triangles on a sub-pixel groove: underside, bevel, face, bevel, cap, return.
 const profile=[
  {fixed:inner,y:0},{delta:-bevel,y:0},{delta:0,y:bevel},
  {delta:0,y:height-bevel},{delta:-bevel,y:height},{fixed:inner,y:height}
 ];
 const rings=profile.map(row=>points.map((p,i)=>{
  const distance=row.fixed??offsets[i]+row.delta,n=normals[i];
  return new THREE.Vector3(p.x+n.x*distance,row.y,-p.y-n.y*distance);
 }));
 // Metric U follows the actual wavy face, not its polygon indices. Every
// vertical profile section shares this U so the flutes remain continuous.
 const distances=new Float64Array(count+1),face=rings[2];
 for(let i=1;i<=count;i++)distances[i]=distances[i-1]+face[i-1].distanceTo(face[i%count]);
 const segments=profile.length,stride=count+1,vertexCount=segments*stride*2;
 const positions=new Float32Array(vertexCount*3),normalValues=new Float32Array(vertexCount*3),uvs=new Float32Array(vertexCount*2);
 const indices=new Uint16Array(segments*count*6);
 let indexAt=0;
 for(let section=0;section<segments;section++){
  const first=rings[section],second=rings[(section+1)%segments],start=section*stride*2;
  for(let row=0;row<2;row++)for(let i=0;i<=count;i++){
   const j=i%count,ring=row?second:first,p=ring[j],previous=ring[(j+count-1)%count],next=ring[(j+1)%count];
   const tx=next.x-previous.x,tz=next.z-previous.z;
   const dx=second[j].x-first[j].x,dy=second[j].y-first[j].y,dz=second[j].z-first[j].z;
   const nx=-tz*dy,ny=tz*dx-tx*dz,nz=tx*dy,length=Math.hypot(nx,ny,nz);
   if(length<1e-10)throw new RangeError('The facade profile has a degenerate face.');
   const vertex=start+row*stride+i;
   positions.set([p.x,p.y,p.z],vertex*3);
   normalValues.set([nx/length,ny/length,nz/length],vertex*3);
   // Flat caps and the hidden return sample one constant column of the bump
// texture; only the exterior and its fine bevels receive vertical fluting.
   uvs.set([section>0&&section<4?distances[i]:0,p.y],vertex*2);
  }
  for(let i=0;i<count;i++){
   const a=start+i,b=a+1,c=a+stride,d=c+1;
   indices.set([a,b,c,b,d,c],indexAt);indexAt+=6;
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(normalValues,3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
 geometry.setIndex(new THREE.BufferAttribute(indices,1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.name='Continuous level facade ribbon with rounded profile';
 geometry.userData.ribbon={samples:count,profileSegments:segments,faceSection:2,perimeter,facePerimeter:distances[count],height,projection,wave,wavePlateau,waveCycles:cycles,minPlanOffset:Math.min(...offsets),maxPlanOffset:Math.max(...offsets),sourceViews:['2026-10-11 09.29.18','2026-10-11 09.29.23'],sectionStatus:'Visual reconstruction; original floor datums and tower outline retained',units:'model units'};
 return geometry;
}

// Physical UV scale: one narrow rib every .075 model units; mipmaps let the pattern
// resolves into an even surface instead of shimmering in an overview. The
// caller owns the returned material and its independent bumpMap texture.
export function createRibbedBandMaterial(baseMaterial){
 if(!baseMaterial?.isMeshStandardMaterial)throw new TypeError('A THREE.MeshStandardMaterial is required for facade bands.');
 const material=baseMaterial.clone(),width=256,height=8,ribs=8,pitch=.075;
 const pixels=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const phase=x/width*Math.PI*2*ribs;
  const value=Math.round(255*(.50+.30*Math.cos(phase)+.08*Math.cos(phase*2)));
  pixels.set([value,value,value,255],(y*width+x)*4);
 }
 const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
 texture.colorSpace=THREE.NoColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(1/(ribs*pitch),1);
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
 texture.name='Metric vertical facade flutes · '+attribution.handle;
 texture.userData={ribPitchModelUnits:pitch,sourceViews:['2026-10-11 09.29.18','2026-10-11 09.29.23'],sectionStatus:'Visually reconstructed fine vertical fluting; not measured panel specifications',attribution:{...attribution}};
 material.bumpMap=texture;material.bumpScale=.009;
 material.roughness=Math.max(.56,material.roughness);
 // Material.copy omits these hooks. Preserve any authored base behaviour
// without wrapping or modifying its shader or program-cache implementation.
 material.onBeforeCompile=baseMaterial.onBeforeCompile;
 material.customProgramCacheKey=baseMaterial.customProgramCacheKey;
 material.name='Ribbed white facade band';
 return material;
}

// The new 12.03.23 / 12.03.24 roof views show a low stack of solid rounded
// triangular plates. The former coplanar open rings did not reproduce that
// profile. Reuse the authored tower outline without altering its footprint.
export function createRaisedRoofCrown(shape,{whiteMaterial,shadowMaterial}){
 const group=new THREE.Group(),scales=[.62,.596,.572,.548],plateHeight=.10,shadowGap=.025,whiteParts=[],shadowParts=[];
 const outline=shape.clone().closePath().getSpacedPoints(180).slice(0,180);
 const part=(scale,height,y)=>{const s=new THREE.Shape(outline.map(p=>new THREE.Vector2(p.x*scale,p.y*scale))),g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);smoothWallNormals(g);g.translate(0,y,0);return g;};
 for(let i=0;i<scales.length;i++){
  const y=i*(plateHeight+shadowGap);whiteParts.push(part(scales[i],plateHeight,y));
  if(i<scales.length-1)shadowParts.push(part(scales[i+1]*.993,shadowGap+.004,y+plateHeight-.002));
 }
 const combine=parts=>{let count=0;const source=parts.map(g=>g.index?g.toNonIndexed():g);for(const g of source)count+=g.attributes.position.count;const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);let at=0;
  source.forEach((g,i)=>{positions.set(g.attributes.position.array,at*3);normals.set(g.attributes.normal.array,at*3);uvs.set(g.attributes.uv.array,at*2);at+=g.attributes.position.count;if(g!==parts[i])g.dispose();parts[i].dispose();});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.computeBoundingBox();g.computeBoundingSphere();return g;};
 const plates=new THREE.Mesh(combine(whiteParts),whiteMaterial),joints=new THREE.Mesh(combine(shadowParts),shadowMaterial);plates.name='Four solid stepped triangular roof plates';joints.name='Recessed shadow joints between roof crown plates';
 for(const object of [plates,joints]){object.castShadow=object.receiveShadow=true;group.add(object);}
 group.name='Four raised rounded triangular roof plates with narrow shadow joints';group.userData.frames=4;group.userData.roofCrown={sourceViews:['12.03.23','12.03.24'],steps:4,scales,plateHeight,shadowGap,totalHeight:4*plateHeight+3*shadowGap,solidTop:true};return group;
}
