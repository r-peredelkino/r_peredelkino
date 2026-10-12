// @r_peredelkino · RP-CONCEPT-2026-10-07
// Exact traced edge: a spline through uneven Boolean-union vertices overshot
// at the 4–5 connection. Retain every source coordinate and its actual closure.
import * as THREE from './vendor/three.module.js';
import {smoothWallNormals} from './facade-detail.js?v=community38';

const cleanRing=source=>{
 const points=[];for(const p of source)if(!points.length||Math.hypot(p[0]-points.at(-1)[0],p[1]-points.at(-1)[1])>1e-7)points.push([...p]);
 if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7)points.pop();return points;
};

export function createTracedFanSlabGeometry(source,depth){
 const s=new THREE.Shape(cleanRing(source.outer).map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const h of source.holes)s.holes.push(new THREE.Path(cleanRing(h).map(([x,z])=>new THREE.Vector2(x,-z))));
 const raw=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:1,steps:1});raw.rotateX(-Math.PI/2);
 const p=raw.attributes.position,n=raw.attributes.normal,u=raw.attributes.uv,positions=[],normals=[],uv=[];let removed=0;
 for(let i=0;i<p.count;i+=3){
  const ax=p.getX(i+1)-p.getX(i),ay=p.getY(i+1)-p.getY(i),az=p.getZ(i+1)-p.getZ(i),bx=p.getX(i+2)-p.getX(i),by=p.getY(i+2)-p.getY(i),bz=p.getZ(i+2)-p.getZ(i);
  if(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)<1e-9){removed++;continue;}
  for(let j=i;j<i+3;j++){positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j),n.getY(j),n.getZ(j));uv.push(u.getX(j),u.getY(j));}
 }
 raw.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));smoothWallNormals(g);g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.tracedFanSlab={version:34,sourceOpenings:source.holes.length,depth,removedZeroAreaTriangles:removed,engineeringContourUnchanged:true};return g;
}

export function createTracedFanEdgeGeometry(source,y,radius=.045,radialSegments=6){
 if(source.some(p=>!p.every(Number.isFinite)))throw new RangeError('Non-finite fan edge');const points=cleanRing(source);
 if(points.length<3||!Number.isFinite(y)||!(radius>0))throw new RangeError('Invalid traced fan edge');
 const count=points.length,positions=[],normals=[],uv=[],indices=[];let distance=0,maxSegment=0;
 for(let i=0;i<=count;i++){
  const j=i%count,p=points[j],prev=points[(j+count-1)%count],next=points[(j+1)%count];
  const tx=next[0]-prev[0],tz=next[1]-prev[1],length=Math.hypot(tx,tz);if(length<1e-10)throw new RangeError('Degenerate fan edge tangent');
  const nx=tz/length,nz=-tx/length;
  if(i){const a=points[(i-1)%count],d=Math.hypot(p[0]-a[0],p[1]-a[1]);distance+=d;maxSegment=Math.max(maxSegment,d);}
  for(let k=0;k<=radialSegments;k++){
   const a=k/radialSegments*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
   positions.push(p[0]+nx*c*radius,y+s*radius,p[1]+nz*c*radius);normals.push(nx*c,s,nz*c);uv.push(distance,k/radialSegments);
   if(i<count&&k<radialSegments){const v=i*(radialSegments+1)+k;indices.push(v,v+1,v+radialSegments+1,v+1,v+radialSegments+2,v+radialSegments+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.tracedFanEdge={version:34,sourcePoints:source.length,retainedPoints:count,segments:count,maxSegment,radius,y,closed:true,curve:'exact linear source contour; no spline overshoot',engineeringContourUnchanged:true};return g;
}
