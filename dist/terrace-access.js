// @r_peredelkino · keep the original accessible terrace connected while furnishing.
import {createWalkWorld} from './walk-physics.js?v=references37';

export function createTerraceAccessGate(options,spawn){
 const world=createWalkWorld(options),boundary=options.boundary,step=.24;
 const minX=Math.min(...boundary.map(p=>p[0])),maxX=Math.max(...boundary.map(p=>p[0])),minZ=Math.min(...boundary.map(p=>p[1])),maxZ=Math.max(...boundary.map(p=>p[1]));
 const cols=Math.ceil((maxX-minX)/step)+1,rows=Math.ceil((maxZ-minZ)/step)+1,xs=new Float64Array(cols*rows),zs=new Float64Array(cols*rows);let free=new Uint8Array(cols*rows),start=-1,best=Infinity;
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
  const i=z*cols+x;xs[i]=minX+x*step;zs[i]=minZ+z*step;free[i]=world.free(xs[i],zs[i])?1:0;
  if(free[i]){const distance=Math.hypot(xs[i]-spawn.x,zs[i]-spawn.z);if(distance<best){best=distance;start=i}}
 }
 if(start<0)throw new RangeError('A furnished terrace needs a reachable original spawn.');
 const flood=mask=>{
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let end=1;queue[0]=start;seen[start]=1;
  for(let at=0;at<end;at++){
   const i=queue[at],x=i%cols,z=Math.floor(i/cols);
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dz)continue;const nx=x+dx,nz=z+dz,j=nz*cols+nx;
    if(nx<0||nz<0||nx>=cols||nz>=rows||!mask[j]||seen[j])continue;
    if(dx&&dz&&(!mask[z*cols+nx]||!mask[nz*cols+x]))continue;
    seen[j]=1;queue[end++]=j;
   }
  }
  return seen;
 };
 const originalReachable=flood(free);let accepted=0,rejected=0;
 return{accept(obstacle){
  const candidate=free.slice(),collision=createWalkWorld({obstacles:[obstacle],radius:world.radius});
  for(let i=0;i<candidate.length;i++)if(candidate[i]&&!collision.free(xs[i],zs[i]))candidate[i]=0;
  if(!candidate[start]){rejected++;return false}
  const reachable=flood(candidate);
  for(let i=0;i<candidate.length;i++)if(originalReachable[i]&&candidate[i]&&!reachable[i]){rejected++;return false}
  free=candidate;accepted++;return true;
 },get stats(){return{step,accepted,rejected}}};
}
