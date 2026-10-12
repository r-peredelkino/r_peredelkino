// Fixed-scale rigid registration to the individually identified official SVG slot.
// This maps render traces into the existing conceptual tower; it is not surveying.
import {complexFootprints} from './complex-footprints.js';
const cache=new WeakMap();
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const polygonArea=p=>p.reduce((s,a,i)=>s+cross(a,p[(i+1)%p.length]),0)/2;
function lineIntersection(a,b,c,d){const u=[b[0]-a[0],b[1]-a[1]],v=[d[0]-c[0],d[1]-c[1]],q=[c[0]-a[0],c[1]-a[1]],t=cross(q,v)/cross(u,v);return[a[0]+t*u[0],a[1]+t*u[1]];}
function towerTriangle(spec){const edges=spec.shape.map((a,i)=>({i,a,b:spec.shape[(i+1)%spec.shape.length],length:Math.hypot(a[0]-spec.shape[(i+1)%spec.shape.length][0],a[1]-spec.shape[(i+1)%spec.shape.length][1])})).sort((a,b)=>b.length-a.length).slice(0,3).sort((a,b)=>a.i-b.i);
 const c=Math.cos(spec.angle),s=Math.sin(spec.angle),world=p=>[spec.x+c*p[0]+s*p[1],spec.z-s*p[0]+c*p[1]];
 return[world(lineIntersection(edges[2].a,edges[2].b,edges[0].a,edges[0].b)),world(lineIntersection(edges[0].a,edges[0].b,edges[1].a,edges[1].b)),world(lineIntersection(edges[1].a,edges[1].b,edges[2].a,edges[2].b))];
}
function pathPoints(d){const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[],out=[];let at=0,cmd='',p=[0,0],start=p,lastControl=null;
 const counts={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7};
 while(at<tokens.length){if(/[a-zA-Z]/.test(tokens[at]))cmd=tokens[at++];const upper=cmd.toUpperCase(),relative=cmd!==upper;if(upper==='Z'){p=start.slice();cmd='';continue;}const count=counts[upper];if(!count||at+count>tokens.length)throw new Error('Unsupported or incomplete source SVG path.');const values=tokens.slice(at,at+count).map(Number);at+=count;
  const q=(x,y)=>relative?[p[0]+x,p[1]+y]:[x,y];
  if(upper==='M'||upper==='L'){p=q(...values);out.push(p);if(upper==='M'){start=p.slice();cmd=relative?'l':'L';}lastControl=null;}
  else if(upper==='H'){p=[relative?p[0]+values[0]:values[0],p[1]];out.push(p);lastControl=null;}
  else if(upper==='V'){p=[p[0],relative?p[1]+values[0]:values[0]];out.push(p);lastControl=null;}
  else if(upper==='C'||upper==='S'){const a=p.slice(),b=upper==='C'?q(values[0],values[1]):lastControl?[2*a[0]-lastControl[0],2*a[1]-lastControl[1]]:a,c=upper==='C'?q(values[2],values[3]):q(values[0],values[1]),end=upper==='C'?q(values[4],values[5]):q(values[2],values[3]);for(let i=1;i<=12;i++){const t=i/12,u=1-t;out.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*end[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*end[1]]);}p=end;lastControl=c;}
  else if(upper==='Q'||upper==='T'){const a=p.slice(),b=upper==='Q'?q(values[0],values[1]):lastControl?[2*a[0]-lastControl[0],2*a[1]-lastControl[1]]:a,end=upper==='Q'?q(values[2],values[3]):q(values[0],values[1]);for(let i=1;i<=12;i++){const t=i/12,u=1-t;out.push([u*u*a[0]+2*u*t*b[0]+t*t*end[0],u*u*a[1]+2*u*t*b[1]+t*t*end[1]]);}p=end;lastControl=b;}
  else throw new Error('Source slot requires an arc parser; no approximate fallback is allowed.');
 }
 return out;
}
export function svgSlotPoints(contour){if(!contour)throw new Error('Official SVG slot contour is missing.');if(contour.tag==='path')return pathPoints(contour.d);if(contour.tag==='polygon'||contour.tag==='polyline'){const a=contour.points.trim().split(/[\s,]+/).map(Number);return Array.from({length:a.length/2},(_,i)=>[a[i*2],a[i*2+1]]);}throw new Error('Unknown source SVG slot element.');}
function sampleRing(points,n=128){const clean=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-8),ring=polygonArea(clean)<0?clean.slice().reverse():clean,lengths=ring.map((a,i)=>Math.hypot(a[0]-ring[(i+1)%ring.length][0],a[1]-ring[(i+1)%ring.length][1])),perimeter=lengths.reduce((a,b)=>a+b,0);let edge=0,acc=0;return Array.from({length:n},(_,i)=>{const d=i*perimeter/n;while(edge<ring.length-1&&acc+lengths[edge]<d)acc+=lengths[edge++];const a=ring[edge],b=ring[(edge+1)%ring.length],t=(d-acc)/(lengths[edge]||1);return[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];});}
function fitRigid(source,destination){const mean=p=>p.reduce((a,b)=>[a[0]+b[0]/p.length,a[1]+b[1]/p.length],[0,0]),a=mean(source),b=mean(destination);let dot=0,crossing=0;for(let i=0;i<source.length;i++){const p=[source[i][0]-a[0],source[i][1]-a[1]],q=[destination[i][0]-b[0],destination[i][1]-b[1]];dot+=p[0]*q[0]+p[1]*q[1];crossing+=cross(p,q);}const theta=Math.atan2(crossing,dot),c=Math.cos(theta),s=Math.sin(theta),x=b[0]-c*a[0]+s*a[1],z=b[1]-s*a[0]-c*a[1],transform=p=>[x+c*p[0]-s*p[1],z+s*p[0]+c*p[1]],rms=Math.sqrt(source.reduce((sum,p,i)=>{const q=transform(p),d=destination[i];return sum+(q[0]-d[0])**2+(q[1]-d[1])**2;},0)/source.length);return{x,z,angle:-theta,rms,transform};}
const nearestOnRing=(q,ring)=>{let best=null;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/(dx*dx+dz*dz||1))),point=[a[0]+t*dx,a[1]+t*dz],distance=Math.hypot(q[0]-point[0],q[1]-point[1]);if(!best||distance<best.distance)best={point,distance};}return best;};

