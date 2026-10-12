// @r_peredelkino · two-storey gastro street, reconstructed from the supplied
// 12.03.36 / 12.03.39 / 12.03.41 panoramas. Tenant interiors are indicative.
import * as THREE from './vendor/three.module.js';
import {complexFootprints as footprint} from './complex-footprints.js?v=references37';
import {facesCourtyard,retailLevels as levels} from './frontage-zones.js?v=references37';
import {courtyardPassage,splitPassageSegment,splitGroundPane} from './courtyard-passage.js?v=references37';
import {commercialClearHeight} from './building-levels.js';
import {createWindowLighting} from './window-lighting.js?v=references37';
import {createShopInteriorTexture} from './shop-interiors.js?v=references37';
import {createShopFrontageLayout} from './shop-frontage-layout.js?v=references37';
import {arenaUpperRelief,segmentsOutsideArenaRelief,clipUpperPaneToArena,createGroundArenaUnionGeometry} from './podium-upper-cut.js?v=references37';
import {arenaCenter,arenaGroundRadius,arenaPlacement,segmentsOutsideArenaGround,clipGroundPaneToArena} from './arena-placement-v35.js?v=references37';
import {solidContains} from './walk-physics.js?v=references37';

function merge(geometries){
 if(!geometries.length)return new THREE.BufferGeometry();
 const source=geometries.map(g=>g.index?g.toNonIndexed():g),count=source.reduce((n,g)=>n+g.attributes.position.count,0),p=new Float32Array(count*3),n=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;
 for(let i=0;i<source.length;i++){const g=source[i],size=g.attributes.position.count;p.set(g.attributes.position.array,at*3);n.set(g.attributes.normal.array,at*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,at*2);at+=size;if(g!==geometries[i])g.dispose();geometries[i].dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
function slabGeometry(shape,height){
 const s=new THREE.Shape(shape.outer.map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const h of shape.holes||[])s.holes.push(new THREE.Path(h.map(([x,z])=>new THREE.Vector2(x,-z))));
 const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:32});g.rotateX(-Math.PI/2);return g;
}
function contourBays(contour,pitch=2.35){
 const lengths=[0];for(let i=1;i<contour.length;i++)lengths.push(lengths.at(-1)+Math.hypot(contour[i][0]-contour[i-1][0],contour[i][1]-contour[i-1][1]));
 const perimeter=lengths.at(-1),count=Math.ceil(perimeter/pitch),step=perimeter/count;
 const at=distance=>{distance=((distance%perimeter)+perimeter)%perimeter;let low=0,high=lengths.length-2;while(low<high){const middle=Math.ceil((low+high)/2);if(lengths[middle]<=distance)low=middle;else high=middle-1;}const a=contour[low],b=contour[low+1],length=lengths[low+1]-lengths[low],t=(distance-lengths[low])/(length||1);return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,length};};
 return Array.from({length:count},(_,i)=>{const a=at(i*step),b=at((i+1)*step),m=at((i+.5)*step),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);return{...m,dx,dz,pitch:length};});
}

