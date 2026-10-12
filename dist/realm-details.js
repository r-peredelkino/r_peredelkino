// @r_peredelkino · close-up furnishings and courtyard-facing lobby portals. Render-based concept details.
import * as T from './vendor/three.module.js';
import {facesCourtyard,courtyardFocus} from './frontage-zones.js?v=community38';
import {commercialClearHeight} from './building-levels.js';
export function addRealmDetails(group,{materials:m,data,towers,colliders}){const add=(geo,mat,x,y,z,a=0)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.y=a;o.castShadow=o.receiveShadow=true;group.add(o);return o},box=(w,h,d,x,y,z,mat,a=0)=>add(new T.BoxGeometry(w,h,d),mat,x,y+h/2,z,a);
 const portals=[];
 for(const [id,t] of towers){if(id===0)continue;const bay=[...t.bays].sort((a,b)=>{const score=v=>v.normal[0]*(courtyardFocus[0]-t.spec.x)+v.normal[1]*(courtyardFocus[1]-t.spec.z);return score(b)-score(a)})[0],x=t.spec.x+bay.middle.x+bay.normal[0]*.12,z=t.spec.z-bay.middle.y+bay.normal[1]*.12,angle=Math.atan2(bay.normal[0],bay.normal[1]),c=Math.cos(angle),s=Math.sin(angle),at=(u,v)=>[x+c*u+s*v,z-s*u+c*v],height=commercialClearHeight(id);
 const B=(w,h,d,u,y,v,mat)=>{const p=at(u,v);return box(w,h,d,p[0],y,p[1],mat,angle)};
 // Tall dark piers along the private courtyard; no shop atlas or shop signs on these faces.
 for(const [i,b] of t.bays.entries()){const bx=t.spec.x+b.middle.x,bz=t.spec.z-b.middle.y;if(i%3||!facesCourtyard(bx,bz,...b.normal))continue;box(.50,height,.24,bx+b.normal[0]*.12,0,bz+b.normal[1]*.12,m.dark,b.angle);for(const d of [-.27,-.09,.09,.27])box(.015,height,.25,bx+Math.cos(b.angle)*d+b.normal[0]*.135,0,bz-Math.sin(b.angle)*d+b.normal[1]*.135,m.bronze,b.angle);}
 // The new source views show flush fluted lobby fronts. Remove the former
 // repeated freestanding black portal boxes, broad dark mats and large canopies.
 B(4.8,.22,.22,0,3.15,-.04,m.dark);
 for(const side of [-1,1])B(.45,3.16,.28,side*2.35,0,-.04,m.dark);
 B(4.35,3.16,.055,0,.05,.06,m.dark);
 for(const u of [-.55,.55]){B(1.05,2.98,.035,u,.12,.17,m.glass);for(const dx of [-.53,.53])B(.025,3.05,.045,u+dx,.10,.20,m.bronze);B(.025,.78,.045,u+(u<0?.38:-.38),1.05,.24,m.bronze);}
 for(const u of [-1.62,1.62])B(1.04,2.98,.035,u,.12,.16,m.glass);
 B(4.35,.04,.045,0,3.14,.20,m.bronze);B(.16,.33,.055,1.12,1.08,.23,m.dark);B(.07,.12,.012,1.12,1.25,.27,m.cyan);
 portals.push({id,x,z,angle,revision:33,flush:true,source:"node3 courtyard close-up; 19.30.08 / 19.30.22",unsupportedCanopyRemoved:true});
 }
 for(const b of data.benches){for(let i=0;i<b.points.length-1;i++){const p=b.points[i],q=b.points[i+1],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz);if(l<.05)continue;const a=-Math.atan2(dz,dx);for(const offset of [-.17,0,.17])box(l,.045,.13,(p[0]+q[0])/2-dz/l*offset,.5,(p[1]+q[1])/2+dx/l*offset,m.wood,a);if(i%5===0)box(.04,.36,.6,p[0],.5,p[1],m.bronze,a);}}
 // Bins beside seating, tree grilles and bicycle hoops around each pavilion.
 for(const [i,b] of data.benches.entries()){if(i%2)continue;const p=b.points[0];const x=p[0]+.85,z=p[1]+.85;add(new T.CylinderGeometry(.21,.23,.7,16),m.dark,x,.35,z);add(new T.TorusGeometry(.20,.025,5,20),m.bronze,x,.72,z).rotation.x=Math.PI/2;colliders.push({type:'circle',x,z,radius:.25});}
 for(const [x,z] of data.trees){const ring=add(new T.TorusGeometry(.52,.04,5,20),m.bronze,x,.03,z);ring.rotation.x=Math.PI/2;for(let j=0;j<6;j++){const a=j*Math.PI/3;box(.55,.012,.018,x+Math.cos(a)*.26,.025,z+Math.sin(a)*.26,m.dark,-a);}}
 for(const p of data.pavilions){const c=Math.cos(p.angle),s=Math.sin(p.angle),at=(u,v,y)=>new T.Vector3(p.x+c*u+s*v,y,p.z-s*u+c*v);for(let i=0;i<3;i++){const u=p.width/2+1.1,v=-1+i*.95,a=at(u,v-.3,.05),b=at(u,v+.3,.05),curve=new T.CatmullRomCurve3([a,at(u,v-.3,.8),at(u,v+.3,.88),b]);add(new T.TubeGeometry(curve,20,.025,6,false),m.bronze,0,0,0);colliders.push({type:'segment',a:[a.x,a.z],b:[b.x,b.z],radius:.07});}}
 return{portals};}
