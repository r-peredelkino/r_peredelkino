// @r_peredelkino · RP-CONCEPT-2026-10-07
// One unchanged radial section is shared by the capsule and its retail abutment.
import * as THREE from './vendor/three.module.js';

export function arenaShoulderProfile(radius){
 const controls=[[0,3.56],[.16,3.68],[.52,3.96],[.76,4.34],[.88,4.80],[.91,5.38],[.85,5.99],[.70,6.48],[.46,6.87],[.22,7.17],[.15,7.40]];
 const curve=new THREE.CatmullRomCurve3(controls.map(([r,y])=>new THREE.Vector3(radius+r,y,0)),false,'centripetal');
 return curve.getPoints(128).map(p=>new THREE.Vector2(p.x,p.y));
}

export function arenaShoulderRadiusAt(radius,y){
 const points=arenaShoulderProfile(radius);
 if(y<=points[0].y)return points[0].x;
 if(y>=points.at(-1).y)return points.at(-1).x;
 let i=1;while(i<points.length-1&&points[i].y<y)i++;
 const a=points[i-1],b=points[i];return THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/(b.y-a.y));
}

// Abutting construction may overlap the opaque shell by 24 mm. The chosen
// radial cut never exceeds the shell at any elevation of this section, so an
// exposed air gap cannot reappear between the upper shop tier and the arena.
export function arenaSectionCutRadius(radius,bottom,top=bottom,overlap=.024){
 if(![radius,bottom,top,overlap].every(Number.isFinite)||radius<=0||top<bottom||overlap<0)throw new RangeError('Invalid arena abutment interval');
 const radii=[arenaShoulderRadiusAt(radius,bottom),arenaShoulderRadiusAt(radius,top)];
 for(const p of arenaShoulderProfile(radius))if(p.y>bottom&&p.y<top)radii.push(p.x);
 return Math.min(...radii)-overlap;
}