export function createCommercialFrontage(root,{towers,whiteMaterial,privacyMaterial,brandTexture}){
 const group=new THREE.Group();group.name='Two complete retail storeys with continuous white floor bands';root.add(group);
 const materials={white:whiteMaterial,privacy:privacyMaterial,frame:new THREE.MeshStandardMaterial({color:0x414744,roughness:.32,metalness:.14,envMapIntensity:.45}),handle:new THREE.MeshStandardMaterial({color:0x7d796d,roughness:.24,metalness:.74})};
 const frames=[],handles=[],whitePrivacy=[],darkPrivacy=[],towerSeparators=[],commercialPanes=[],upperCommercialPanes=[],towerCommercialPanes=[],doors=[],roofAbutments=[];
 const add=(g,m,name)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;group.add(o);return o;};
 const box=(list,w,h,d,x,y,z,angle=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);list.push(g);};
 const [ax,az]=arenaCenter,arenaRadius=arenaGroundRadius,[sourceAx,sourceAz]=footprint.arenaCenter;
 let bayId=0,upperJunctionId=100000,groundJunctionId=200000;
 for(const [contourIndex,contour] of [footprint.podium.outer,...footprint.podium.holes].entries()){
  const outer=contour===footprint.podium.outer,area=contour.reduce((v,p,i)=>{const q=contour[(i+1)%contour.length];return v+p[0]*q[1]-q[0]*p[1];},0),orientation=(area>0?1:-1)*(outer?1:-1);
  for(let i=0;i<contour.length-1;i++){
   const p=contour[i],q=contour[i+1],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.12)continue;
   const nx=orientation*dz/length,nz=-orientation*dx/length,angle=-Math.atan2(dz,dx),mx=(p[0]+q[0])/2,mz=(p[1]+q[1])/2;
   if(facesCourtyard(mx,mz,nx,nz)){
    // Smooth white connecting walls end at the black tower plinths. The
    // original tower geometry remains the authority for its separate portals.
    const groundWall=splitPassageSegment([p[0]+nx*.12,p[1]+nz*.12],[q[0]+nx*.12,q[1]+nz*.12],.025);
    for(const segment of groundWall.outside)for(const [a,b] of segmentsOutsideArenaGround(...segment))box(whitePrivacy,Math.hypot(b[0]-a[0],b[1]-a[1])+.025,levels.dividerBottom,.20,(a[0]+b[0])/2,levels.dividerBottom/2,(a[1]+b[1])/2,angle);
    for(const segment of groundWall.inside)for(const [a,b] of segmentsOutsideArenaGround(...segment))box(whitePrivacy,Math.hypot(b[0]-a[0],b[1]-a[1])+.005,levels.dividerBottom-courtyardPassage.clearHeight,.20,(a[0]+b[0])/2,(levels.dividerBottom+courtyardPassage.clearHeight)/2,(a[1]+b[1])/2,angle);
    const a=[p[0]+nx*.12,p[1]+nz*.12],b=[q[0]+nx*.12,q[1]+nz*.12];
    for(const [start,end] of segmentsOutsideArenaRelief(a,b,0,{bottom:levels.upperBottom,top:levels.upperTop})){
     const w=Math.hypot(end[0]-start[0],end[1]-start[1]);
     box(whitePrivacy,w,levels.upperTop-levels.upperBottom,.20,(start[0]+end[0])/2,(levels.upperTop+levels.upperBottom)/2,(start[1]+end[1])/2,angle);
    }
   }
  }
  for(const [frontageIndex,bay] of contourBays(contour).entries()){
    const {x,z,dx,dz,pitch,length}=bay,nx=orientation*dz/pitch,nz=-orientation*dx/pitch,angle=-Math.atan2(dz,dx);
    if(facesCourtyard(x,z,nx,nz))continue;
    // Reserve original bay IDs even where the translated circle now covers a
    // bay. This keeps remote doors/interior layouts stable along both wings.
    const existingGroundBay=Math.hypot(x-sourceAx,z-sourceAz)>=arenaRadius+.70;
    const pane={id:existingGroundBay?bayId++:upperJunctionId++,frontageChain:`podium:${contourIndex}`,frontageIndex,x:x+nx*.10,z:z+nz*.10,nx,nz,angle,length,width:Math.max(.1,pitch-.075),pitch,signY:levels.signY,
     y:(levels.groundBottom+levels.groundTop)/2,height:levels.groundTop-levels.groundBottom,storey:1,bottom:levels.groundBottom,top:levels.groundTop};
    for(const fragment of splitGroundPane(pane)){
     const id=existingGroundBay?bayId++:groundJunctionId++;
     for(const [partIndex,part] of clipGroundPaneToArena({...fragment,id}).entries())commercialPanes.push({...part,id:partIndex?groundJunctionId++:id});
    }
    const upper={...pane,storey:2,y:(levels.upperBottom+levels.upperTop)/2,height:levels.upperTop-levels.upperBottom,bottom:levels.upperBottom,top:levels.upperTop};
    for(const fragment of clipUpperPaneToArena(upper))upperCommercialPanes.push({...fragment,id:fragment.arenaJunction.trimmed?upperJunctionId++:pane.id});
  }
 }
 // The arena's visible ground-floor glazing continues the retail base, while
 // its upper level belongs to the rounded media shell instead of a shop row.
 const arenaPanes=[];
 for(let i=0;i<72;i++){
  const angle=(i+.5)/72*Math.PI*2,nx=Math.sin(angle),nz=Math.cos(angle),x=ax+nx*(arenaRadius+.10),z=az+nz*(arenaRadius+.10),pitch=2*arenaRadius*Math.sin(Math.PI/72);
  const sourceVisible=!facesCourtyard(sourceAx+nx*(arenaRadius+.10),sourceAz+nz*(arenaRadius+.10),nx,nz),id=sourceVisible?bayId++:groundJunctionId++;
  if(facesCourtyard(x,z,nx,nz)||solidContains(x+nx*.05,z+nz*.05,footprint.podium))continue;
  const p={id,frontageChain:'arena',frontageIndex:i,arena:true,x,z,nx,nz,angle,length:pitch,width:pitch-.045,pitch,signY:levels.signY,y:(levels.groundBottom+levels.groundTop)/2,height:levels.groundTop-levels.groundBottom,storey:1,bottom:levels.groundBottom,top:levels.groundTop};commercialPanes.push(p);arenaPanes.push(p);
 }
 const office=footprint.buildings.find(b=>b.id===0),officePortal=commercialPanes.filter(p=>p.length>=3.7).sort((a,b)=>Math.hypot(a.x-office.x,a.z-office.z)-Math.hypot(b.x-office.x,b.z-office.z))[0];
 for(const p of commercialPanes)p.officeLobby=!!officePortal&&Math.hypot(p.x-officePortal.x,p.z-officePortal.z)<8.5;
 for(const p of upperCommercialPanes)p.officeLobby=false;
 // The same two-storey order continues into every outward-facing tower base.
 // The taller 6.68 m commercial bay at tower 1 keeps its documented clear top.
 for(const [id,tower] of towers){if(id===0)continue;const clear=commercialClearHeight(id);
  roofAbutments.push({towerId:id,bottom:clear-.02,top:clear+.24,terraceLevel:levels.roof+.055,residentialStructuralTop:clear+.32});
  for(const [frontageIndex,bay] of tower.bays.entries()){
   const {middle,normal,angle,length}=bay,x=tower.spec.x+middle.x+normal[0]*.20,z=tower.spec.z-middle.y+normal[1]*.20;
   // A narrow opaque construction edge closes the structural allowance below
   // the first residential ribbon, including the higher 7.00 m base of K1.
   box(darkPrivacy,length+.025,.26,.14,x+normal[0]*.015,clear+.11,z+normal[1]*.015,angle);
   if(facesCourtyard(x,z,...normal)){box(darkPrivacy,length*1.04,clear,.22,x+normal[0]*.06,clear/2,z+normal[1]*.06,angle);continue;}
   for(const [storey,bottom,top] of [[1,levels.groundBottom,levels.groundTop],[2,levels.upperBottom,clear]])towerCommercialPanes.push({id:bayId++,frontageChain:`tower:${id}`,frontageIndex,towerId:id,x,z,nx:normal[0],nz:normal[1],angle,width:length*.97,pitch:length,storey,bottom,top,y:(bottom+top)/2,height:top-bottom});
   box(towerSeparators,length+.02,levels.dividerTop-levels.dividerBottom,3.4,x-normal[0]*1.64,levels.signY,z-normal[1]*1.64,angle);
  }
 }
 const divider=add(createGroundArenaUnionGeometry(footprint.podium,levels.dividerTop-levels.dividerBottom),materials.white,'Continuous white band joining the podium and projecting arena');divider.position.y=levels.dividerBottom;
 const courtyardPrivacy=add(merge(whitePrivacy),materials.white,'Smooth white courtyard side of the two-storey connecting podium');
 const towerPrivacy=add(merge(darkPrivacy),materials.privacy,'Dark private tower plinths beside the commercial volumes');
 const commercialUpperFrames=add(merge(towerSeparators),materials.white,'Continuous second-storey separators in commercial tower bases');
 // The office's separate transparent outer glazing used to reveal the solid
 // black podium immediately behind it. Keep that existing glass layer, but
 // supply the same restrained interior backing as the rest of this frontage.
 // This is a visual backing, not an invented office floor plan or tenant fitout.
 const allCommercialPanes=[...commercialPanes,...upperCommercialPanes,...towerCommercialPanes];
 const interiorLayout=createShopFrontageLayout(allCommercialPanes);
 const shopInteriorTexture=createShopInteriorTexture(brandTexture),geometry=new THREE.BoxGeometry(1,1,.045),commercialLights=createWindowLighting(geometry,allCommercialPanes.length,{seed:791,columns:12,kind:'commercial',brandTexture,interiorTexture:shopInteriorTexture,interiorGroups:interiorLayout.records});
 commercialLights.material.roughness=.27;commercialLights.material.metalness=.08;commercialLights.material.envMapIntensity=.45;
 const shopWindows=new THREE.InstancedMesh(geometry,commercialLights.material,allCommercialPanes.length),dummy=new THREE.Object3D();shopWindows.name='Connected shop interiors across adjacent glazing with quieter upper galleries';
 allCommercialPanes.forEach((p,i)=>{const backing=p.officeLobby?.055:0;dummy.position.set(p.x-p.nx*backing,p.y,p.z-p.nz*backing);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.width,p.height,1);dummy.updateMatrix();shopWindows.setMatrixAt(i,dummy.matrix);shopWindows.setColorAt(i,new THREE.Color(p.storey===2?0xe1e6df:0xeff0e8));});
 shopWindows.instanceMatrix.needsUpdate=true;shopWindows.instanceColor.needsUpdate=true;shopWindows.receiveShadow=true;group.add(shopWindows);
 for(const p of [...commercialPanes,...upperCommercialPanes,...towerCommercialPanes]){
  const c=Math.cos(p.angle),s=Math.sin(p.angle),x=p.x+p.nx*.045,z=p.z+p.nz*.045;
  for(const side of [-1,1])box(frames,.046,p.height,.09,x+c*side*p.width/2,p.y,z-s*side*p.width/2,p.angle);
  for(const y of [p.bottom+.027,p.top-.027])box(frames,p.width,.054,.095,x,y,z,p.angle);
  if(p.storey===2){box(frames,p.width,.025,.09,x,p.top-.37,z,p.angle);continue;}
  if(p.officeLobby||p.towerId!==undefined||p.width<1.4||p.id%5!==2)continue;
  // Recessed double doors are part of the same facade bay: no added external
  // doorway volume or obstacle on the public promenade.
  box(frames,.047,2.55,.09,x,1.515,z,p.angle);box(frames,p.width,.045,.09,x,2.79,z,p.angle);
  for(const side of [-1,1])box(handles,.023,.55,.045,x+c*side*.16+p.nx*.055,1.35,z-s*side*.16+p.nz*.055,p.angle);
  doors.push({x,z,nx:p.nx,nz:p.nz,width:p.width,height:2.55});
 }
 const facadeFrames=add(merge(frames),materials.frame,'Fine dark shop mullions, door leaves and opening transoms');
 const doorHandles=add(merge(handles),materials.handle,'Paired metal handles on the gastro street doors');
 const metadata={version:25,storeys:2,levels,sourceViews:['12.03.36','12.03.39','12.03.41','12.03.11'],footprintUnchanged:true,groundPassage:courtyardPassage,
  lowerBays:commercialPanes.length-arenaPanes.length,upperBays:upperCommercialPanes.length,arenaBays:arenaPanes.length,towerBays:towerCommercialPanes.length,doors,roofAbutments,arenaUpperRelief,referenceDatum:'model reconstruction, aligned to existing residential structural base'};
 metadata.interiorGroups=interiorLayout.groups;metadata.connectedInteriorPanes=interiorLayout.records.length;
 metadata.arenaAbutment={version:35,profileMatched:true,placement:arenaPlacement,partialUpperBays:upperCommercialPanes.filter(p=>p.arenaJunction?.trimmed).map(p=>({x:p.x,z:p.z,width:p.width,sourceWidth:p.arenaJunction.sourceWidth,cutRadius:p.arenaJunction.cutRadius})),
  partialGroundBays:commercialPanes.filter(p=>p.arenaGroundJunction?.trimmed).map(p=>({x:p.x,z:p.z,width:p.width,cutRadius:p.arenaGroundJunction.cutRadius})),
  arenaFacadeUnchanged:true,sourceFootprintUnchanged:true,remoteGroundBayIdsPreserved:true,groundBaysChangedOnlyAtArenaJunction:true,method:'translated circular capsule; both storeys trimmed with 24 mm concealed underlap and a unioned continuous retail fascia'};
 metadata.materialRefinement={sourceViews:['2026-10-11 09.29.14','2026-10-11 09.29.18','2026-10-11 09.29.19'],upperTint:'#e1e6df',lowerTint:'#eff0e8',metalness:.08,roughness:.27,envMapIntensity:.45,officeInteriorBackings:commercialPanes.filter(p=>p.officeLobby).length,officeBackingOffset:.055,overallRetailHeightUnchanged:true,fasciaHeight:.78,previousFasciaHeight:.58};
 group.userData.commercialFrontage=metadata;
 return{group,metadata,materials,commercialPanes,upperCommercialPanes,towerCommercialPanes,arenaPanes,allCommercialPanes,interiorLayout,commercialLights,shopWindows,shopInteriorTexture,commercialUpperFrames,divider,courtyardPrivacy,towerPrivacy,facadeFrames,doorHandles,doors,dispose(){
  shopWindows.dispose();shopInteriorTexture.dispose();group.traverse(o=>o.geometry?.dispose());materials.frame.dispose();materials.handle.dispose();commercialLights.material.dispose();root.remove(group);
 }};
}
