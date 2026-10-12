// Existing low buildings complete the actual street and courtyard footprints.
import * as THREE from './vendor/three.module.js';
import {geoToWorld,metersToModel} from './geo-reference.js?v=references37';
import {contextServiceFootprints} from './context-services-data.js?v=references37';
import {batchStatic} from './scene-batches.js?v=references37';

export const registeredContextFootprints=contextServiceFootprints.map(b=>({...b,world:b.coordinates.slice(0,-1).map(p=>{const q=geoToWorld(...p);return[q[0],q[2]];})}));
const distance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const inside=(x,z,ps)=>{let yes=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++)if((ps[i][1]>z)!==(ps[j][1]>z)&&x<(ps[j][0]-ps[i][0])*(z-ps[i][1])/(ps[j][1]-ps[i][1])+ps[i][0])yes=!yes;return yes;};

export function createContextServices(parent){
 const group=new THREE.Group();group.name='Mapped low buildings and courtyard service structures';parent.add(group);
 const wall=new THREE.MeshStandardMaterial({color:0xb8bdb7,roughness:.92}),roof=new THREE.MeshStandardMaterial({color:0x686e6a,roughness:.94}),glass=new THREE.MeshStandardMaterial({color:0x48616c,roughness:.3,metalness:.18}),frame=new THREE.MeshStandardMaterial({color:0xdfe3dc,roughness:.8});
 const all=registeredContextFootprints.filter(b=>!['shopping','medical','utility'].includes(b.role));
 const records=[],windowMatrices=[],dummy=new THREE.Object3D(),cube=new THREE.BoxGeometry(1,1,1);
 function mesh(geo,material,name){const o=new THREE.Mesh(geo,material);o.name=name;o.castShadow=o.receiveShadow=true;group.add(o);return o;}
 function edgeBox(a,b,y,w,h,material,name){const dx=b[0]-a[0],dz=b[1]-a[1],o=mesh(new THREE.BoxGeometry(Math.hypot(dx,dz),h,w),material,name);o.position.set((a[0]+b[0])/2,y+h/2,(a[1]+b[1])/2);o.rotation.y=-Math.atan2(dz,dx);return o;}
 for(const b of all){
  const levels=b.levels??b.estimatedLevels,h=metersToModel(levels*3.15+.65),base=-.65,shape=new THREE.Shape(b.world.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:h,steps:1,bevelEnabled:false});geo.rotateX(-Math.PI/2);const shell=mesh(geo,wall,b.address);shell.position.y=base;
  const rg=new THREE.ShapeGeometry(shape);rg.rotateX(-Math.PI/2);const top=mesh(rg,roof,b.address+' / flat roof');top.position.y=base+h+.018;
  const signed=b.world.reduce((s,p,i)=>{const q=b.world[(i+1)%b.world.length];return s+p[0]*q[1]-q[0]*p[1];},0);
  for(let i=0;i<b.world.length;i++){
   const a=b.world[i],c=b.world[(i+1)%b.world.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);if(len<.1)continue;
   edgeBox(a,c,base+h,.16,.30,wall,'Low roof parapet');
   if(len<metersToModel(4)||b.role.startsWith('courtyard-45'))continue;
   const nx=(signed>0?dz:-dz)/len,nz=(signed>0?-dx:dx)/len,bays=Math.max(1,Math.floor(len/metersToModel(4.1)));
   for(let floor=0;floor<levels;floor++)for(let k=0;k<bays;k++){
    const u=(k+.5)/bays,x=a[0]+dx*u,z=a[1]+dz*u,y=base+metersToModel(.9+floor*3.15),width=Math.min(len/bays*.61,metersToModel(2.2)),height=metersToModel(b.role==='parking'?1.0:1.6);
    dummy.position.set(x+nx*.06,y+height/2,z+nz*.06);dummy.rotation.set(0,Math.atan2(nx,nz),0);dummy.scale.set(width,height,.07);dummy.updateMatrix();windowMatrices.push(dummy.matrix.clone());
    const tangent=[dx/len,dz/len];for(const side of [-1,1]){const p=[x+tangent[0]*width*.53*side,z+tangent[1]*width*.53*side];const q=[p[0]+tangent[0]*.08,p[1]+tangent[1]*.08];edgeBox(q,p,y,.10,height,frame,'Low-rise window jamb');}
   }
  }
  records.push({osmWayId:b.id,address:b.address,role:b.role,footprintWorld:b.world,levels:b.levels,estimatedLevels:b.levels===null?levels:null,heightEstimated:true,height:h});
 }
 const panes=new THREE.InstancedMesh(cube,glass,windowMatrices.length);panes.name='Low-rise recessed windows';windowMatrices.forEach((m,i)=>panes.setMatrixAt(i,m));panes.instanceMatrix.needsUpdate=true;panes.computeBoundingSphere();group.add(panes);batchStatic(group);
 const reserved=(x,z,margin=0)=>registeredContextFootprints.some(b=>inside(x,z,b.world)||b.world.some((p,i)=>distance([x,z],p,b.world[(i+1)%b.world.length])<margin));
 const metadata={version:28,buildings:records,source:'OpenStreetMap building polygons; referenced facade proportions, height estimates by storeys.',drawCalls:group.children.length};group.userData.contextServices=metadata;
 return{group,metadata,reserved,setSeason(winter){roof.color.set(winter?0xd5dfdd:0x686e6a);}};
}
