// @r_peredelkino · Ground-level courtyard paving from published OSM road axes.
// Widths and sparse oneway arrows are estimates; there is no local traffic graph.
import * as THREE from './vendor/three.module.js';
import {geoToWorld,metersToModel} from './geo-reference.js?v=community38';
import {localAccessReference,localAccessRoadData} from './local-access-data.js?v=community38';

const M=metersToModel,GROUND_Y=-.48,EPS=1e-8;
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
function segmentDistance(p,a,b){const x=b[0]-a[0],z=b[1]-a[1],t=clamp(((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1));return distance(p,[a[0]+x*t,a[1]+z*t]);}
function triangleDistance(p,a,b,c){
 const signs=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];
 if(signs.every(v=>v>=-EPS)||signs.every(v=>v<=EPS))return 0;
 return Math.min(segmentDistance(p,a,b),segmentDistance(p,b,c),segmentDistance(p,c,a));
}

export function createLocalAccess(parent){
 const group=new THREE.Group();group.name='Published courtyard access roads around addressed neighbours';parent.add(group);
 const mats={
  asphalt:new THREE.MeshStandardMaterial({color:0x4d5151,roughness:.96,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}),
  restricted:new THREE.MeshStandardMaterial({color:0x565957,roughness:.96,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}),
  arrow:new THREE.MeshStandardMaterial({color:0xc9c8ba,roughness:.9})
 };
 const batches={public:[],restricted:[],arrow:[]},triangleReservations=[],arrows=[],renderedSegments=[];
 const point=(p)=>{const v=geoToWorld(p[0],p[1],GROUND_Y);return[v[0],v[2]];};
 const roads=localAccessRoadData.map(raw=>{
  const points=raw.coordinates.map(point),segments=raw.pieces.map((part,index)=>{
   const a=points[part.sourceSegment],b=points[part.sourceSegment+1];
   return {...part,index,a:mix(a,b,part.t0),b:mix(a,b,part.t1)};
  });
  return {...raw,sourceWayId:raw.osmWayId,width:M(raw.widthMeters),pointsWorld:points.map(p=>[p[0],GROUND_Y,p[1]]),segments};
 });
 function tri(kind,a,b,c,y=GROUND_Y,road=null){
  if(Math.abs(cross(a,b,c))<EPS)return;
  if(cross(a,b,c)>0)[b,c]=[c,b];
  batches[kind].push(a[0],y,a[1],b[0],y,b[1],c[0],y,c[1]);
  if(kind!=='arrow')triangleReservations.push({a,b,c,sourceWayId:road.sourceWayId,
   bounds:[Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1])]});
 }
 function ribbon(kind,a,b,width,y,road){
  const d=distance(a,b);if(d<EPS)return;
  const px=-(b[1]-a[1])/d*width/2,pz=(b[0]-a[0])/d*width/2;
  const p=[a[0]+px,a[1]+pz],q=[b[0]+px,b[1]+pz],r=[b[0]-px,b[1]-pz],s=[a[0]-px,a[1]-pz];
  tri(kind,p,q,r,y,road);tri(kind,p,r,s,y,road);
 }
 function disc(kind,p,r,road){
  // Inscribed 12-sided round caps cannot exceed the verified road capsule.
  const count=12;for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
   tri(kind,p,[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r],[p[0]+Math.cos(b)*r,p[1]+Math.sin(b)*r],GROUND_Y,road);
  }
 }
 for(const road of roads){
  const kind=road.access.restricted?'restricted':'public',caps=new Set();
  for(const s of road.segments){
   ribbon(kind,s.a,s.b,road.width,GROUND_Y,road);
   renderedSegments.push({roadId:road.id,sourceWayId:road.sourceWayId,sourceSegment:s.sourceSegment,t0:s.t0,t1:s.t1,a:s.a,b:s.b,width:road.width});
   for(const p of [s.a,s.b]){const key=p.map(v=>v.toFixed(7)).join(',');if(!caps.has(key)){caps.add(key);disc(kind,p,road.width/2,road);}}
  }
  // Only explicitly tagged oneway roads get any directional paint. These
  // sparse arrows communicate source direction, not a claim about actual paint.
  if(road.oneway && !road.access.restricted){
   let last=null,count=0;
   for(const s of road.segments){
    const len=distance(s.a,s.b);if(len<M(14)||count>=3)continue;
    const at=mix(s.a,s.b,.5);if(last&&distance(at,last)<M(35))continue;
    const dir=[(s.b[0]-s.a[0])/len*road.oneway,(s.b[1]-s.a[1])/len*road.oneway],left=[-dir[1],dir[0]];
    const p=(across,along)=>[at[0]+left[0]*M(across)+dir[0]*M(along),at[1]+left[1]*M(across)+dir[1]*M(along)];
    ribbon('arrow',p(0,-1.1),p(0,.62),M(.13),GROUND_Y+.012,road);
    tri('arrow',p(-.44,.45),p(0,1.22),p(.44,.45),GROUND_Y+.012,road);
    arrows.push({sourceWayId:road.sourceWayId,sourceSegment:s.sourceSegment,oneway:road.oneway,pointWorld:[at[0],GROUND_Y+.012,at[1]],directionWorld:dir,markingSource:'Estimated sparse indicator of explicit OSM oneway direction'});
    last=at;count++;
   }
  }
 }
 const meshes=[];
 for(const kind of ['public','restricted','arrow']){
  const positions=batches[kind];if(!positions.length)continue;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,kind==='public'?mats.asphalt:kind==='restricted'?mats.restricted:mats.arrow);
  mesh.name=kind==='arrow'?'Local courtyard arrows · explicit OSM oneway':`Local courtyard asphalt · ${kind}`;
  mesh.userData.surfaceKind=kind==='arrow'?'local-access-direction-markings':'local-access-asphalt';
  mesh.userData.accessClass=kind;
  mesh.userData.sourceWayIds=roads.filter(r=>kind==='arrow'?r.oneway&&!r.access.restricted:(kind==='restricted')===r.access.restricted).map(r=>r.sourceWayId);
  mesh.receiveShadow=true;mesh.castShadow=false;group.add(mesh);meshes.push(mesh);
 }
 // Actual paving triangles, not a world-sized box, reserve the ground for
 // vegetation. The grid only accelerates candidate lookup; circle/triangle
 // distance determines the result, including wide crown clearance margins.
 const grid=new Map(),cell=M(24);
 const key=(x,z)=>`${x}:${z}`;
 for(let i=0;i<triangleReservations.length;i++){
  const b=triangleReservations[i].bounds;
  for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let z=Math.floor(b[1]/cell);z<=Math.floor(b[3]/cell);z++){
   const k=key(x,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);
  }
 }
 function reserved(x,z,margin=0){
  margin=Math.max(0,Number(margin)||0);const p=[x,z],seen=new Set();
  for(let i=Math.floor((x-margin)/cell);i<=Math.floor((x+margin)/cell);i++)for(let j=Math.floor((z-margin)/cell);j<=Math.floor((z+margin)/cell);j++){
   for(const index of grid.get(key(i,j))||[]){
    if(seen.has(index))continue;seen.add(index);const t=triangleReservations[index],b=t.bounds;
    if(x<b[0]-margin||x>b[2]+margin||z<b[1]-margin||z>b[3]+margin)continue;
    if(triangleDistance(p,t.a,t.b,t.c)<=margin+EPS)return true;
   }
  }
  return false;
 }
 let wetness=0,season='summer';
 function updateMaterials(){
  const winter=season===true||season==='winter';
  mats.asphalt.color.setHex(winter?0x757b7a:0x4d5151).multiplyScalar(1-wetness*.18);
  mats.restricted.color.setHex(winter?0x7c817c:0x565957).multiplyScalar(1-wetness*.18);
  mats.asphalt.roughness=mats.restricted.roughness=.96-wetness*.48;
  mats.arrow.color.setHex(winter?0xd2d6ca:0xc9c8ba);
 }
 function setWetness(value){wetness=clamp(value);updateMaterials();}
 function setSeason(value){season=value;updateMaterials();}
 const metadata={version:28,sourceUrl:localAccessReference.sourceUrl,sourceSha256:localAccessReference.sourceSha256,
  attribution:localAccessReference.attribution,attributionUrl:localAccessReference.attributionUrl,license:localAccessReference.license,
  selection:localAccessReference.selection,accuracy:localAccessReference.accuracy,
  roadCount:roads.length,sourceWayIds:roads.map(r=>r.sourceWayId),sourceSegmentCount:renderedSegments.length,
  lengthMeters:roads.reduce((sum,r)=>sum+r.lengthMeters,0),onewayRoadCount:roads.filter(r=>r.oneway).length,
  restrictedRoadCount:roads.filter(r=>r.access.restricted).length,footwayCount:0,animatedVehicleCount:0,signalCount:0,
  groundY:GROUND_Y,drawCalls:meshes.length,triangles:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0),
  directionalArrows:arrows,renderedSegments,
  accessInterpretation:'Display of published physical road surfaces only. All access and barrier tags remain in roads; no public routing assumption or traffic animation.',
  reservations:'Exact rendered asphalt triangles plus requested radial margin; no bounding-box fill of neighbouring courtyards.'};
 group.userData.localAccess=metadata;
 function dispose(){parent.remove(group);for(const mesh of meshes)mesh.geometry.dispose();for(const material of Object.values(mats))material.dispose();}
 return {group,roads,metadata,reserved,setSeason,setWetness,materials:mats,dispose};
}
