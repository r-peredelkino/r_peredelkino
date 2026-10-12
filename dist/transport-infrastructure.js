// @r_peredelkino · OSM transport axes and explicitly estimated roadside details.
import * as THREE from './vendor/three.module.js';
import {metersToModel} from './geo-reference.js?v=community38';
import {roads,crossings,pedestrianApproaches,metroEntrances as entranceData,junctions,lanes,laneConnectors,trafficPaths,stopLines,signalControls,signalPlan,signalAt,transportMetadata,roadElevation,markingElevation,pavementElevation,measurePolyline,samplePolyline,offsetPolyline,closestOnPolyline} from './transport-data.js?v=community38';

const M=metersToModel;
const toWorld=([e,n],y=0)=>new THREE.Vector3(e*-.69716+n*.71691,y,e*.71691+n*.69716);
const xy=p=>[p.x,p.z];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const unit=p=>{const l=Math.hypot(...p)||1;return[p[0]/l,p[1]/l]};
const material=(color,roughness=.85,other={})=>new THREE.MeshStandardMaterial({color,roughness,...other});

export function createTransportInfrastructure(parent,{localAccess=null}={}){
 const group=new THREE.Group();group.name='Georeferenced Borovskoye / Sholokhova transport and four metro entrances';parent.add(group);
 const mats={asphalt:material(0x2e3033,.96),walk:material(0xb5b1a5,.93),curb:material(0xd3d1c8,.9),white:material(0xe3e1d2,.85),
  island:material(0x7e8762,.97),stone:material(0x858984,.9),stoneLight:material(0xa5a7a0,.9),black:material(0x1b2428,.72),
  rail:material(0x6c7779,.62,{metalness:.48}),glass:material(0x294047,.24,{metalness:.42}),doorFrame:material(0x303a3b,.5,{metalness:.6}),
  red:material(0xe32630,.52,{emissive:0xc10d22,emissiveIntensity:.35}),lamp:material(0xffe5b0,.35,{emissive:0xffdc9c,emissiveIntensity:.05}),
  yellow:material(0xe4b831,.7),signBlue:material(0x1871aa,.64)};
 const triangles=new Map(),instances=new Map(),geometries=new Map();
 const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
 function geo(kind){if(!geometries.has(kind))geometries.set(kind,kind==='cylinder'?new THREE.CylinderGeometry(1,1,1,7):kind==='sphere'?new THREE.SphereGeometry(1,9,6):new THREE.BoxGeometry(1,1,1));return geometries.get(kind);}
 function instance(kind,mat,position,scale,rotation=0){
  const key=`${kind}:${mat.uuid}`;if(!instances.has(key))instances.set(key,{kind,mat,matrices:[]});
  dummy.position.copy(position);dummy.scale.set(...scale);dummy.quaternion.identity();
  if(typeof rotation==='number')dummy.rotation.set(0,rotation,0);else dummy.quaternion.copy(rotation);
  dummy.updateMatrix();instances.get(key).matrices.push(dummy.matrix.clone());
 }
 function box(mat,en,y,w,h,d,rotation=0){instance('box',mat,toWorld(en,y),[w,h,d],rotation);}
 function beam(mat,a,b,r){const mid=a.clone().add(b).multiplyScalar(.5);direction.copy(b).sub(a);const len=direction.length();if(len<1e-6)return;const q=new THREE.Quaternion().setFromUnitVectors(up,direction.normalize());instance('cylinder',mat,mid,[r,len,r],q);}
 function tri(mat,a,b,c){
  if(!triangles.has(mat))triangles.set(mat,[]);const data=triangles.get(mat);
  if((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x)>0)[b,c]=[c,b];
  data.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
 }
 function flatPolygon(mat,points,y){const world=points.map(p=>toWorld(p,y));for(let i=1;i<world.length-1;i++)tri(mat,world[0],world[i],world[i+1]);}
 function ribbon(mat,points,width,y){if(points.length<2)return;const left=offsetPolyline(points,width/2),right=offsetPolyline(points,-width/2);for(let i=1;i<points.length;i++){const a=toWorld(left[i-1],y),b=toWorld(left[i],y),c=toWorld(right[i],y),d=toWorld(right[i-1],y);tri(mat,a,b,c);tri(mat,a,c,d);}}
 function disc(mat,p,r,y,count=12){const points=[];for(let i=0;i<count;i++)points.push([p[0]+Math.cos(i/count*Math.PI*2)*r,p[1]+Math.sin(i/count*Math.PI*2)*r]);flatPolygon(mat,points,y);}
 const roadMeasures=new Map(roads.map(r=>[r.id,measurePolyline(r.pointsEN)]));
 function nearRoad(en,except=null,margin=0){return roads.some(r=>r!==except&&closestOnPolyline(en,r.pointsEN,roadMeasures.get(r.id).cumulative).distance<r.width/2+margin);}
 function nearJunction(en,margin=M(9)){return junctions.some(j=>distance(en,j.pointEN)<margin);}
 function nearCrossing(en,margin=M(2)){return crossings.some(c=>closestOnPolyline(en,c.pointsEN,measurePolyline(c.pointsEN).cumulative).distance<c.width/2+margin);}
 function atLocalAccess(en,margin=M(.35)){if(!localAccess)return false;const p=toWorld(en);return localAccess.reserved(p.x,p.z,margin);}
 function stripPieces(mat,points,width,y,dash,gap,skip=()=>false){const {cumulative,length}=measurePolyline(points);for(let s=0;s<length;s+=dash+gap){const e=Math.min(length,s+dash),a=samplePolyline(points,cumulative,s),b=samplePolyline(points,cumulative,e),mid=samplePolyline(points,cumulative,(s+e)/2).point;if(!skip(mid))ribbon(mat,[a.point,b.point],width,y);}}

 // The visible asphalt and vehicle graph share these exact source polylines.
 for(const road of roads){
  ribbon(mats.asphalt,road.pointsEN,road.width,roadElevation);
  for(const sign of [-1,1]){
   const edge=offsetPolyline(road.pointsEN,sign*(road.width/2-M(.12)));
   stripPieces(mats.white,edge,M(.13),markingElevation,M(3.6),0,p=>nearJunction(p,M(8)));
   if(road.type==='service'||road.type==='street'){
    const sidewalk=offsetPolyline(road.pointsEN,sign*(road.width/2+M(1.15)));
    stripPieces(mats.walk,sidewalk,M(2.15),pavementElevation,M(2),0,p=>nearRoad(p,road,M(.35))||atLocalAccess(p,M(1)));
    const curb=offsetPolyline(road.pointsEN,sign*(road.width/2+M(.08)));
    stripPieces(mats.curb,curb,M(.18),pavementElevation+M(.035),M(1.4),0,p=>nearRoad(p,road,M(.22))||nearCrossing(p,M(.15))||atLocalAccess(p,M(.75)));
   }
  }
  for(let i=1;i<road.lanes;i++){
   const line=offsetPolyline(road.pointsEN,(road.lanes/2-i)*road.laneWidth);
   stripPieces(mats.white,line,M(.13),markingElevation,M(3),M(6),p=>nearJunction(p,M(9))||nearCrossing(p,M(1)));
  }
 }
 // Small join disks close polygon cracks only within an existing motor junction.
 for(const junction of junctions)disc(mats.asphalt,junction.pointEN,M(4.3),roadElevation+.001,16);
 // Separate OSM ways can meet with slightly different tangents. Fill the small
 // wedge between their end cross-sections, preserving their tagged axes.
 const endpoints=new Map();
 for(const road of roads)for(const last of [false,true]){const k=last?road.pointsEN.length-1:0,p=road.pointsEN[k],q=road.pointsEN[last?k-1:1],d=unit([q[0]-p[0],q[1]-p[1]]),normal=[-d[1],d[0]],id=road.nodeIds[k];if(!endpoints.has(id))endpoints.set(id,{point:p,edges:[],roads:0});const join=endpoints.get(id);join.roads++;for(const side of [-1,1])join.edges.push([p[0]+normal[0]*road.width/2*side,p[1]+normal[1]*road.width/2*side]);}
 for(const join of endpoints.values())if(join.roads>1){join.edges.sort((a,b)=>Math.atan2(a[1]-join.point[1],a[0]-join.point[0])-Math.atan2(b[1]-join.point[1],b[0]-join.point[0]));for(let j=0;j<join.edges.length;j++)flatPolygon(mats.asphalt,[join.point,join.edges[j],join.edges[(j+1)%join.edges.length]],roadElevation+.0015);}
 // OSM gives lane-count changes at nodes rather than surveyed taper polygons.
 // Join only those changing-width sections with a short reconstructed taper.
 const laneIndex=new Map(lanes.map(l=>[l.id,l]));
 for(const connector of laneConnectors){const from=laneIndex.get(connector.fromId),to=laneIndex.get(connector.toId);if(connector.turn==='through'&&Math.abs(from.road.width-to.road.width)>M(.2))ribbon(mats.asphalt,connector.pointsEN,Math.min(from.laneWidth,to.laneWidth)+M(.14),roadElevation+.002);}

 function arrow(en,dir,scale=1){
  const left=[-dir[1],dir[0]],at=(x,z)=>[en[0]+left[0]*M(x*scale)+dir[0]*M(z*scale),en[1]+left[1]*M(x*scale)+dir[1]*M(z*scale)];
  ribbon(mats.white,[at(0,-1.4),at(0,1)],M(.16*scale),markingElevation+.004);
  flatPolygon(mats.white,[at(-.52,.45),at(0,1.5),at(.52,.45),at(0,.85)],markingElevation+.004);
 }
 function letterA(en,dir){
  const left=[-dir[1],dir[0]],at=(x,z)=>[en[0]+left[0]*M(x)+dir[0]*M(z),en[1]+left[1]*M(x)+dir[1]*M(z)];
  for(const [a,b] of [[[ -.6,-1.2],[0,1.2]],[[0,1.2],[.6,-1.2]],[[-.32,-.1],[.32,-.1]]])ribbon(mats.white,[at(...a),at(...b)],M(.16),markingElevation+.005);
 }
 for(const lane of lanes){
  if(lane.length<M(32))continue;
  for(let s=M(19);s<lane.length-M(9);s+=M(64)){
   const p=samplePolyline(lane.pointsEN,lane.cumulative,s);if(nearJunction(p.point,M(16))||nearCrossing(p.point,M(7)))continue;
   lane.psv?letterA(p.point,p.direction):arrow(p.point,p.direction,.9);
  }
 }
 for(const connector of laneConnectors.filter(c=>c.turn==='through'&&c.length>M(6)&&nearJunction(c.pointsEN[0],M(20)))){
  stripPieces(mats.white,offsetPolyline(connector.pointsEN,connector.laneWidth/2),M(.12),markingElevation,M(1),M(1.7));
 }
 for(const crossing of crossings){
  const {cumulative,length}=measurePolyline(crossing.pointsEN);
  for(let s=M(.2);s<length;s+=M(.95)){
   const a=samplePolyline(crossing.pointsEN,cumulative,s).point,b=samplePolyline(crossing.pointsEN,cumulative,Math.min(length,s+M(.5))).point;
   ribbon(mats.white,[a,b],crossing.width,markingElevation+.012);
  }
 }
 for(const stop of stopLines)ribbon(mats.white,stop.pointsEN,M(.34),markingElevation+.018);

 // The four above-ground stair portals are at distinct mapped surface entries.
 // Their footprint, stone pattern and furniture are reference reconstruction.
 const metroEntrances=[];const islandReservations=[];
 function railing(points,height=M(.94),spacing=M(1.65)){
  const m=measurePolyline(points);for(let s=0;s<=m.length;s+=spacing){const p=samplePolyline(points,m.cumulative,Math.min(s,m.length)).point;beam(mats.rail,toWorld(p,pavementElevation),toWorld(p,pavementElevation+height),M(.028));}
  for(const h of [height,height*.42])for(let i=1;i<points.length;i++)beam(mats.rail,toWorld(points[i-1],pavementElevation+h),toWorld(points[i],pavementElevation+h),M(.022));
 }
 function digitSegments(number){return{1:['b','c'],2:['a','b','g','e','d'],3:['a','b','g','c','d'],4:['f','g','b','c']}[number]||[];}
 for(const source of entranceData){
  const {entranceEN:p,entryDirectionEN:d,width:w,depth:depth,height:h}=source,left=[-d[1],d[0]],worldDir=toWorld(d),yaw=Math.atan2(worldDir.x,worldDir.z),base=pavementElevation;
  const at=(x,z)=>[p[0]+left[0]*x+d[0]*z,p[1]+left[1]*x+d[1]*z];
  const island=at(0,depth*.3),islandWidth=M(11),islandLength=M(23);
  const islandPoints=[];for(let i=0;i<24;i++){const t=i/24*Math.PI*2;islandPoints.push(at(Math.cos(t)*islandWidth/2,depth*.3+Math.sin(t)*islandLength/2));}
  flatPolygon(mats.island,islandPoints,pavementElevation-.025);
  const apron=[at(-w/2-M(.65),-M(2.7)),at(-w/2-M(.65),depth+M(.65)),at(w/2+M(.65),depth+M(.65)),at(w/2+M(.65),-M(2.7))];flatPolygon(mats.walk,apron,pavementElevation+.014);
  islandReservations.push({center:island,width:islandWidth,length:islandLength,direction:d,sourceNodeId:source.sourceNodeId});
  box(mats.stone,at(-w/2+M(.18),depth/2),base+h/2,M(.36),h,depth,yaw);
  box(mats.stone,at(w/2-M(.18),depth/2),base+h/2,M(.36),h,depth,yaw);
  box(mats.stone,at(0,depth-M(.18)),base+h/2,w,h,M(.36),yaw);
  box(mats.stoneLight,at(0,depth/2),base+h+M(.09),w+M(.2),M(.18),depth+M(.2),yaw);
  box(mats.black,at(0,-M(.06)),base+h-M(.32),w+M(.14),M(.62),M(.2),yaw);
  box(mats.black,at(0,depth/2),base+h-M(.2),w+M(.08),M(.25),depth,yaw);
  box(mats.glass,at(0,M(.035)),base+M(1.14),w-M(.72),M(2.26),M(.1),yaw);
  for(const x of [-w/2+M(.36),-w/4,0,w/4,w/2-M(.36)])box(mats.doorFrame,at(x,-M(.04)),base+M(1.15),M(.075),M(2.3),M(.18),yaw);
  for(const yy of [.08,2.28])box(mats.doorFrame,at(0,-M(.04)),base+M(yy),w-M(.65),M(.075),M(.18),yaw);
  for(const x of [-.26,.26])box(mats.curb,at(M(x),-M(.15)),base+M(1.12),M(.035),M(.4),M(.035),yaw);
  // Horizontal joints break the large stone surface into masonry courses.
  for(let y=M(.7);y<h-M(.15);y+=M(.7))for(const x of [-w/2-M(.006),w/2+M(.006)])box(mats.stoneLight,at(x,depth/2),base+y,M(.014),M(.018),depth-M(.25),yaw);
  const glyph={a:[0,.29,.35,.045],g:[0,0,.35,.045],d:[0,-.29,.35,.045],b:[.17,.145,.045,.27],c:[.17,-.145,.045,.27],e:[-.17,-.145,.045,.27],f:[-.17,.145,.045,.27]};
  for(const key of digitSegments(source.number)){const [gx,gy,gw,gh]=glyph[key];box(mats.white,at(w/2-M(.56)+M(gx),-M(.174)),base+h-M(.31)+M(gy*.78),M(gw*.78),M(gh*.78),M(.018),yaw);}
  const signEN=at(-w/2+M(.8),M(.1)),signTop=base+h+M(1.65);beam(mats.rail,toWorld(signEN,base+h),toWorld(signEN,signTop-M(.4)),M(.042));
  const mPoints=[[-.67,-.39],[-.42,.42],[0,-.19],[.42,.42],[.67,-.39]];
  for(let j=1;j<mPoints.length;j++){
   const a=toWorld([signEN[0]+left[0]*M(mPoints[j-1][0]),signEN[1]+left[1]*M(mPoints[j-1][0])],signTop+M(mPoints[j-1][1]));
   const b=toWorld([signEN[0]+left[0]*M(mPoints[j][0]),signEN[1]+left[1]*M(mPoints[j][0])],signTop+M(mPoints[j][1]));
   direction.copy(b).sub(a);const center=a.clone().add(b).multiplyScalar(.5),q=new THREE.Quaternion().setFromUnitVectors(up,direction.clone().normalize());instance('box',mats.red,center,[M(.15),direction.length(),M(.12)],q);
  }
  for(const side of [-1,1])railing([at(side*(w/2+M(.72)),-M(2.4)),at(side*(w/2+M(.72)),depth+M(.65))]);
  metroEntrances.push({...source,centerEN:at(0,depth/2),world:toWorld(at(0,depth/2),base),yaw,envelopeEN:apron,approximate:true});
 }
 for(const approach of pedestrianApproaches)ribbon(mats.walk,approach.pointsEN,approach.width,pavementElevation+.02);

 // Pedestrian railings follow curb fragments at the mapped main crossing,
 // leaving openings at the crossing axes and every portal approach.
 for(const road of roads.filter(r=>r.type==='service'||r.type==='street')){
  const measure=roadMeasures.get(road.id);
  for(let s=M(3);s<measure.length-M(3);s+=M(3)){
   const mid=samplePolyline(road.pointsEN,measure.cumulative,s),close=junctions.some(j=>distance(mid.point,j.pointEN)<M(75));if(!close)continue;
   for(const side of [-1,1]){
    const offset=side*(road.width/2+M(.45)),points=offsetPolyline([samplePolyline(road.pointsEN,measure.cumulative,s-M(1.5)).point,samplePolyline(road.pointsEN,measure.cumulative,s+M(1.5)).point],offset);
    if(points.some(p=>nearRoad(p,road,M(.6))||nearCrossing(p,M(1.2))||atLocalAccess(p,M(.8))||entranceData.some(e=>distance(p,e.entranceEN)<M(8))))continue;
    railing(points);
   }
  }
 }

 // Main-road median protection, inferred from the divided axes and 2025 view.
 const high=roads.filter(r=>r.type==='highway');
 for(const road of high){
  const m=roadMeasures.get(road.id),dir=unit([road.b[0]-road.a[0],road.b[1]-road.a[1]]);
  const worldDir=toWorld(dir);if(worldDir.x<0)continue;
  for(let s=M(5);s<m.length;s+=M(6)){
   const a=samplePolyline(road.pointsEN,m.cumulative,s),left=[-a.direction[1],a.direction[0]],p=[a.point[0]+left[0]*(road.width/2+M(.58)),a.point[1]+left[1]*(road.width/2+M(.58))];
   if(nearJunction(p,M(9))||nearCrossing(p,M(2)))continue;
   const b=[p[0]+a.direction[0]*M(5.7),p[1]+a.direction[1]*M(5.7)];
   ribbon(mats.curb,[p,b],M(.55),roadElevation+M(.18));
   for(const q of [p,b])beam(mats.rail,toWorld(q,roadElevation),toWorld(q,roadElevation+M(.82)),M(.035));
   for(const height of [.51,.79])beam(mats.rail,toWorld(p,roadElevation+M(height)),toWorld(b,roadElevation+M(height)),M(.045));
  }
 }

 const lamps=[],lampPositions=[];
 for(const road of roads.filter(r=>r.type!=='link')){
  const m=roadMeasures.get(road.id);for(let s=M(17);s<m.length-M(4);s+=M(34)){
   const sample=samplePolyline(road.pointsEN,m.cumulative,s),d=sample.direction,right=[d[1],-d[0]],p=[sample.point[0]+right[0]*(road.width/2+M(1)),sample.point[1]+right[1]*(road.width/2+M(1))];
   if(nearRoad(p,road,M(.4))||nearJunction(p,M(10))||nearCrossing(p,M(2))||atLocalAccess(p,M(.6))||lampPositions.some(q=>distance(q,p)<M(18))||entranceData.some(e=>distance(e.entranceEN,p)<M(8)))continue;
   lampPositions.push(p);const height=M(road.type==='highway'?9:7),base=toWorld(p,pavementElevation),top=toWorld(p,pavementElevation+height);
   beam(mats.rail,base,top,M(.065));
   const headEN=[p[0]-right[0]*M(1.6),p[1]-right[1]*M(1.6)],head=toWorld(headEN,pavementElevation+height-M(.14));beam(mats.rail,top,head,M(.04));
   const wd=toWorld(right),yaw=Math.atan2(wd.x,wd.z);box(mats.rail,headEN,head.y,M(.38),M(.14),M(.78),yaw);box(mats.lamp,headEN,head.y-M(.075),M(.27),M(.02),M(.58),yaw);
   lamps.push({x:head.x,y:head.y,z:head.z,position:[head.x,head.y,head.z],polePosition:[base.x,base.y,base.z],material:mats.lamp,source:'Curb-side lighting type from panorama 2025; spacing and individual poles are estimates'});
  }
 }

 const signalHeads=[],signalMaterials=new Map();
 function lampMaterials(flow,ped=false){const key=flow+(ped?'-ped':'');if(!signalMaterials.has(key))signalMaterials.set(key,(ped?[0xec3d32,0x49d785]:[0xec3d32,0xf9bf36,0x49d785]).map(c=>material(0x17211f,.65,{emissive:c,emissiveIntensity:0})));return signalMaterials.get(key);}
 function signal(en,forwardEN,flow,ped=false,source={}){
  const worldDir=toWorld(forwardEN).normalize(),front=worldDir.clone().negate(),yaw=Math.atan2(front.x,front.z),base=roadElevation;
  const height=M(ped?2.25:4.45),headHeight=M(ped?.82:1.62),pole=toWorld(en,base),center=toWorld(en,base+height);
  beam(mats.rail,pole,center.clone().add(new THREE.Vector3(0,-headHeight*.4,0)),M(.067));
  instance('box',mats.black,center,[M(ped?.46:.62),headHeight,M(.36)],yaw);
  const lampMats=lampMaterials(flow,ped),count=lampMats.length;
  for(let i=0;i<count;i++){const p=center.clone().addScaledVector(front,M(.195));p.y+=(count-1)*M(.43)/2-i*M(.43);instance('sphere',lampMats[i],p,[M(.17),M(.17),M(.055)],yaw);}
  const item={flow,kind:ped?'pedestrian':'vehicle',position:[center.x,center.y,center.z],polePosition:[pole.x,pole.y,pole.z],forwardEN,faceWorld:[front.x,front.z],lamps:lampMats,state:'red',...source};signalHeads.push(item);return item;
 }
 for(const control of signalControls){
  signal(control.poleEN,control.directionEN,control.flow,false,{controlId:control.id,sourceNodeId:control.sourceNodeId,source:control.placementSource,timingSource:signalPlan.source});
  if(control.road.type==='highway'){
   const center=control.stopLines[Math.floor(control.stopLines.length/2)].centerEN,pole=toWorld(control.poleEN,roadElevation+M(5.55)),across=toWorld(center,roadElevation+M(5.55));beam(mats.rail,pole,across,M(.072));
   const d=toWorld(control.directionEN).normalize().negate(),yaw=Math.atan2(d.x,d.z),head=across.clone().add(new THREE.Vector3(0,-M(.62),0)),lm=lampMaterials(control.flow);
   instance('box',mats.black,head,[M(.62),M(1.62),M(.36)],yaw);for(let j=0;j<3;j++){const p=head.clone().addScaledVector(d,M(.195));p.y+=M(.43-j*.43);instance('sphere',lm[j],p,[M(.17),M(.17),M(.055)],yaw);}
   signalHeads.push({flow:control.flow,kind:'vehicle',controlId:control.id,sourceNodeId:control.sourceNodeId,position:[head.x,head.y,head.z],lamps:lm,state:'red',source:'Overhead head type visible in panorama 2025; geometry/quantity inferred',timingSource:signalPlan.source});
  }
 }
 for(const crossing of crossings.filter(c=>c.regulated)){
  const m=measurePolyline(crossing.pointsEN);if(m.length<M(5))continue;
  for(const end of [0,m.length]){const p=samplePolyline(crossing.pointsEN,m.cumulative,end),d=end===0?p.direction:p.direction.map(v=>-v),right=[d[1],-d[0]],en=[p.point[0]+right[0]*M(1.7),p.point[1]+right[1]*M(1.7)];
   signal(en,d,'pedestrian',true,{sourceWayId:crossing.sourceWayId,source:'OSM regulated crossing; individual pedestrian heads reconstructed',timingSource:signalPlan.source});
  }
 }

 const batchMeshes=[];
 for(const [mat,positions] of triangles){if(!positions.length)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,mat);mesh.name=`Transport surface ${mat.color.getHexString()}`;mesh.receiveShadow=true;group.add(mesh);batchMeshes.push(mesh);}
 for(const batch of instances.values()){
  const mesh=new THREE.InstancedMesh(geo(batch.kind),batch.mat,batch.matrices.length);batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.castShadow=batch.mat!==mats.lamp;mesh.receiveShadow=true;mesh.name=`Transport batched ${batch.kind}`;group.add(mesh);batchMeshes.push(mesh);
 }
 let night=0,wetness=0,season='summer';
 function setSignalTime(seconds){
  for(const [key,materials] of signalMaterials){const flow=key.startsWith('pedestrian')?'pedestrian':key,state=signalAt(flow,seconds),ped=key.endsWith('-ped');
   materials.forEach((mat,i)=>{const on=ped?(i===0?state==='red':state==='green'):(i===0?state==='red'||state==='redAmber':i===1?state==='amber'||state==='redAmber':state==='green');mat.color.setHex(on?(ped?[0xe13d34,0x42d986]:[0xe13d34,0xe9bb32,0x42d986])[i]:0x17211f);mat.emissiveIntensity=on?3.8:.005;});
  }
  for(const head of signalHeads)head.state=signalAt(head.flow,seconds);
 }
 function setNight(value){night=THREE.MathUtils.clamp(Number(value)||0,0,1);mats.lamp.emissiveIntensity=.04+night*4.5;mats.red.emissiveIntensity=.35+night*1.3;}
 function setWetness(value){wetness=THREE.MathUtils.clamp(Number(value)||0,0,1);mats.asphalt.roughness=.96-wetness*.52;mats.walk.roughness=.93-wetness*.24;mats.asphalt.color.setHex(0x2e3033).multiplyScalar(1-wetness*.17);}
 function setSeason(value){season=value;const winter=value===true||value==='winter';mats.island.color.setHex(winter?0xdbe1da:0x7e8762);mats.stoneLight.color.setHex(winter?0xc5ceca:0xa5a7a0);}
 function reserved(x,z,margin=0){
  // Query coordinates are world X/Z, matching forest instance positions.
  const en=[(x*-.69716+z*.71691)/(.69716**2+.71691**2),(x*.71691+z*.69716)/(.69716**2+.71691**2)];
  for(const road of roads){const extra=M(road.type==='service'||road.type==='street'?2.65:1.1);if(closestOnPolyline(en,road.pointsEN,roadMeasures.get(road.id).cumulative).distance<road.width/2+extra+margin)return true;}
  for(const p of [...pedestrianApproaches,...crossings])if(closestOnPolyline(en,p.pointsEN,measurePolyline(p.pointsEN).cumulative).distance<p.width/2+M(.5)+margin)return true;
  for(const island of islandReservations){const delta=[en[0]-island.center[0],en[1]-island.center[1]],along=delta[0]*island.direction[0]+delta[1]*island.direction[1],cross=-delta[0]*island.direction[1]+delta[1]*island.direction[0];if((along/(island.length/2+margin))**2+(cross/(island.width/2+margin))**2<=1)return true;}
  return false;
 }
 function dispose(){parent.remove(group);const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}
 group.userData.transport={...transportMetadata,drawCalls:batchMeshes.length,renderedSignalHeads:signalHeads.length,streetLampCount:lamps.length,
  carRoadLevel:roadElevation,portalStyleReference:'User Yandex panorama 2025, exit 1; all four portal envelopes approximate',
  physicalSignalSource:'Mapped regulated approaches and 2025 mast/head type; no surveyed head count or individual pole positions'};
 setSignalTime(0);
 return {group,roads,lanes,trafficPaths,stopLines,lamps,metroEntrances,signalHeads,signalPlan,metadata:group.userData.transport,materials:mats,setNight,setWetness,setSeason,setSignalTime,reserved,dispose};
}
