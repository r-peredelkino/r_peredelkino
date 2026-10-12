// @r_peredelkino · the three-unit service group visible beside the arena in 12.03.33.
// Placement and component sizes are reconstructed; existing roof contours are untouched.
import * as THREE from './vendor/three.module.js';

function convexHull(points){
 const sorted=points.map(p=>[p[0],p[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p)}return out};
 return [...half(sorted).slice(0,-1),...half(sorted.slice().reverse()).slice(0,-1)];
}
export function createArenaServiceEquipment({materials,roofLevel,serviceRoofContains}){
 const meshes=[],footprintPoints=[],units=[{x:-48,z:-5,width:4.4,depth:1.55,height:1.25},{x:-44,z:1.4,width:4.8,depth:1.7,height:1.42},{x:-43.4,z:8,width:3.8,depth:1.5,height:1.10}];
 const add=(geometry,material,x,y,z,name)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,roofLevel+y,z);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;meshes.push(mesh);return mesh};
 const box=(w,h,d,x,y,z,material,name='Arena roof air-handling casing')=>add(new THREE.BoxGeometry(w,h,d),material,x,y+h/2,z,name);
 for(const [index,u] of units.entries()){
  const {x,z,width:w,depth:d,height:h}=u;
  for(const side of [-1,1])box(w+.14,.14,.12,x,.04,z+side*d*.34,materials.dark,'Raised service support rail');
  box(w,h,d,x,.20,z,materials.metal);box(w+.10,.06,d+.10,x,.20+h,z,materials.metal,'Folded weather cap');
  for(const part of [-.25,0,.25])box(.024,h-.10,.016,x+w*part,.25,z+d/2+.012,materials.dark,'Service casing panel joint');
  for(let row=0;row<8;row++)box(w*.28,.032,.025,x-w*.29,.35+row*.088,z+d/2+.022,materials.dark,'Air intake louvre');
  const fanX=x+w*.25,fanY=.20+h*.56,fanZ=z+d/2+.07,r=.38;
  const disc=new THREE.CylinderGeometry(r,r,.10,28);disc.rotateX(Math.PI/2);add(disc,materials.dark,fanX,fanY,fanZ,'Recessed circular service fan');
  add(new THREE.TorusGeometry(r,.027,6,28),materials.metal,fanX,fanY,fanZ+.055,'Service fan rim');
  for(let blade=0;blade<5;blade++){
   const angle=blade/5*Math.PI*2,mesh=box(.25,.068,.025,fanX+Math.cos(angle)*.17,fanY+Math.sin(angle)*.17-.034,fanZ+.065,materials.metal,'Service fan blade');mesh.rotation.z=angle+.3;
  }
  // A distinct small terminal, rather than another copy of the whole main unit.
  if(index===2){box(.95,.52,.86,x-.3,.20,z+1.8,materials.metal,'Low service terminal');box(.90,.38,.56,x-.3,.31,z+1.07,materials.metal,'Short terminal duct');}
 }
 const ducts=[
  {x:-41.8,z:1.5,width:.64,depth:13.6},
  {x:-43.9,z:-5,width:4.2,depth:.62},
  {x:-42.0,z:1.4,width:1.65,depth:.68},
  {x:-42.0,z:8,width:1.65,depth:.62}
 ];
 for(const duct of ducts){
  box(duct.width,.48,duct.depth,duct.x,.34,duct.z,materials.metal,'Low rectangular branch duct');
  const length=Math.max(duct.width,duct.depth),alongX=duct.width>duct.depth;
  for(let distance=-length/2+.6;distance<length/2-.2;distance+=1.25)box(alongX?.035:duct.width+.045,.032,alongX?duct.depth+.045:.035,duct.x+(alongX?distance:0),.826,duct.z+(alongX?0:distance),materials.dark,'Duct section collar');
 }
 let top=roofLevel;
 for(const mesh of meshes){
  mesh.updateMatrix();mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);top=Math.max(top,bounds.max.y);
  for(const x of [bounds.min.x,(bounds.min.x+bounds.max.x)/2,bounds.max.x])for(const z of [bounds.min.z,(bounds.min.z+bounds.max.z)/2,bounds.max.z]){
   if(!serviceRoofContains(x,z,.10)){meshes.forEach(m=>m.geometry.dispose());throw new RangeError(`Arena service equipment would leave the usable roof at ${x.toFixed(3)}, ${z.toFixed(3)}`)}
  }
  footprintPoints.push([bounds.min.x,bounds.min.z],[bounds.max.x,bounds.min.z],[bounds.max.x,bounds.max.z],[bounds.min.x,bounds.max.z]);
 }
 const footprint=convexHull(footprintPoints),xs=footprint.map(p=>p[0]),zs=footprint.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 return{meshes,metadata:{x:(minX+maxX)/2,z:(minZ+maxZ)/2,angle:0,width:maxX-minX,depth:maxZ-minZ,base:roofLevel,height:top-roofLevel,footprint,kind:'arena-reference-service-group',sourceViews:['12.03.33','12.03.41'],units,ducts,estimatedDimensions:true}};
}
