// @r_peredelkino · RP-CONCEPT-2026-10-07
// The developer's 23.50.18 panorama shows a projecting arena at the street
// corner. Register that relationship without rewriting the traced master plan.
// The shift is a visual estimate; neither the screenshot nor this fit is a survey.
import {complexFootprints as source} from './complex-footprints.js?v=community38';
import {geoFrame} from './geo-reference.js?v=community38';

const ringArea=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0]},0)/2;
const direction=ringArea(source.podium.outer)>0?1:-1;
// These are the two long straight source shop wings adjoining the clipped
// corner. Their exterior normals determine the model-space outward bisector.
const wingIndices=[390,475];
const wings=wingIndices.map(index=>{
 const a=source.podium.outer[index],b=source.podium.outer[index+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 return {index,a:[...a],b:[...b],length,normal:[direction*dz/length,-direction*dx/length]};
});
const sum=wings.reduce((v,w)=>[v[0]+w.normal[0],v[1]+w.normal[1]],[0,0]),length=Math.hypot(...sum);
const outward=sum.map(v=>v/length),distance=8.4,delta=outward.map(v=>v*distance);
export const arenaCenter=Object.freeze(source.arenaCenter.map((v,i)=>v+delta[i]));
export const arenaGroundRadius=Math.hypot(source.arena.outer[0][0]-source.arenaCenter[0],source.arena.outer[0][1]-source.arenaCenter[1]);
export const arenaFootprint=Object.freeze({...source.arena,
 outer:source.arena.outer.map(p=>p.map((v,i)=>v+delta[i])),
 holes:(source.arena.holes||[]).map(ring=>ring.map(p=>p.map((v,i)=>v+delta[i])))});
const extent=ring=>Math.max(...ring.map(p=>p[0]*outward[0]+p[1]*outward[1]));
const sourceTip=extent(source.podium.outer),sourceArenaTip=source.arenaCenter[0]*outward[0]+source.arenaCenter[1]*outward[1]+arenaGroundRadius;
export const arenaPlacement=Object.freeze({version:35,sourceCentre:[...source.arenaCenter],centre:[...arenaCenter],groundRadius:arenaGroundRadius,
 delta,outward,distance,geographicDistanceApproximate:distance*geoFrame.scale.metersPerFixedWorldUnit,
 sourceWings:wings,sourceFootprintUnchanged:true,towerPodiumFanContoursUnchanged:true,rotation:0,scale:1,
 groundProjection:{before:sourceArenaTip-sourceTip,after:sourceArenaTip+distance-sourceTip,datum:'source podium support plane along the two-wing outward bisector'},
 sourceMapping:{source:'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/',view:'node1 / Площадь · день',
  observedScreenshot:'2026-10-11 23.50.18',previousScreenshot:'2026-10-11 23.49.36',
  directionMethod:'exterior bisector of the two unchanged source retail wings; independent of screen-left',
  magnitudeStatus:'8.4 scene units visually registered to the projecting capsule relationship; not a surveyed dimension',
  uncertainty:'Different source/model camera poses prevent an exact pixel-scale or 1:1 dimensional claim',
  unchanged:['arena radius','shell profile','roof heights','screen surface','tower facades','source podium rings','source fan rings']}});

// The lower level needs the same shared junction as the upper relief, but its
// circular ground glazing has no shoulder swell. Ends underlap the opaque core.
export function segmentsOutsideArenaGround(a,b,overlap=.024){
 const r=arenaGroundRadius-overlap,ax=a[0]-arenaCenter[0],az=a[1]-arenaCenter[1],dx=b[0]-a[0],dz=b[1]-a[1],A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-r*r;
 if(A<1e-16)return C<=0?[]:[[a,b]];const D=B*B-4*A*C;if(D<0)return[[a,b]];
 const lo=Math.max(0,(-B-Math.sqrt(Math.max(0,D)))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(Math.max(0,D)))/(2*A));if(hi-lo<=1e-10)return[[a,b]];
 const point=t=>[a[0]+dx*t,a[1]+dz*t],parts=[];if(lo>1e-9)parts.push([a,point(lo)]);if(hi<1-1e-9)parts.push([point(hi),b]);return parts;
}
export function clipGroundPaneToArena(pane){
 const c=Math.cos(pane.angle),s=Math.sin(pane.angle),a=[pane.x-c*pane.width/2,pane.z+s*pane.width/2],b=[pane.x+c*pane.width/2,pane.z-s*pane.width/2];
 return segmentsOutsideArenaGround(a,b).map(([start,end])=>{
  const width=Math.hypot(end[0]-start[0],end[1]-start[1]);
  if(width>=pane.width-1e-7)return pane;
  return {...pane,x:(start[0]+end[0])/2,z:(start[1]+end[1])/2,width,pitch:width,
   arenaGroundJunction:{version:35,sourceWidth:pane.width,trimmed:width<pane.width-1e-7,sourceBayId:pane.id,cutRadius:arenaGroundRadius-.024,overlap:.024}};
 }).filter(p=>p.width>.08);
}
