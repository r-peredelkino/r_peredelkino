// Actual v24 exterior geometry, vegetation, access and resource ownership.
import assert from 'node:assert/strict';
import * as T from '../../dist/vendor/three.module.js';
import {createComplex} from '../../dist/complex-model.js';
import {salesOfficeLayout as layout,salesOfficePoint,distanceToSalesDrive,salesOfficeReserved} from '../../dist/sales-office.js';
import {createTourWorld,createTourDestinations} from '../../dist/walking-tour.js';
import {solidContains,segmentDistance} from '../../dist/walk-physics.js';
import {complexFootprints as f} from '../../dist/complex-footprints.js';

const m=createComplex(),office=m.salesOffice,forest=m.neighborhood.forestGroup,world=createTourWorld(m);
const geometries=new Set(),textures=new Set(),instances=[];
for(const group of [office.group,forest])group.traverse(o=>{
 if(o.geometry)geometries.add(o.geometry);
 if(o.isInstancedMesh)instances.push(o);
 for(const material of [o.material??[]].flat())for(const key of ['map','bumpMap'])if(material[key])textures.add(material[key]);
});
const disposed={geometry:new Set(),texture:new Set(),instance:new Set()};
geometries.forEach(g=>g.addEventListener('dispose',()=>disposed.geometry.add(g)));
textures.forEach(t=>t.addEventListener('dispose',()=>disposed.texture.add(t)));
instances.forEach(i=>i.addEventListener('dispose',()=>disposed.instance.add(i)));
let result;
try{
 assert.equal(office.office.parent,office.group);assert.equal(office.group.parent,m.root);
 assert.equal(forest.parent,m.root,'Forest stays visible when urban context is hidden');
 m.root.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(office.office),size=box.getSize(new T.Vector3());
 assert.ok(size.y>5.3&&size.y<5.6,'The built office includes its high rear roof');
 assert.ok(size.x>20&&size.z>20,'The actual oriented office volume has its full footprint');
 assert.ok(!world.free(...office.center),'Office walls block walking');
 const roofTriangles=[];
 office.office.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;for(let i=0;i<p.count;i++)if(n.getY(i)>.8&&p.getY(i)>3.8)roofTriangles.push(p.getY(i));});
 assert.ok(roofTriangles.some(y=>Math.abs(y-4.02)<.02),'Lower mineral roof is present in actual geometry');
 assert.ok(roofTriangles.some(y=>Math.abs(y-5.20)<.02),'Higher mineral roof is present in actual geometry');
 assert.ok(roofTriangles.some(y=>Math.abs(y-5.45)<.02),'Upper white parapet is present');
 const officeView=createTourDestinations(m).find(d=>d.name==='Офис продаж');
 assert.ok(officeView&&world.free(...officeView.point),'Office is available as a reachable walking destination');
 for(const p of layout.drive)assert.ok(world.free(...p),`Drive remains continuous at ${p}`);
 let minClearance=Infinity;
 for(let i=1;i<layout.drive.length;i++)for(let step=0;step<=30;step++){
  const a=layout.drive[i-1],b=layout.drive[i],x=a[0]+(b[0]-a[0])*step/30,z=a[1]+(b[1]-a[1])*step/30;
  assert.ok(!solidContains(x,z,f.podium),'Drive does not cut through the existing podium');
  for(let j=0;j<f.podium.outer.length;j++)minClearance=Math.min(minClearance,segmentDistance(x,z,f.podium.outer[j],f.podium.outer[(j+1)%f.podium.outer.length])-layout.driveWidth/2);
 }
 assert.ok(minClearance>2,'The road leaves a real sidewalk beside the podium');
 office.group.traverse(o=>{if(o.material!==office.materials.road)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(!solidContains(p.getX(i),p.getZ(i),f.podium),'No actual curved road/ramp vertex enters the podium')});
 assert.ok(m.publicRealm.treePositions.every(([x,z])=>!salesOfficeReserved(x,z,.69)),'Old public planting does not grow through the new office/drive');
 const trunks=forest.getObjectByName('Tall bare pine and deciduous trunks'),pines=forest.getObjectByName('High irregular pine crowns'),leaves=forest.getObjectByName('Deciduous woodland crowns');
 assert.equal(trunks.count,m.neighborhood.trees.length);assert.equal(pines.count+leaves.count,trunks.count,'Species use compact instance buffers');
 const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
 let nearPines=0,minPineHeight=Infinity,maxPineHeight=0;
 m.neighborhood.trees.forEach((p,i)=>{assert.ok(!salesOfficeReserved(p.x,p.z,1.5));assert.ok(distanceToSalesDrive(p.x,p.z)>4.75);if(!p.pine)return;
  trunks.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
  assert.ok(scale.y>22&&scale.y<32.3,'Pine trunk scale matches the mature forest');
  minPineHeight=Math.min(minPineHeight,scale.y);maxPineHeight=Math.max(maxPineHeight,scale.y);
  if(Math.hypot(p.x-office.center[0],p.z-office.center[1])<80)nearPines++;
 });
 assert.ok(nearPines>80,'A dense close pine wall exists beside the sales office');
 for(const foliage of [pines,leaves,forest.getObjectByName('Dense low forest-edge undergrowth')]){
  assert.equal(foliage.material.alphaTest,.4);assert.ok(foliage.geometry.attributes.color);
  const rgba=foliage.material.map.image.data;let gaps=0,opaque=0;
  for(let i=3;i<rgba.length;i+=4){gaps+=rgba[i]<80;opaque+=rgba[i]>180}
  assert.ok(gaps>300&&opaque>300,'The retained leaf map has real transparent gaps and leaf coverage');
 }
 for(const [winter,month] of [[true,0],[false,6],[false,9]]){m.setSeason(winter,month);m.neighborhood.setSeason(winter,month);m.lighting.setAtmosphere({elevation:winter?-10:35,hour:12,weather:winter?'snow':'rain'});for(const mesh of instances)assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));}
 result={officeBounds:{min:box.min.toArray(),max:box.max.toArray()},roofHeightDifference:layout.highRoof-layout.lowRoof,roadMinimumSidewalkClearance:minClearance,forestTrees:trunks.count,nearPines,minPineHeight,maxPineHeight,walkRegions:world.boundaries?.length??3};
}finally{m.dispose()}
assert.equal(disposed.geometry.size,geometries.size,'All detached office and forest geometries are disposed');
assert.equal(disposed.texture.size,textures.size,'All owned leaf/mineral textures are disposed');
assert.equal(disposed.instance.size,instances.length,'All instance buffers are disposed');
console.log('PASS: real sales-office roofs, continuous approach, close mature pine wall, porous foliage, walking access, seasonal state and disposal');
console.log(JSON.stringify({...result,disposed:{geometries:geometries.size,textures:textures.size,instances:instances.length}},null,2));
