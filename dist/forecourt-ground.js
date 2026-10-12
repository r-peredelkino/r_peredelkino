// @r_peredelkino · common reference-frontage geometry, in fixed model coordinates.
import {forecourtReference as reference} from './forecourt-reference-data.js?v=publication371';
import * as THREE from './vendor/three.module.js';

export function distanceToFrontageCurb(x,z){
 let distance=Infinity;
 const points=reference.frontageCurb;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
  const t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/d)):0;
  distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
 }
 return distance;
}

// This replaces only duplicate generic sidewalk/curb, poles and rails along the
// source-traced forecourt edge. Carriageways and their movement graph are intact.
export function forecourtRoadsideReserved(x,z,margin=0){
 return distanceToFrontageCurb(x,z)<2.05+Math.max(0,margin);
}

export function frontageGroundHeight(x,z){
 const section=reference.groundSection??{width:3,curbY:-.30,plazaY:-.013};
 return THREE.MathUtils.lerp(section.curbY,section.plazaY,Math.min(1,distanceToFrontageCurb(x,z)/section.width));
}

export function addFrontageGrade(parent,material){
 const meshes=[];
 for(const contour of reference.gradedPavingParts??[]){
  const shape=new THREE.Shape(contour.outer.map(([x,z])=>new THREE.Vector2(x,-z)));
  for(const hole of contour.holes??[])shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++)position.setY(i,frontageGroundHeight(position.getX(i),position.getZ(i)));
  position.needsUpdate=true;geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Continuous graded paving at the photographed road edge';mesh.receiveShadow=true;mesh.userData.referenceVersion=29;parent.add(mesh);meshes.push(mesh);
 }
 return meshes;
}
