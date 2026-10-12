// @r_peredelkino · doors belong to existing frontage; interiors are an authored concept.
import {complexFootprints as footprint} from './complex-footprints.js?v=publication371';

function approach(world, door, distance=1.6) {
  // Stay on the public side of the actual door. A generic nearest-point search
  // could put a visitor behind a wall or on another side of the building.
  const nx=door.nx ?? Math.sin(door.angle), nz=door.nz ?? Math.cos(door.angle);
  const tx=nz, tz=-nx;
  for (const d of [distance,2,2.5,3,3.5,5,6]) for (const offset of [0,-.55,.55,-1,1]) {
    const point=[door.x+nx*d+tx*offset,door.z+nz*d+tz*offset];
    if (world.free(...point)) return {point,look:[door.x,door.z],distance:d};
  }
  return null;
}

export function createExteriorInteractions(model,world) {
  const interactions=[];
  const add=(id,label,kind,door,extra={})=>{
    const entry=approach(world,door);if(!entry)return;
    interactions.push({id,type:'door',label,kind,point:entry.point,lookAt:entry.look,
      objectPoint:[door.x,door.z],approachDistance:entry.distance,radius:2.6,elevation:0,...extra});
  };
  for (const p of model.publicRealm?.closeDetails?.portals??[]) {
    add('lobby-'+p.id,'Войти в подъезд · корпус '+p.id,'lobby',p,{building:p.id});
  }
  const panes=model.commercialFrontage?.commercialPanes??[];
  const office=footprint.buildings.find(b=>b.id===0);
  const officeCandidates=panes.filter(p=>p.officeLobby).sort((a,b)=>
    Math.hypot(a.x-office.x,a.z-office.z)-Math.hypot(b.x-office.x,b.z-office.z));
  for (const p of officeCandidates) {add('office-0','Войти в офисный центр','office',p,{building:0});if(interactions.some(i=>i.id==='office-0'))break;}
  const retail=model.commercialFrontage?.doors??[];
  // Three existing real door bays, rather than extra invented openings.
  const chosen=[];
  for (const p of retail) {
    if (chosen.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<22))continue;
    const before=interactions.length;
    add('retail-'+(chosen.length+1),'Войти в магазин · два уровня','retail',p);
    if(interactions.length>before)chosen.push(p);
    if(chosen.length===3)break;
  }
  const arenaPanes=(model.commercialFrontage?.arenaPanes??[]).sort((a,b)=>
    Math.hypot(a.x+92,a.z-10)-Math.hypot(b.x+92,b.z-10));
  for(const p of arenaPanes){add('arena-entry','Войти в киберарену','arena',p);if(interactions.some(i=>i.id==='arena-entry'))break;}
  const sales=model.salesOffice;
  if(sales?.layout){const l=sales.layout,door={x:l.anchor[0]+l.outward[0]*11.08,z:l.anchor[1]+l.outward[1]*11.08,nx:-l.outward[0],nz:-l.outward[1]};add('sales-office','Зайти в офис продаж','office',door,{officePurpose:'sales'});}
  return interactions;
}
