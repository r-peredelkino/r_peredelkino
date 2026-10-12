// Apartment panes fitted to the unchanged tower's actual 72-bay glazing surface.
// Source raster walls and furniture retain their metric positions; deeper jambs
// absorb the observed raster/envelope discrepancy instead of floating glass.
import * as T from './vendor/three.module.js';
import {complexFootprints} from './complex-footprints.js';
import {towerLevel} from './building-levels.js';
import {residentialFacadeSection} from './facade-detail.js?v=references37';

const COLUMNS=72,GLASS_PROJECTION=.11,PANE_FACTOR=.985;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

export function registerApartmentFacade(data,metrics){
 const placement=metrics.placement,spec=complexFootprints.buildings.find(b=>b.id===placement.building);
 if(!spec||spec.id===0)throw new Error('Residential tower registration is required.');
 const floor=clamp(Math.round(placement.floor||data.floor||2),2,spec.floors),level=towerLevel(spec,floor-1),floorOffset=placement.y-level.base;
 const profile={sill:residentialFacadeSection.centerOffset+residentialFacadeSection.windowAllowance/2-floorOffset,head:level.height+residentialFacadeSection.centerOffset-residentialFacadeSection.windowAllowance/2-floorOffset,frame:.045,sash:.028,crossbar:.035,crossbarHeight:level.height*.62-floorOffset,projection:GLASS_PROJECTION,frameDepth:.08,glassThickness:.018};
 // The ceiling is an apartment finish datum, rather than the structural pitch.
 profile.head=Math.min(data.ceilingHeight-.035,profile.head);
 const shape=new T.Shape(spec.shape.map(([x,z])=>new T.Vector2(x,-z)));shape.closePath();
 const samples=shape.getSpacedPoints(COLUMNS),signed=shape.getPoints(80).reduce((a,p,i,pts)=>i? a+pts[i-1].x*(-p.y)-p.x*(-pts[i-1].y):a,0),orientation=signed>0?1:-1;
 const sc=Math.cos(spec.angle),ss=Math.sin(spec.angle),pc=Math.cos(placement.angle),ps=Math.sin(placement.angle);
 const towerToApartment=([x,z])=>{const wx=spec.x+sc*x+ss*z,wz=spec.z-ss*x+sc*z,dx=wx-placement.x,dz=wz-placement.z;return[pc*dx-ps*dz,ps*dx+pc*dz];};
 const bays=samples.slice(0,-1).map((p,index)=>{const q=samples[index+1],dx=q.x-p.x,dz=-(q.y-p.y),length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx),normal=[orientation*dz/length,-orientation*dx/length],middle=shape.getPointAt((index+.5)/COLUMNS),cx=(p.x+q.x)/2,cz=-(p.y+q.y)/2,bend=(middle.x-cx)*Math.sin(angle)+(-middle.y-cz)*Math.cos(angle);
  const point=t=>{const u=(t-.5)*length,curve=bend*(1-4*u*u/(length*PANE_FACTOR)**2),offset=GLASS_PROJECTION-orientation*curve;return towerToApartment([cx+dx/length*u+normal[0]*offset,cz+dz/length*u+normal[1]*offset]);};
  const localNormal=towerToApartment([cx+normal[0],cz+normal[1]]),localOrigin=towerToApartment([cx,cz]);
  return{index,length,angle,bend,normal:[localNormal[0]-localOrigin[0],localNormal[1]-localOrigin[1]],point,paneStart:.5-PANE_FACTOR/2,paneEnd:.5+PANE_FACTOR/2,opaqueInSource:index%2===1&&Math.abs(bend)<.009};
 });
 const coarse=[];for(const bay of bays)for(let step=0;step<24;step++)coarse.push({s:bay.index+step/24,a:bay.point(step/24),b:bay.point((step+1)/24)});
 function nearest(q){let result=null;for(const e of coarse){const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],u=clamp(((q[0]-e.a[0])*dx+(q[1]-e.a[1])*dz)/(dx*dx+dz*dz),0,1),p=[e.a[0]+dx*u,e.a[1]+dz*u],d=distance(q,p);if(!result||d<result.distance)result={s:e.s+u/24,distance:d};}
  // Exact parabolic point, so adapted pane coordinates do not inherit the
  // approximation used only to find the nearest facade bay.
  const index=Math.min(COLUMNS-1,Math.floor(result.s)),t=result.s-index;result.point=bays[index].point(t);result.distance=distance(q,result.point);return result;
 }
 const windows=data.windows.map((a,index)=>{const originalA=metrics.coord(a[0],a[1]),originalB=metrics.coord(a[2],a[3]),A=nearest(originalA),B=nearest(originalB);let from=A.s,to=B.s;
  if(to-from>COLUMNS/2)from+=COLUMNS;if(from-to>COLUMNS/2)to+=COLUMNS;
  const reverse=from>to;if(reverse)[from,to]=[to,from];const panes=[];
  for(let i=Math.floor(from);i<=Math.floor(to);i++){const bay=bays[((i%COLUMNS)+COLUMNS)%COLUMNS],start=Math.max(bay.paneStart,from-i),end=Math.min(bay.paneEnd,to-i);if(end-start<.002)continue;
   const points=Array.from({length:9},(_,n)=>bay.point(start+(end-start)*n/8));
   const sashT=.70,crossStart=.71,crossEnd=.99;
   const pane={sourceBay:bay.index,sourceBend:bay.bend,curved:Math.abs(bay.bend)>=.009,normal:bay.normal,points,start,end,opaqueInSource:bay.opaqueInSource,sash:start<=sashT&&end>=sashT?bay.point(sashT):null,crossbar:start<crossEnd&&end>crossStart?[bay.point(Math.max(start,crossStart)),bay.point(Math.min(end,crossEnd))]:null};
   if(reverse)pane.points.reverse();panes.push(pane);
  }
  if(reverse)panes.reverse();
  const sourceSegments=panes.flatMap(p=>p.points.slice(1).map((q,n)=>[...p.points[n],...q])),gapBefore=Math.max(...[0,.25,.5,.75,1].map(t=>nearest([originalA[0]+(originalB[0]-originalA[0])*t,originalA[1]+(originalB[1]-originalA[1])*t]).distance));
  return{index,originalA,originalB,adaptedA:A.point,adaptedB:B.point,gapBefore,panes,sourceSegments};
 });
 const metadata={revision:37,originalMetricPlanPreserved:true,sourceTowerGeometryUnchanged:true,sourcePaneColumns:COLUMNS,sourcePaneProjection:GLASS_PROJECTION,maxOriginalPaneGap:Math.max(0,...windows.map(w=>w.gapBefore)),maxAdaptedPaneGap:0,windowHeightStatus:'copied from the existing conceptual tower model; not a measured opening schedule',outlineStatus:'original metric raster trace retained'};
 return{building:spec.id,floor,slot:placement.slot,profile,windows,bays,nearest,metadata};
}

export function facadePaneGeometry(points,sill,head){
 const vertices=[],uv=[];let length=0;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],next=length+distance(a,b);vertices.push(a[0],sill,a[1],b[0],sill,b[1],a[0],head,a[1],b[0],sill,b[1],b[0],head,b[1],a[0],head,a[1]);uv.push(length,0,next,0,length,1,next,0,next,1,length,1);length=next;}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();geometry.userData.facadeSource={columns:COLUMNS,projection:GLASS_PROJECTION,adaptedToUnchangedTower:true};return geometry;
}
