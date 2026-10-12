// @r_peredelkino · RP-CONCEPT-2026-10-07 · pedestrian collision in model metres.
export function insideRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)}
function edgesNear(x,z,r,ring){for(let i=0,j=ring.length-1;i<ring.length;j=i++)if(segmentDistance(x,z,ring[j],ring[i])<r)return true;return false}
export function solidContains(x,z,shape){return insideRing(x,z,shape.outer)&&!(shape.holes||[]).some(h=>insideRing(x,z,h))}
function boundarySegments(regions){
 const rings=regions.map(shape=>[shape.outer,...shape.holes||[]]),edges=rings.map(group=>group.flatMap(ring=>ring.map((a,i)=>({a,b:ring[(i+1)%ring.length]})).filter(({a,b})=>Math.hypot(b[0]-a[0],b[1]-a[1])>1e-8))),segments=[];
 const contains=(x,z)=>regions.some(shape=>solidContains(x,z,shape)),cross=(ax,az,bx,bz)=>ax*bz-az*bx;
 // Split overlapping polygon edges, then retain only the exposed union boundary.
 // Eroding each region separately would create an invisible wall at the old site edge.
 for(let region=0;region<edges.length;region++)for(const {a,b} of edges[region]){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),cuts=[0,1];
  for(let other=0;other<edges.length;other++)if(other!==region)for(const {a:c,b:d} of edges[other]){
   if(Math.max(a[0],b[0])+1e-8<Math.min(c[0],d[0])||Math.min(a[0],b[0])-1e-8>Math.max(c[0],d[0])||Math.max(a[1],b[1])+1e-8<Math.min(c[1],d[1])||Math.min(a[1],b[1])-1e-8>Math.max(c[1],d[1]))continue;
   const sx=d[0]-c[0],sz=d[1]-c[1],qx=c[0]-a[0],qz=c[1]-a[1],den=cross(dx,dz,sx,sz);
   if(Math.abs(den)>1e-8){const t=cross(qx,qz,sx,sz)/den,u=cross(qx,qz,dx,dz)/den;if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8)cuts.push(Math.max(0,Math.min(1,t)))}
   else if(Math.abs(cross(qx,qz,dx,dz))<1e-8)for(const p of [c,d]){const t=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(length*length);if(t>0&&t<1)cuts.push(t)}
  }
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-9)continue;const mid=(lo+hi)/2,x=a[0]+dx*mid,z=a[1]+dz*mid,nx=-dz/length*1e-5,nz=dx/length*1e-5;
   if(contains(x+nx,z+nz)===contains(x-nx,z-nz))continue;
   const start=[a[0]+lo*dx,a[1]+lo*dz],end=[a[0]+hi*dx,a[1]+hi*dz];segments.push({a:start,b:end,bounds:[Math.min(start[0],end[0]),Math.max(start[0],end[0]),Math.min(start[1],end[1]),Math.max(start[1],end[1])]});
  }
 }
 return segments;
}
export function createWalkWorld({boundary,boundaryExtensions=[],solids=[],obstacles=[],radius=.36}={}){
 const boundaries=[...(boundary?[Array.isArray(boundary)?{outer:boundary,holes:[]}:boundary]:[]),...boundaryExtensions],limits=boundaries.length>1?boundarySegments(boundaries):null;
 const indexed=solids.map(s=>({...s,bounds:[Math.min(...s.outer.map(p=>p[0]))-radius,Math.max(...s.outer.map(p=>p[0]))+radius,Math.min(...s.outer.map(p=>p[1]))-radius,Math.max(...s.outer.map(p=>p[1]))+radius]}));
 function free(x,z){if(!Number.isFinite(x+z))return false;if(boundaries.length){if(!boundaries.some(shape=>solidContains(x,z,shape)))return false;if(limits){for(const edge of limits){const b=edge.bounds;if(x>=b[0]-radius&&x<=b[1]+radius&&z>=b[2]-radius&&z<=b[3]+radius&&segmentDistance(x,z,edge.a,edge.b)<radius)return false}}else if([boundaries[0].outer,...boundaries[0].holes||[]].some(ring=>edgesNear(x,z,radius,ring)))return false}
 for(const s of indexed){const b=s.bounds;if(x<b[0]||x>b[1]||z<b[2]||z>b[3])continue;if(solidContains(x,z,s)||[s.outer,...s.holes||[]].some(r=>edgesNear(x,z,radius,r)))return false}
 for(const o of obstacles){if(o.enabled===false)continue;if(o.type==='circle'){if(Math.hypot(x-o.x,z-o.z)<radius+o.radius)return false}else if(o.type==='segment'){if(segmentDistance(x,z,o.a,o.b)<radius+(o.radius||0))return false}else{const c=Math.cos(o.angle||0),s=Math.sin(o.angle||0),dx=x-o.x,dz=z-o.z,lx=c*dx-s*dz,lz=s*dx+c*dz;const qx=Math.max(Math.abs(lx)-o.width/2,0),qz=Math.max(Math.abs(lz)-o.depth/2,0);if(Math.hypot(qx,qz)<radius)return false}}
 return true}
 function move(position,dx,dz){const length=Math.hypot(dx,dz);if(!length)return{...position,blocked:false};const steps=Math.ceil(length/(radius*.4));let x=position.x,z=position.z,blocked=false;
 // Substeps prevent crossing even a thin fence at sprint speed. Separate axes allow wall sliding.
 for(let i=0;i<steps;i++){const sx=dx/steps,sz=dz/steps;if(free(x+sx,z+sz)){x+=sx;z+=sz}else{blocked=true;if(free(x+sx,z))x+=sx;if(free(x,z+sz))z+=sz}}
 return{x,z,blocked}}
 function nearest(point,maxDistance=12){if(free(...point))return{x:point[0],z:point[1]};for(let r=.5;r<=maxDistance;r+=.5)for(let i=0;i<48;i++){const a=i/48*Math.PI*2,x=point[0]+Math.cos(a)*r,z=point[1]+Math.sin(a)*r;if(free(x,z))return{x,z}}return null}
 return{free,move,nearest,radius,solids:indexed,obstacles,boundaries};
}
