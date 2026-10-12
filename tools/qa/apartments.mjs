import assert from 'node:assert/strict';
import {apartmentPlans,apartmentMetrics} from '../../dist/apartment-plans.js';
import {createApartment,createApartmentWorld} from '../../dist/apartment-model.js';
import {complexFootprints} from '../../dist/complex-footprints.js';
import {insideRing} from '../../dist/walk-physics.js';
import {readPixelSignature} from '../../dist/baked-authorship.js';
import {apartmentApertures,apertureContains} from '../../dist/apartment-apertures.js';
const tower=complexFootprints.buildings.find(b=>b.id===1),outline=tower.shape.map(([x,z])=>[x+tower.x,z+tower.z]);
for(const id of Object.keys(apartmentPlans)){
 const data=apartmentPlans[id],m=apartmentMetrics(data),p=m.placement,c=Math.cos(p.angle),s=Math.sin(p.angle);
 // Both original shapes fit their owning tower without modifying the apartments' traced geometry.
 for(const v of data.outline){const [x,z]=m.coord(...v);assert.ok(insideRing(p.x+c*x+s*z,p.z-s*x+c*z,outline),id+' fits tower 1');}
 // Every opening must face away from the tower, not its central core. Its ray crosses
 // the shell inside a finite aperture; the opposite facade and other floors stay intact.
 const aps=apartmentApertures(data,m);
 for(const a of aps){const mx=(a.x+a.z)/2,mz=(a.y+a.w)/2,dx=a.z-a.x,dz=a.w-a.y,L=Math.hypot(dx,dz);let nx=-dz/L,nz=dx/L;
  const poly=data.outline.map(v=>m.coord(...v));if(insideRing(mx+nx*.3,mz+nz*.3,poly)){nx=-nx;nz=-nz;}
  const wx=p.x+c*mx+s*mz,wz=p.z-s*mx+c*mz,wnx=c*nx+s*nz,wnz=-s*nx+c*nz;
  assert.ok((wx-tower.x)*wnx+(wz-tower.z)*wnz>0,id+' window points outside');
  let exit=0;while(exit<2&&insideRing(wx+wnx*exit,wz+wnz*exit,outline))exit+=.01;
  assert.ok(exit<1.0,id+' window is registered to facade, not tower centre');
  assert.ok(apertureContains(mx+nx*(exit+.15),1.68,mz+nz*(exit+.15),aps,data.ceilingHeight),'Shell removed only through its opening');
  assert.ok(!apertureContains(mx,3.4,mz,aps,data.ceilingHeight),'Upper storey preserved');
 }
 for(const furnished of [false,true]){
  const w=createApartmentWorld(id,furnished),step=.08,key=(x,z)=>Math.round(x/step)+','+Math.round(z/step),start={x:Math.round(w.start.x/step)*step,z:Math.round(w.start.z/step)*step};
  assert.ok(w.free(start.x,start.z));const queue=[start],seen=new Set([key(start.x,start.z)]);let at=0;
  // Flood-fill only legal walking steps from the entrance: room jumps cannot conceal disconnected rooms.
  while(at<queue.length){const q=queue[at++];for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){const x=q.x+dx,z=q.z+dz,k=key(x,z);if(!seen.has(k)&&w.free(x,z)){seen.add(k);queue.push({x,z});}}}
  for(let i=0;i<data.rooms.length;i++){const r=w.roomPoint(i);assert.ok(r&&w.free(r.x,r.z));assert.ok(queue.some(q=>Math.hypot(q.x-r.x,q.z-r.z)<step*2),`${id} ${furnished?'furnished':'empty'}: ${data.rooms[i].name} reachable from entrance`);}
  // Large inputs cannot tunnel through a wall or window, or fall outside the high-floor footprint.
  for(let a=0;a<Math.PI*2;a+=.11){const r=w.move(start,Math.cos(a)*40,Math.sin(a)*40);assert.ok(r.blocked&&w.free(r.x,r.z));assert.ok(Math.hypot(r.x-start.x,r.z-start.z)<40);}
  for(const window of data.windows){const a=m.coord(window[0],window[1]),b=m.coord(window[2],window[3]);assert.ok(!w.free((a[0]+b[0])/2,(a[1]+b[1])/2),'Glass is a physical barrier');}
  console.log(`PASS ${id}: ${data.rooms.length} reachable rooms ${furnished?'with furniture':'without furniture'}, solid walls/windows and no escape`);
 }
 const apartment=createApartment(id);assert.equal(apartment.withFurniture,true);assert.equal(apartment.upper.visible,false);apartment.setWalking(true);assert.equal(apartment.upper.visible,true);assert.equal(apartment.ceiling.visible,true);apartment.setFurniture(false);assert.equal(apartment.furniture.visible,false);assert.equal(apartment.world.obstacles.length,data.walls.length+data.windows.length);apartment.setWalking(false);assert.equal(apartment.ceiling.visible,false);
 let meshes=0;apartment.root.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.attributes.rpAuthor);if(o.material.map?.image?.data)assert.ok(readPixelSignature(o.material.map.image.data).startsWith('@r_peredelkino|'));}});assert.ok(meshes<60,'Mobile material batching');apartment.dispose();
}
assert.equal(apartmentPlans['1-81'].furniture.filter(x=>x[0]==='bed').length,3);assert.ok(apartmentPlans['1-81'].furniture.some(x=>x[0]==='lsofa'));assert.ok(apartmentPlans['1-59'].furniture.some(x=>x[0]==='roundTable'));assert.ok(apartmentMetrics(apartmentPlans['1-81']).placement.y>apartmentMetrics(apartmentPlans['1-59']).placement.y);
console.log('PASS: separate original furniture layouts, floor registration, mobile batches, authored textures/geometry, furniture collision switching and interior visibility');
