// @r_peredelkino · courtyard detail positions checked in the supplied views
// 12.03.04 / 12.03.07 and the official sport-left.webp. Model metres are
// reconstructed from those views; the source does not provide survey dimensions.
import * as T from './vendor/three.module.js';
import polygonClipping from './vendor/polygon-clipping.module.js';
import {insideRing} from './walk-physics.js?v=references37';

const TAU=Math.PI*2;
const signedArea=ring=>ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2;
function smooth(points,samples=144){
 const ring=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal').getPoints(samples).slice(0,-1).map(p=>[p.x,p.z]);
 return signedArea(ring)>0?ring:ring.reverse();
}
// A normal offset of the same sampled contour supplies the blue inset and
// the planting clearance; neither is a separately guessed ellipse.
export function offsetReferenceContour(ring,inset){
 const sign=Math.sign(signedArea(ring))||1;
 return ring.map((p,i)=>{
  const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
  const l0=Math.hypot(p[0]-a[0],p[1]-a[1]),l1=Math.hypot(b[0]-p[0],b[1]-p[1]);
  const n0=[-(p[1]-a[1])/l0*sign,(p[0]-a[0])/l0*sign],n1=[-(b[1]-p[1])/l1*sign,(b[0]-p[0])/l1*sign];
  const denominator=1+n0[0]*n1[0]+n0[1]*n1[1],scale=inset/Math.max(.35,denominator);
  return[p[0]+(n0[0]+n1[0])*scale,p[1]+(n0[1]+n1[1])*scale];
 });
}
export function referenceSportLayout(sport){
 const at=([x,z])=>[sport.x+x,sport.z+z];
 // The concave garden side is towards +z. The round panna end is towards +x,
 // away from the event ring; the two tables occupy the end nearest the ring.
 const outer=smooth([[-11,-1],[-10.4,-3.6],[-8,-5.5],[-3.5,-6.1],[2.5,-6.2],[7.8,-5.2],[10.5,-3.2],[11.4,0],[10.1,3.4],[7.6,5.4],[3,5.9],[0,4.8],[-1.4,2.6],[-3.2,1.9],[-5,2.8],[-8.2,2.8],[-10.5,1.2]]).map(at);
 const surface=offsetReferenceContour(outer,.62),clearance=offsetReferenceContour(outer,-.70);
 const garden=smooth([[-7.5,4.6],[-5.2,5.9],[-1.7,7.2],[.8,7.1],[1.4,6.2],[-.4,3.55],[-2.8,2.95],[-4.3,3.8]],96).map(at);
 return{outer,surface,clearance,garden,track:offsetReferenceContour(outer,.29),
  panna:{center:at([7,0]),rx:2.45,rz:2.05},
  tables:[[-6.7,-2.6],[-6.7,.25]].map(p=>({center:at(p),width:2.74,depth:1.525,height:.76})),
  workout:{x:sport.x+.4,z:sport.z-1.9},
  bags:[[2.2,1.35],[3.4,1.35]].map(at),
  benches:[[-1.65,.45],[1.30,2.85],[3.1,3.85]].map(at),
  shade:{center:at([-1.65,.45]),rx:2.05,rz:.72,height:2.57},
  sources:['2026-10-09 12.03.07','2026-10-09 12.03.09','official sport-left.webp'],
 };
}

// Clip an individual planting island into genuine polygon boundaries. The
// former representation left an island's old outer edge inside a cutout,
// which the walking world quite correctly treated as a fence. Visible turf
// and collision now share only the exposed boundary of the remaining garden.
export function subtractReferenceCuts(island,cuts){
 const close=ring=>[...ring,ring[0]],subject=[close(island.outer),...(island.holes??[]).map(close)];
 // A robust sweep handles intersecting/coincident route buffers. Keep the exact
 // resulting rings for visible turf and walking collision, rather than retaining
 // invisible closed garden edges across an opening.
 const result=cuts.length?polygonClipping.difference(subject,...cuts.map(r=>[close(r)])):polygonClipping.union(subject);
 const open=ring=>ring.slice(0,-1).map(p=>[p[0],p[1]]);
 return result.map(polygon=>{const outer=open(polygon[0]),holes=polygon.slice(1).map(open);return{outer,holes,baseHoles:holes,cutouts:[]};}).filter(p=>Math.abs(signedArea(p.outer))>1e-5);
}

export function referenceGardenLounge(event){
 // Both supplied aerial angles place this separate lounge between the event
 // ring and Sport Point, to the side of their connecting route. Keep the
 // existing model anchor; only the mistaken closed cage changes.
 const center=[event.x-1.4,event.z-(event.referenceRevision===33?10.4:13)],outer=Array.from({length:96},(_,i)=>{
  const a=i/96*TAU;return[center[0]+3.15*Math.cos(a),center[1]+2.45*Math.sin(a)];
 });
 const approachClearance=Array.from({length:72},(_,i)=>{const a=i/72*TAU;return[center[0]+1.3*Math.cos(a),center[1]+3.1+2.35*Math.sin(a)];});
 return{center,outer,clearance:offsetReferenceContour(outer,-.60),approachClearance,
  roofHeight:2.68,roofThickness:.12,
  entry:[center[0],center[1]+2.28],approach:[center[0],center[1]+3.05],
  interior:[center[0],center[1]+.22],
  sourceViews:['2026-10-09 12.03.04','2026-10-09 12.03.07'],
 };
}
