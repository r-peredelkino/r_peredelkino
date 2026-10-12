// @r_peredelkino · the single fitness island and continuous garden in the October panoramas.
import * as T from './vendor/three.module.js';
import {complexFootprints as f} from './complex-footprints.js?v=publication371';
import {insideRing,solidContains} from './walk-physics.js?v=publication371';
import {addSportProgramme,addReferenceGardenLounge} from './courtyard-program.js?v=publication371';
import {referenceSportLayout,referenceGardenLounge,subtractReferenceCuts} from './courtyard-reference-layout.js?v=publication371';
import {courtyardSource,courtyardSourceBoundary,sourceCourtyardZones,sourceIslandAnchors,sourceGardenPaths,sourcePlazaInlays,sourceGrassPaverWedges,sampleSourcePath} from './courtyard-source-v33.js?v=publication371';
import {registeredContextFootprints} from './context-services.js?v=publication371';
import {arenaFootprint} from './arena-placement-v35.js?v=publication371';

const TAU=Math.PI*2;
const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0]},0);
const bounds=ring=>[Math.min(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[1]))];
const overlap=(a,b)=>a[0]<=b[1]&&a[1]>=b[0]&&a[2]<=b[3]&&a[3]>=b[2];
const ellipseRing=(x,z,rx,rz,n=72)=>Array.from({length:n},(_,i)=>[x+Math.cos(i/n*TAU)*rx,z+Math.sin(i/n*TAU)*rz]);
function smoothRing(points,n=96){return new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),true,'centripetal').getPoints(n).slice(0,-1).map(p=>[p.x,p.z]);}

// Visual surfaces, planting and walking collision all consume this same layout.
// The old empty kindergarten site becomes a garden with a clear central route.
export function referenceCourtyardLayout(source){
 const zones=sourceCourtyardZones.map(z=>({...z})),lounge=zones.find(z=>z.id==='lounge'),sportReference=referenceSportLayout(zones.find(z=>z.id==='sport')),gardenLounge=referenceGardenLounge(lounge);
 const utility=registeredContextFootprints.find(b=>b.role==='utility');
 const routeContours=sourceGardenPaths.map(route=>{const points=sampleSourcePath(route,120),left=[],right=[];for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,nx=-dz/length*(route.width/2+.16),nz=dx/length*(route.width/2+.16);left.push([points[i][0]+nx,points[i][1]+nz]);right.push([points[i][0]-nx,points[i][1]-nz]);}return[...left,...right.reverse()];});
 const architecturalCuts=[f.podium.outer,...f.buildings.map(b=>b.shape.map(([x,z])=>[b.x+x,b.z+z])),utility.world];
 const cuts=[...architecturalCuts,...zones.map(z=>z.id==='sport'?sportReference.clearance:ellipseRing(z.x,z.z,z.rx+.35,z.rz+.35)),gardenLounge.clearance,gardenLounge.approachClearance,...routeContours];
 const islands=sourceIslandAnchors.flatMap(item=>subtractReferenceCuts({outer:smoothRing(item.points,64),holes:[]},cuts).map(p=>({...p,id:item.id,source:CourtyardTraceSource(item)})));
 function CourtyardTraceSource(item){return{node:'node3',feature:item.id,kind:'source-ground boundary with inferred occluded edges'};}
 const planted=(x,z)=>islands.some(i=>solidContains(x,z,i));
 const treeSeeds=[[-6,-32,.95],[-3,-27,1.1],[1,-23,.9],[6,-40,.9],[13,-40,1],[18,-40,1.15],[-17,-36,.65],[-8,-12,.9],[-4,-14,.95],[1,-14,.95],[17,-20,1],[18,-15,.8],[18,-8,1.05],[10,9,1.3],[15,11,1.4],[17,15,1.05],[-8,22,.9],[-6,19,.75],[6,19,1],[7,24,.85],[19,36,1.1],[25,36,1.2],[30,37,1],[40,21,.7],[43,26,1],[45,30,1.1],[31,-47,1.1],[35,-46,.9],[39,-36,1],[-7,-22,.8],[16,-41,.85],[23,37,.8],[4,22,.9]];
 const trees=treeSeeds.filter(p=>planted(...p.slice(0,2))).map((p,i)=>[...p,i===16?'conifer':'deciduous']);
 const shrubs=[],flowers=[];let seed=331011;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const island of islands){const b=bounds(island.outer);for(let x=b[0]+.25;x<b[1];x+=.72)for(let z=b[2]+.25;z<b[3];z+=.72){const px=x+(random()-.5)*.30,pz=z+(random()-.5)*.30;if(!solidContains(px,pz,island)||trees.some(([tx,tz])=>Math.hypot(px-tx,pz-tz)<.35))continue;shrubs.push([px,pz,.60+random()*.37]);if(random()<.34)flowers.push([px+(random()-.5)*.1,pz+(random()-.5)*.1,Math.floor(random()*4)]);}}
 const lamps=[[-21,-37],[-14,-21],[-19,-11],[-18,5],[-15,20],[-6,30],[9,38],[35,37],[43,18],[29,-38],[33,-45]].filter(p=>!planted(...p)&&!architecturalCuts.some(r=>insideRing(...p,r)));
 return{...source,lamps,zones,islands,trees,shrubs,flowers,paths:sourceGardenPaths,plazaInlays:sourcePlazaInlays,latticeContours:sourceGrassPaverWedges.map(p=>smoothRing(p,64)),boundary:courtyardSourceBoundary,utility:{outer:utility.world,holes:[]},referenceGeometry:{sport:sportReference,lounge:gardenLounge},reference:{...courtyardSource,sourceViews:courtyardSource.views,fitnessZones:1,clearGardenPoint:[6,8],cuts,treeCount:trees.length,plantingPointCount:shrubs.length,featureCount:islands.length}};
}

