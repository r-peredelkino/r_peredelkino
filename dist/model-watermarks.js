// Distributed pixel reliefs live in existing authored architectural meshes.
// Copying remains possible; geometry and hidden provenance establish authorship.
import {attribution} from './attribution.js?v=community38';
import {installVoxelAuthorship,findHorizontalSurfacePlacement} from './voxel-authorship-v37.js?v=community38';

export function createModelWatermarks(root,towers,texture){
 const meta={...attribution};
 root.traverse(object=>{
  object.userData.attribution={...meta};
  if(object.geometry)object.geometry.userData.attribution={...meta};
  for(const material of(Array.isArray(object.material)?object.material:object.material?[object.material]:[]))material.userData.attribution={...meta};
 });
 const placements=[];
 for(const [id,tower] of towers){
  const points=tower.spec.shape,area=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0);
  let edge=null;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!edge||length>edge.length)edge={a,b,length};}
  if(edge?.length>2){
   const direction=area>0?-1:1,ux=(edge.b[0]-edge.a[0])/edge.length*direction,uz=(edge.b[1]-edge.a[1])/edge.length*direction,nx=-uz,nz=ux;
   placements.push({mesh:tower.foot,origin:[(edge.a[0]+edge.b[0])*.5125+nx*.0008,.405,(edge.a[1]+edge.b[1])*.5125+nz*.0008],u:[ux,0,uz],v:[0,1,0],pixel:.017,depth:.012,tone:.23,label:'building-'+id+'/mineral-plinth'});
  }
  const roof=tower.group.children.find(o=>o.isMesh&&!o.isInstancedMesh&&o!==tower.foot&&Math.abs(o.position.y-(tower.spec.h+1.21))<.0001);
  if(roof){const p=findHorizontalSurfacePlacement(roof,{pixel:.029,depth:.008,tone:.23,label:'building-'+id+'/inset-roof'});if(p)placements.push(p);}
 }
 const voxelAuthorship=installVoxelAuthorship(root,{placements,label:'complex',maxMarks:16});
 let disposed=false;
 return {objects:[],texture,voxelAuthorship,stats:voxelAuthorship.stats,records:voxelAuthorship.records,verify:()=>voxelAuthorship.verify(),dispose(){if(disposed)return;disposed=true;voxelAuthorship.dispose();texture?.dispose();}};
}
