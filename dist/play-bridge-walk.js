// @r_peredelkino · a separate upper route for the modelled play pavilion stair.
// Ground visitors retain their own collision world and never sample roof height.
import {createWalkWorld,solidContains,segmentDistance} from './walk-physics.js?v=publication371';

function onTread(x,z,tread){return solidContains(x,z,tread)||tread.outer.some((p,i)=>segmentDistance(x,z,p,tread.outer[(i+1)%tread.outer.length])<1e-7);}

// A bent cap is triangulated by the renderer. Interpolating its actual triangles
// keeps feet on that surface, including where the original height formula curves.
// This sampler accepts geometry in the same model coordinates as upperRoute.
export function createWalkSurfaceSampler(geometry){
 const positions=geometry?.attributes?.position,index=geometry?.index?.array;
 if(!positions)return()=>null;
 const cells=new Map(),cellSize=1,triangles=[];
 for(let i=0;i<(index?.length||positions.count);i+=3){
  const ia=index?index[i]:i,ib=index?index[i+1]:i+1,ic=index?index[i+2]:i+2;
  const ax=positions.getX(ia),az=positions.getZ(ia),ay=positions.getY(ia),bx=positions.getX(ib),bz=positions.getZ(ib),by=positions.getY(ib),cx=positions.getX(ic),cz=positions.getZ(ic),cy=positions.getY(ic);
  const dx=bx-ax,dz=bz-az,ex=cx-ax,ez=cz-az,det=dx*ez-dz*ex;
  if(det>=-1e-10)continue; // Only upward faces; vertical walls and undersides are excluded.
  const triangle={ax,az,ay,dx,dz,ex,ez,dy:by-ay,ey:cy-ay,det};triangles.push(triangle);
  const left=Math.floor(Math.min(ax,bx,cx)/cellSize),right=Math.floor(Math.max(ax,bx,cx)/cellSize),top=Math.floor(Math.min(az,bz,cz)/cellSize),bottom=Math.floor(Math.max(az,bz,cz)/cellSize);
  for(let x=left;x<=right;x++)for(let z=top;z<=bottom;z++){
   const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(triangle);
  }
 }
 const sample=(x,z)=>{
  if(!Number.isFinite(x+z))return null;
  let height=null;
  for(const t of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){
   const px=x-t.ax,pz=z-t.az,u=(px*t.ez-pz*t.ex)/t.det,v=(t.dx*pz-t.dz*px)/t.det;
   if(u< -1e-6||v< -1e-6||u+v>1+1e-6)continue;
   const y=t.ay+u*t.dy+v*t.ey;height=Math.max(height??-Infinity,y);
  }
  return height;
 };
 sample.triangleCount=triangles.length;
 return sample;
}

export function createPlayBridgeWorld(model){
 const pavilion=model.courtyard?.playPavilion,route=pavilion?.upperRoute;if(!route?.treads?.length||!route.stairPoints?.length)return null;
 const first=route.stairPoints[0],next=route.stairPoints[1],dx=next[0]-first[0],dz=next[2]-first[2],length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length,nx=-tz,nz=tx,half=route.stairWidth/2;
 // The short approach occupies the existing ground inside the open sky court.
 // It connects to the first actual tread, with no new raised or invisible slab.
 const along=(s,side)=>[first[0]+tx*s+nx*half*side,first[2]+tz*s+nz*half*side];
 const approach={outer:[along(-1.04,1),along(.12,1),along(.12,-1),along(-1.04,-1)],holes:[]},entry=along(-.57,0),deck={outer:route.outer,holes:route.holes};
 const world=createWalkWorld({boundary:deck,boundaryExtensions:[approach,...route.treads.map(t=>({outer:t.outer,holes:t.holes||[]}))],obstacles:route.guardSegments.map(g=>({type:'segment',...g})),radius:.36});
 const deckHeightAt=pavilion.playBridge?.geometry?createWalkSurfaceSampler(pavilion.playBridge.geometry):route.heightAt;
 function heightAt(x,z){
  let height=solidContains(x,z,approach)?0:null;
  for(const tread of route.treads)if(onTread(x,z,tread))height=Math.max(height??-Infinity,tread.height);
  if(solidContains(x,z,deck)){
   const value=deckHeightAt(x,z);if(Number.isFinite(value))height=Math.max(height??-Infinity,value);
  }
  return height;
 }
 const free=(x,z)=>world.free(x,z)&&Number.isFinite(heightAt(x,z)),maxStep=.23;
 function move(position,dx,dz){
  const distance=Math.hypot(dx,dz);if(!distance)return{...position,blocked:false};
  const steps=Math.ceil(distance/(world.radius*.4));let x=position.x,z=position.z,blocked=false,height=heightAt(x,z);
  const canStep=(nx,nz)=>free(nx,nz)&&Math.abs(heightAt(nx,nz)-height)<=maxStep;
  for(let i=0;i<steps;i++){
   const sx=dx/steps,sz=dz/steps;
   if(canStep(x+sx,z+sz)){x+=sx;z+=sz;height=heightAt(x,z);}
   else{blocked=true;if(canStep(x+sx,z)){x+=sx;height=heightAt(x,z);}if(canStep(x,z+sz)){z+=sz;height=heightAt(x,z);}}
  }
  return{x,z,blocked};
 }
 function nearest(point,maxDistance=12){const p=world.nearest(point,maxDistance);return p&&free(p.x,p.z)?p:null;}
 if(!free(...entry))throw new Error('Play bridge ground approach is too narrow or obstructed');
 return{...world,free,move,nearest,heightAt,deckHeightAt,maxStep,entry,entryLook:[next[0],next[2]],landing:route.landing,route,approach,deck};
}

export function tourSurfaceElevation(destination,point){
 const value=destination?.heightAt?.(point.x,point.z);
 return Number.isFinite(value)?value:destination?.elevation||0;
}