export function addCourtyardRevision(group,m,{data}={}){
 const colliders=[],meshes=[];
 function mesh(geometry,material,x=0,y=0,z=0){const object=new T.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;object.userData.noAutomaticCollider=true;group.add(object);meshes.push(object);return object;}
 const box=(w,h,d,x,y,z,material)=>mesh(new T.BoxGeometry(w,h,d),material,x,y+h/2,z);
 function tube(points,radius,material,closed=false){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal'),Math.max(20,points.length*4),radius,6,closed),material);}
 function plane(ring,y,material){const shape=new T.Shape(ring.map(([x,z])=>new T.Vector2(x,-z))),geo=new T.ShapeGeometry(shape,32);geo.rotateX(-Math.PI/2);return mesh(geo,material,0,y,0);}
 function ellipse(x,z,rx,rz,y,material){return plane(ellipseRing(x,z,rx,rz,96),y,material);}
 function post(x,z,height,radius=.027,material=m.white){const object=mesh(new T.CylinderGeometry(radius,radius,height,10),material,x,height/2+.045,z);colliders.push({type:'circle',x,z,radius});return object;}

 // Draw the actual visible turf above the common plaza. Each triangle is clipped
 // against the same cutouts used by the walking world, even at an island edge.
 const grassPositions=[],grassNormals=[],grassUV=[];let turfArea=0;
 for(const island of data.islands){
  const outer=island.outer.map(p=>new T.Vector2(...p)),holes=(island.baseHoles??[]).map(h=>h.map(p=>new T.Vector2(...p))),vertices=[...island.outer,...(island.baseHoles??[]).flat()],triangles=T.ShapeUtils.triangulateShape(outer,holes);
  for(const ids of triangles){const p=ids.map(i=>vertices[i]);if(area(p)<0)p.reverse();turfArea+=Math.abs(area(p))*.5;for(const index of [0,2,1]){grassPositions.push(p[index][0],.031,p[index][1]);grassNormals.push(0,1,0);grassUV.push(p[index][0]*.4,p[index][1]*.4);}}
  const cutContains=p=>(island.cutouts??[]).some(h=>insideRing(...p,h));let points=[];
  for(let i=0;i<=island.outer.length;i++){const p=island.outer[i%island.outer.length];if(cutContains(p)){if(points.length>1)tube(points,.017,m.white);points=[];}else points.push([p[0],.044,p[1]]);}if(points.length>1)tube(points,.017,m.white);
 }
 const grassGeo=new T.BufferGeometry();grassGeo.setAttribute('position',new T.Float32BufferAttribute(grassPositions,3));grassGeo.setAttribute('normal',new T.Float32BufferAttribute(grassNormals,3));grassGeo.setAttribute('uv',new T.Float32BufferAttribute(grassUV,2));mesh(grassGeo,m.grass).name='Continuous garden turf above the mineral plaza';

 // One organic Sport Point: its dark perimeter, blue inset, planting cut and
 // collision-free equipment positions all use the same reference contour.
 const sport=data.zones.find(z=>z.id==='sport'),x=sport.x,z=sport.z,sportReference=data.referenceGeometry.sport;
 plane(sportReference.outer,.037,m.darkBlue).name='Continuous dark perimeter around the organic Sport Point';
 plane(sportReference.surface,.040,m.blue).name='Concave blue Sport Point surface around the garden peninsula';
 tube(sportReference.outer.map(([px,pz])=>[px,.050,pz]),.018,m.white,true);
 const programme=addSportProgramme(group,m,sport,sportReference);colliders.push(...programme.colliders);meshes.push(...programme.meshes);
 const rackCenter=programme.panna.center;
 const gardenLounge=addReferenceGardenLounge(group,m,data.referenceGeometry.lounge);colliders.push(...gardenLounge.colliders);meshes.push(...gardenLounge.meshes);

 // Meadow blades and feathery seed heads form dense low planting, not loose balls.
 const positions=[],colors=[],uv=[];
 function quad(a,b,c,d,color){for(const p of [a,b,c,a,c,d,c,b,a,d,c,a]){positions.push(...p);colors.push(...color);uv.push(0,0);}}
 const green=new T.Color(0x718264),straw=new T.Color(0xb2ad8e);
 for(let blade=0;blade<11;blade++){
  const angle=blade*2.399,height=.45+(blade%5)*.105,dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx,base=.11*(blade%3)/2;
  const edge=(t,side,plume=false)=>{const lean=.24*t*t,width=plume?.049*Math.sin((t-.76)/.34*Math.PI):.025*(1-t*.87);return[dx*(base+lean)+sx*width*side,height*t,dz*(base+lean)+sz*width*side];};
  for(let j=0;j<5;j++){const a=j/5,b=(j+1)/5;quad(edge(a,-1),edge(b,-1),edge(b,1),edge(a,1),[green.r,green.g,green.b]);}
  if(blade%2===0)for(let j=0;j<4;j++){const a=.76+j*.085,b=a+.085;quad(edge(a,-1,true),edge(b,-1,true),edge(b,1,true),edge(a,1,true),[straw.r,straw.g,straw.b]);}
 }
 const meadowGeometry=new T.BufferGeometry();meadowGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));meadowGeometry.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(positions.length),3));meadowGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));meadowGeometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));meadowGeometry.computeVertexNormals();
 m.meadow=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});
 const meadowPoints=data.shrubs.filter((_,i)=>i%3===0),meadow=new T.InstancedMesh(meadowGeometry,m.meadow,meadowPoints.length),dummy=new T.Object3D();meadow.name='Dense mixed meadow grasses and feathery seed heads';meadow.receiveShadow=true;
 meadowPoints.forEach(([px,pz,s],i)=>{dummy.position.set(px,.052,pz);dummy.rotation.y=i*2.399;dummy.scale.setScalar(.84+s*.25);dummy.updateMatrix();meadow.setMatrixAt(i,dummy.matrix);});meadow.instanceMatrix.needsUpdate=true;group.add(meadow);

 const blocked=[f.podium,arenaFootprint,data.utility,...data.islands].map(shape=>({shape,b:bounds(shape.outer)}));
 function freeSurface(px,pz){for(const {shape,b} of blocked)if(px>=b[0]&&px<=b[1]&&pz>=b[2]&&pz<=b[3]&&solidContains(px,pz,shape))return false;for(const zone of data.zones)if(zone.id==='sport'?insideRing(px,pz,sportReference.clearance):((px-zone.x)/(zone.rx+.12))**2+((pz-zone.z)/(zone.rz+.12))**2<1)return false;if(insideRing(px,pz,gardenLounge.clearance))return false;return px>-42&&px<51&&pz>-52&&pz<58;}
 const gridPositions=[],gridNormals=[],gridUV=[],latticePatches=[];
 // Broad curved wedges follow the fronts of the planted islands in refs4/5/7.
 const latticeContours=data.latticeContours;
 for(const [patchIndex,contour] of latticeContours.entries()){const b=bounds(contour);let cells=0;for(let px=b[0];px<=b[1];px+=.44)for(let pz=b[2];pz<=b[3];pz+=.44){if(!insideRing(px,pz,contour)||!freeSurface(px,pz))continue;const h=.158,corners=[[px-h,.036,pz-h],[px+h,.036,pz-h],[px+h,.036,pz+h],[px-h,.036,pz+h]];for(const i of [0,2,1,0,3,2]){gridPositions.push(...corners[i]);gridNormals.push(0,1,0);gridUV.push(0,0);}cells++;}if(cells)latticePatches.push({id:patchIndex,cells,contour});}
 if(gridPositions.length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(gridPositions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(gridNormals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(gridUV,2));mesh(geometry,m.grass).name='Wide curved grass-paver wedges';}

 const routes=data.paths;
 const inlayPositions=[],inlayNormals=[],inlayUV=[],pathPositions=[],pathNormals=[],pathUV=[];let whiteInlayLength=0;
 function segment(points,width,y,arrays){const [a,b]=points,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,nx=-dz/len*width/2,nz=dx/len*width/2,corners=[[a[0]+nx,y,a[1]+nz],[a[0]-nx,y,a[1]-nz],[b[0]+nx,y,b[1]+nz],[b[0]-nx,y,b[1]-nz]];for(const k of [0,2,1,1,2,3]){arrays[0].push(...corners[k]);arrays[1].push(0,1,0);arrays[2].push(0,0);}return len;}
 for(const route of routes){const c=new T.CatmullRomCurve3(route.points.map(([px,pz])=>new T.Vector3(px,0,pz)),false,'centripetal');for(let i=0;i<250;i++){const a=c.getPoint(i/250),b=c.getPoint((i+1)/250),t=c.getTangent((i+.5)/250),len=Math.hypot(t.x,t.z)||1,nx=-t.z/len,nz=t.x/len;if(!freeSurface(a.x,a.z)||!freeSurface(b.x,b.z))continue;
   if(freeSurface(a.x+nx*route.width/2,a.z+nz*route.width/2)&&freeSurface(a.x-nx*route.width/2,a.z-nz*route.width/2)){segment([[a.x,a.z],[b.x,b.z]],route.width,.024,[pathPositions,pathNormals,pathUV]);for(const side of [-1,1])whiteInlayLength+=segment([[a.x+nx*route.width/2*side,a.z+nz*route.width/2*side],[b.x+nx*route.width/2*side,b.z+nz*route.width/2*side]],.033,.052,[inlayPositions,inlayNormals,inlayUV]);}
  }}
 // Long, irregular white inlays cross the open plaza in front of the garden.
 const plazaLines=data.plazaInlays;
 for(const points of plazaLines){const c=new T.CatmullRomCurve3(points.map(([px,pz])=>new T.Vector3(px,0,pz)),false,'centripetal');for(let i=0;i<240;i++){const a=c.getPoint(i/240),b=c.getPoint((i+1)/240);if(freeSurface(a.x,a.z)&&freeSurface(b.x,b.z))whiteInlayLength+=segment([[a.x,a.z],[b.x,b.z]],.040,.057,[inlayPositions,inlayNormals,inlayUV]);}}
 for(const [arrays,material,name] of [[[pathPositions,pathNormals,pathUV],m.path,'Narrow graphite garden paths'],[[inlayPositions,inlayNormals,inlayUV],m.white,'Fine continuous flowing white mineral inlays']])if(arrays[0].length){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(arrays[0],3));geometry.setAttribute('normal',new T.Float32BufferAttribute(arrays[1],3));geometry.setAttribute('uv',new T.Float32BufferAttribute(arrays[2],2));mesh(geometry,material).name=name;}

 // Low boat-like planting containers, white pebble seats and small orange bins.
 const planters=[[-28,-7,1.5,.82,-.2],[-22,11,2.35,.9,.6],[-9,20,1.65,.85,-.3],[5,28,2.2,.9,.3],[31,29,1.4,.8,.1]];
 for(const [cx,cz,rx,rz,angle] of planters){if(!freeSurface(cx,cz))continue;const outline=smoothRing([[-rx,0],[-rx*.5,-rz],[rx*.6,-rz*.88],[rx,.16],[rx*.38,rz],[-rx*.55,rz*.8]],60),outer=outline.map(([px,pz])=>[cx+Math.cos(angle)*px-Math.sin(angle)*pz,cz+Math.sin(angle)*px+Math.cos(angle)*pz]),inner=outer.map(([px,pz])=>[cx+(px-cx)*.83,cz+(pz-cz)*.76]);const shape=new T.Shape(outer.map(([px,pz])=>new T.Vector2(px,-pz)));shape.holes.push(new T.Path(inner.map(([px,pz])=>new T.Vector2(px,-pz))));const geo=new T.ExtrudeGeometry(shape,{depth:.61,bevelEnabled:false,curveSegments:24});geo.rotateX(-Math.PI/2);mesh(geo,m.white,0,.045,0);plane(inner,.52,m.grass);for(let i=0;i<12;i++){const a=i*2.399,r=Math.sqrt((i+.5)/12),o=mesh(new T.IcosahedronGeometry(.25,1),i%3===0?m.flower:m.shrubs,cx+Math.cos(a)*rx*.70*r,.66,cz+Math.sin(a)*rz*.62*r);o.scale.set(1,.8,1);}colliders.push({type:'box',x:cx,z:cz,width:rx*2,depth:rz*2,angle});}
 for(const [px,pz,scale] of [[-32,-9,1],[-31,-5,.85],[-28,-2,1.1],[4,38,1],[7,42,1.05],[30,31,.9]]){if(!freeSurface(px,pz))continue;const pebble=mesh(new T.SphereGeometry(.80,24,12),m.white,px,.24,pz);pebble.scale.set(1.6*scale,.33,1.0*scale);pebble.rotation.y=px*.5;colliders.push({type:'circle',x:px,z:pz,radius:.78*scale});}
 for(const [px,pz] of [[-31,-11],[-23,11],[-11,20],[3,39],[31,30]]){if(!freeSurface(px,pz))continue;mesh(new T.CylinderGeometry(.21,.21,.95,14),m.terracotta,px,.48,pz);colliders.push({type:'circle',x:px,z:pz,radius:.21});}
 return{center:[6,8],fitnessCenter:[x,z],bounds:{rx:sport.rx,rz:sport.rz},replaces:'kindergarten',maxEquipmentHeight:Math.max(2.66,gardenLounge.roofHeight+gardenLounge.roofThickness),colliders,meadow,meadowPoints,latticePatches,whiteInlayLength,rackCenter,turfArea,gardenLounge,sportReference,meshes,programme,fitnessZones:1,setSeason(winter){m.meadow.color.set(winter?0xaeb8ab:0xffffff);}};
}