export function resolveApartmentRegistration(data,metrics){
 if(cache.has(data))return cache.get(data);const spec=complexFootprints.buildings.find(b=>b.id===data.building);if(!spec)throw new Error('Unknown source apartment tower.');const triangle=towerTriangle(spec),raw=svgSlotPoints(data.source?.floorContour);
 // The official floor UI draws its SVG under rotate(180). Raw SVG upper-left
 // remains corner A, upper-right B and bottom C; only its displayed position flips.
 const svgA=[64.552,44.3],svgB=[430.931,44.3],svgC=[248.516,549.173],map=([x,y])=>{const v=(y-svgA[1])/(svgC[1]-svgA[1]),u=(x-svgA[0]-v*(svgC[0]-svgA[0]))/(svgB[0]-svgA[0]);return[triangle[0][0]+u*(triangle[1][0]-triangle[0][0])+v*(triangle[2][0]-triangle[0][0]),triangle[0][1]+u*(triangle[1][1]-triangle[0][1])+v*(triangle[2][1]-triangle[0][1])];};
 const target=raw.map(map),source=sampleRing(data.outline.map(p=>metrics.coord(...p))),destination=sampleRing(target),sc=Math.cos(spec.angle),ss=Math.sin(spec.angle),towerRing=spec.shape.map(([x,z])=>[spec.x+sc*x+ss*z,spec.z-ss*x+sc*z]),windowPoints=data.windows.flatMap(a=>Array.from({length:7},(_,i)=>metrics.coord(a[0]+(a[2]-a[0])*i/6,a[1]+(a[3]-a[1])*i/6)));let best=null,bestScore=Infinity;
 // Shape-only matching can select the wrong 180-degree branch for a small
 // almost rectangular plan. Windows must face this slot's outside facade.
 const windowError=fit=>Math.sqrt(windowPoints.reduce((sum,p)=>sum+nearestOnRing(fit.transform(p),towerRing).distance**2,0)/windowPoints.length);
 for(let shift=0;shift<destination.length;shift++){const shifted=destination.map((_,i)=>destination[(i+shift)%destination.length]),fit=fitRigid(source,shifted),score=fit.rms+windowError(fit)*3;if(score<bestScore){bestScore=score;best=fit;}}
 const weightedWindows=Array.from({length:384},(_,i)=>windowPoints[i%windowPoints.length]),combined=source.concat(weightedWindows);
 for(let iteration=0;iteration<24;iteration++){const correspondences=source.map(p=>nearestOnRing(best.transform(p),target).point).concat(weightedWindows.map(p=>nearestOnRing(best.transform(p),towerRing).point)),next=fitRigid(combined,correspondences);best=next;}
 const fitError=source.map(p=>nearestOnRing(best.transform(p),target).distance),record={x:best.x,z:best.z,angle:best.angle,building:data.building,floor:data.floor,slot:data.slot,method:'Fixed-area rigid perimeter fit to the individually identified official SVG slot, mapped to the existing engineering tower triangle',sourceFloorSHA256:data.source.floorSHA256,fitRMS:Math.sqrt(fitError.reduce((s,d)=>s+d*d,0)/fitError.length),fitMax:Math.max(...fitError),windowFacadeRMS:windowError(best),areaScalePreserved:true,approximate:true};cache.set(data,record);return record;
}
