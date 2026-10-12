// @r_peredelkino · authored biophilic garden additions, revision 35.
// Plant palettes and kinetic art are optional concepts, not developer schedules.
// Existing v33 bed/paving boundaries and v34 furniture anchors are never edited.
import * as T from './vendor/three.module.js';
import {attribution} from './attribution.js?v=community38';
import {bakeSceneAuthorship} from './baked-authorship.js?v=community38';
import {createMineralMaterial,createFoliageMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';
import {perennialSprigGeometry} from './botanical-geometry.js?v=community38';
import {solidContains,insideRing,segmentDistance} from './walk-physics.js?v=community38';
import {courtyardPassage} from './courtyard-passage.js?v=community38';
import {frontageGroundHeight,forecourtRoadsideReserved} from './forecourt-ground.js?v=community38';
import {createRestaurantTerrace} from './restaurant-terrace-v35.js?v=community38';

const TAU=Math.PI*2;
export const cyberGardenConcept=Object.freeze({revision:35,author:attribution.handle,modelId:attribution.modelId,authoredConcept:true,existingLayoutUnchanged:true,
 description:'Layered understory inside existing beds; a small kinetic light flower and an optional outdoor restaurant shade',
 artId:'garden-breathing-art',artLabel:'Дыхание сада · световой цветок',modes:['calm','pulse','social'],operatorConfirmed:false,
 plantingStatus:'Authorial palette and visual planting formations; species and schedules are not developer-confirmed',waterFeature:false});

function ribbonGeometry(kind='grass'){
 const positions=[],uv=[],colors=[],count=kind==='grass'?12:7;
 for(let leaf=0;leaf<count;leaf++){
  const angle=leaf*2.399963,r=.018+(leaf%3)*.016,dx=Math.cos(angle),dz=Math.sin(angle),nx=-dz,nz=dx,
   height=kind==='grass'?.72+(leaf%5)*.067:.36+(leaf%4)*.075,
   width=kind==='grass'?.014+(leaf%3)*.002:.043+(leaf%3)*.013;
  const edge=(t,side)=>{
   const reach=kind==='grass'?.22*t*t:.31*t,
    w=width*(kind==='grass'?1-.91*t:Math.sin((t*.90+.045)*Math.PI)),
    y=kind==='grass'?height*t:height*Math.sin(t*1.4);
   return[(r+reach)*dx+nx*w*side,y,(r+reach)*dz+nz*w*side];
  };
  for(let segment=0;segment<5;segment++){
   const a=segment/5,b=(segment+1)/5,verts=[edge(a,-1),edge(b,-1),edge(b,1),edge(a,-1),edge(b,1),edge(a,1)];
   for(const [i,p]of verts.entries()){positions.push(...p);uv.push(i%3===0?0:1,segment/5);const light=.68+.25*(p[1]/height);colors.push(light,Math.min(1,light*1.06),light*.87);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.planting={rooted:true,rootY:0,height:kind==='grass'?1:.6,footprintRadius:kind==='grass'?.28:.39};return g;
}

function addWind(material){
 const uniforms={uGardenTime:{value:0},uGardenBreeze:{value:1}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='uniform float uGardenTime;\nuniform float uGardenBreeze;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   float gardenSeed=position.x*2.3+position.z*2.7;
   #ifdef USE_INSTANCING
    gardenSeed+=instanceMatrix[3].x*.19+instanceMatrix[3].z*.17;
   #endif
   transformed.x+=sin(uGardenTime*.66+gardenSeed+position.y*2.4)*position.y*position.y*.033*uGardenBreeze;
   transformed.z+=cos(uGardenTime*.51+gardenSeed)*position.y*position.y*.019*uGardenBreeze;
  `);
 };
 material.customProgramCacheKey=()=> 'cyber-garden-v35-rooted-breeze';return uniforms;
}

function gardenSprig(blossom){
 const geometry=perennialSprigGeometry(blossom);
 // Slightly broader flower clusters stay inside the reserved root envelope
 // and make the muted violet/ivory accents legible in pedestrian views.
 geometry.scale(1.35,1,1.35);return geometry;
}

export function createCyberGarden(root,{world,courtyardData,officeTerrace=null,entrances=[]}={}){
 if(!root?.isObject3D||typeof world?.free!=='function'||!courtyardData?.islands)throw new TypeError('Cyber garden requires the actual scene root, pedestrian world and existing bed layout');
 const group=new T.Group();group.name='Optional authored garden layers and breathing light flower';root.add(group);
 const m={
  grass:new T.MeshStandardMaterial({color:0x8b9571,vertexColors:true,roughness:.93,side:T.DoubleSide}),
  understory:createFoliageMaterial(0x687b59,{dense:true}),
  lavender:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.90,side:T.DoubleSide}),
  pale:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.90,side:T.DoubleSide}),
  mineral:createMineralMaterial(0xdedbcf,{grain:.024,name:'Fine mineral base of the breathing garden art'}),
  bronze:new T.MeshStandardMaterial({color:0x94876a,metalness:.64,roughness:.37}),
  light:new T.MeshStandardMaterial({color:0xd7ddd0,emissive:0x76babe,emissiveIntensity:.08,roughness:.29,metalness:.2}),
  warm:new T.MeshStandardMaterial({color:0xcab991,emissive:0xd6b16e,emissiveIntensity:.055,roughness:.4})
 };
 const windUniforms=[addWind(m.grass),addWind(m.understory),addWind(m.lavender),addWind(m.pale)],dummy=new T.Object3D(),formations=[],plants={grass:[],understory:[],lavender:[],pale:[]},obstacles=[],interactions=[],skipped=[];
 // Geometries have a known maximum root envelope. Every formation sample
 // checks that envelope against its exact island including polygon holes.
 const sourceSnapshot=JSON.stringify(courtyardData.islands);
 let randomState=351011;const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const footprintRadius={grass:.30,understory:.42,lavender:.24,pale:.24};
 for(const [islandIndex,island]of courtyardData.islands.entries()){
  const xs=island.outer.map(p=>p[0]),zs=island.outer.map(p=>p[1]),grid=1.62;
  const counts={grass:0,understory:0,lavender:0,pale:0},islandPoints={grass:[],understory:[],lavender:[],pale:[]};
  for(let x=Math.min(...xs)+.5;x<Math.max(...xs)-.2;x+=grid)for(let z=Math.min(...zs)+.5;z<Math.max(...zs)-.2;z+=grid){
   const px=x+(random()-.5)*.32,pz=z+(random()-.5)*.32;
   const cellX=Math.floor((px-Math.min(...xs))/3),cellZ=Math.floor((pz-Math.min(...zs))/3),palette=(cellX+cellZ*2+islandIndex)%5,
    kind=palette===0?'understory':palette===1||palette===2?'grass':palette===3?'lavender':'pale',radius=footprintRadius[kind];
   if(!solidContains(px,pz,island)||Array.from({length:12},(_,i)=>i/12*TAU).some(a=>!solidContains(px+Math.cos(a)*radius,pz+Math.sin(a)*radius,island)))continue;
   if(courtyardData.trees?.some(([tx,tz])=>Math.hypot(tx-px,tz-pz)<.52))continue;
   const p={x:px,z:pz,scale:kind==='grass'?.79+random()*.31:kind==='understory'?.72+random()*.22:.46+random()*.22,islandId:island.id||'island-'+islandIndex,islandIndex,rootY:.035};
   plants[kind].push(p);islandPoints[kind].push([px,pz]);counts[kind]++;
  }
  for(const kindof of Object.keys(plants))if(counts[kindof])formations.push({islandId:island.id||'island-'+islandIndex,islandIndex,type:kindof,footprintRadius:footprintRadius[kindof],points:islandPoints[kindof],count:counts[kindof]});
 }
 const plantMeshes=[],geometries={grass:ribbonGeometry('grass'),understory:ribbonGeometry('broadleaf'),lavender:gardenSprig(0xb49dbe),pale:gardenSprig(0xe0dfc7)};
 for(const kindof of Object.keys(plants)){
  const pts=plants[kindof],mesh=new T.InstancedMesh(geometries[kindof],m[kindof],pts.length);mesh.name='Authored layered planting · '+kindof;mesh.castShadow=mesh.receiveShadow=true;
  const positions=geometries[kindof].attributes.position;let trueRadius=0,height=0;
  for(let i=0;i<positions.count;i++){trueRadius=Math.max(trueRadius,Math.hypot(positions.getX(i),positions.getZ(i)));height=Math.max(height,Math.abs(positions.getY(i)));}
  pts.forEach((p,i)=>{
   // A sampled circumference can miss a narrow hole wholly inside it.
   // Clamp radial spread against every exact boundary segment, preserving
   // all roots and heights, with a reserve for the shader's maximum breeze.
   // Clipped parts deliberately share a source id; keep the original index.
   const island=courtyardData.islands[p.islandIndex];let edgeDistance=Infinity;
   for(const ring of [island.outer,...island.holes||[]])for(let j=0;j<ring.length;j++)edgeDistance=Math.min(edgeDistance,segmentDistance(p.x,p.z,ring[j],ring[(j+1)%ring.length]));
   p.radialSpread=Math.min(1,Math.max(.001,edgeDistance-.003)/(p.scale*(trueRadius+.08*height*height)));
   dummy.position.set(p.x,p.rootY,p.z);dummy.rotation.set(0,i*2.399963+kindof.length,0);dummy.scale.set(p.scale*p.radialSpread,p.scale,p.scale*p.radialSpread);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);plantMeshes.push(mesh);
 }
 const pathBuffers=(courtyardData.paths||[]).map(p=>({width:p.width,points:new T.CatmullRomCurve3(p.points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal').getPoints(70).map(p=>[p.x,p.z])}));
 const insideProtectedPath=(x,z)=>pathBuffers.some(p=>p.points.some((a,i)=>i>0&&segmentDistance(x,z,p.points[i-1],a)<p.width/2+.40));
 const protectedPassage=(x,z)=>segmentDistance(x,z,courtyardPassage.route[0],courtyardPassage.route.at(-1))<courtyardPassage.width/2+1.35;
 function clearArtPoint(x,z){
  if(!world.free(x,z)||!insideRing(x,z,courtyardData.boundary)||protectedPassage(x,z)||forecourtRoadsideReserved(x,z,.5)||insideProtectedPath(x,z))return false;
  if(courtyardData.islands.some(p=>solidContains(x,z,p))||(courtyardData.latticeContours||[]).some(r=>insideRing(x,z,r)))return false;
  if((courtyardData.zones||[]).some(p=>((x-p.x)/(p.rx+.7))**2+((z-p.z)/(p.rz+.7))**2<1))return false;
  if(entrances.some(p=>Math.hypot(x-p.point[0],z-p.point[1])<3.1))return false;return true;
 }
 const artSeed=[-18,-25],candidates=[artSeed];
 for(const distance of [.6,1.2,1.8,2.4,3])for(let i=0;i<16;i++)candidates.push([artSeed[0]+Math.cos(i/16*TAU)*distance,artSeed[1]+Math.sin(i/16*TAU)*distance]);
 let artPlacement=null;
 for(const [x,z]of candidates){
  if(!Array.from({length:20},(_,i)=>i/20*TAU).every(a=>clearArtPoint(x+Math.cos(a)*1.02,z+Math.sin(a)*1.02)))continue;
  const approaches=[[x,z+1.7],[x-1.7,z],[x+1.7,z],[x,z-1.7]].filter(p=>clearArtPoint(...p)&&Array.from({length:8},(_,i)=>i/8*TAU).every(a=>world.free(p[0]+Math.cos(a)*.35,p[1]+Math.sin(a)*.35)));
  if(!approaches.length)continue;artPlacement={point:[x,z],approach:approaches[0],rootY:frontageGroundHeight(x,z),searchOffset:Math.hypot(x-artSeed[0],z-artSeed[1])};break;
 }
 let petals=null,petalLights=null;
 if(artPlacement){
  const [x,z]=artPlacement.point,base=new T.Mesh(new T.CylinderGeometry(.66,.70,.115,32),m.mineral);base.position.set(x,artPlacement.rootY+.0575,z);base.castShadow=base.receiveShadow=true;base.name='Removable mineral base · no water or excavated fountain';group.add(base);
  const baseRing=new T.Mesh(new T.TorusGeometry(.575,.009,4,64),m.warm);baseRing.rotation.x=Math.PI/2;baseRing.position.set(x,artPlacement.rootY+.119,z);group.add(baseRing);
  const stem=new T.Mesh(new T.CylinderGeometry(.075,.13,.82,12),m.bronze);stem.position.set(x,artPlacement.rootY+.49,z);stem.castShadow=true;group.add(stem);
  const shape=new T.CatmullRomCurve3([new T.Vector3(.07,.19,0),new T.Vector3(.21,.75,0),new T.Vector3(.49,1.14,0),new T.Vector3(.70,1.39,0),new T.Vector3(.56,1.58,0)]),lightCurve=new T.CatmullRomCurve3([new T.Vector3(.22,.76,0),new T.Vector3(.49,1.14,0),new T.Vector3(.70,1.39,0),new T.Vector3(.56,1.58,0)]);
  petals=new T.InstancedMesh(new T.TubeGeometry(shape,26,.035,5,false),m.bronze,9);petals.name='Kinetic garden flower · nine batched bronze petals';petals.castShadow=petals.receiveShadow=true;group.add(petals);
  petalLights=new T.InstancedMesh(new T.TubeGeometry(lightCurve,20,.014,4,false),m.light,9);petalLights.name='Nine restrained fibre-light garden petals';group.add(petalLights);
  obstacles.push({type:'circle',x,z,radius:.76,enabled:true,source:'cyber-garden-v35'});
  interactions.push({id:cyberGardenConcept.artId,type:'garden-art',label:cyberGardenConcept.artLabel,point:artPlacement.approach,objectPoint:artPlacement.point,radius:2.4,lookAt:artPlacement.point,authoredConcept:true,modes:cyberGardenConcept.modes,sourceArea:'courtyard',layer:'garden'});
 }else skipped.push({id:cyberGardenConcept.artId,reason:'No safe art base and standing approach within the bounded seed search'});
 const restaurant=createRestaurantTerrace(root,{officeTerrace});
 if(restaurant)interactions.push(...restaurant.interactions);
 const authored=bakeSceneAuthorship(group,{label:'cyber-garden-v35'});
 let mode='calm',intensity=.7,visible=true;
 const metadata={...cyberGardenConcept,plantedFormations:formations,plantCount:Object.values(plants).reduce((n,p)=>n+p.length,0),plantsByType:Object.fromEntries(Object.entries(plants).map(([k,p])=>[k,p.length])),exactPerimeterGuard:true,maximumShaderWindReserve:.08,clampedClumps:Object.values(plants).flat().filter(p=>p.radialSpread<1).length,referenceIslandsByteEquivalent:JSON.stringify(courtyardData.islands)===sourceSnapshot,artPlacement,artHeight:artPlacement?1.58:null,skipped,meshCount:group.children.filter(o=>o.isMesh).length,restaurant:restaurant?.metadata||null};group.userData.concept=metadata;
 const destination=artPlacement?{name:'Дыхание сада',point:artPlacement.approach,look:artPlacement.point,authoredConcept:true,sourceArea:'courtyard'}:null;
 function setMode(value){mode=cyberGardenConcept.modes.includes(value)?value:'calm';m.light.emissive.set(mode==='social'?0xd1aa63:mode==='pulse'?0x649fbf:0x76babe);}
 function update(seconds,{night=0,wind=1,season=null}={}){
  if(!visible)return;
  const t=Number.isFinite(+seconds)?+seconds:0,n=T.MathUtils.clamp(+night||0,0,1),breeze=T.MathUtils.clamp(Number.isFinite(+wind)?+wind:1,0,2);
  for(const uof of windUniforms){uof.uGardenTime.value=t;uof.uGardenBreeze.value=breeze;}
  const pulse=mode==='pulse'?.55+.45*(.5+.5*Math.sin(t*1.7)):mode==='social'?.92+.08*Math.sin(t*.8):.86+.14*Math.sin(t*.42);
  m.light.emissiveIntensity=(.10+n*.93)*intensity*pulse;m.warm.emissiveIntensity=(.025+n*.67)*intensity;
  if(petals&&petalLights){const spread=mode==='social'?.11:mode==='pulse'?.065+.035*Math.sin(t*1.7):.025+.015*Math.sin(t*.42);for(let i=0;i<9;i++){dummy.position.set(artPlacement.point[0],artPlacement.rootY+.08,artPlacement.point[1]);dummy.rotation.set(0,i/9*TAU,spread*Math.sin(i/9*TAU+t*.19));dummy.scale.setScalar(1);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);petalLights.setMatrixAt(i,dummy.matrix);}petals.instanceMatrix.needsUpdate=petalLights.instanceMatrix.needsUpdate=true;}
  if(season){const winter=season==='winter';m.grass.color.set(winter?0xb7b8a4:season==='autumn'?0xaba47b:0x8b9571);m.understory.color.set(winter?0x92998b:0x687b59);}
  restaurant?.update(t,{night:n});
 }
 update(0);
 return{group,obstacles,colliders:obstacles,interactions,metadata,destination,restaurant,
  setMode,setIntensity(value){intensity=T.MathUtils.clamp(Number.isFinite(+value)?+value:.7,0,1);},
  setShade(value){restaurant?.setShade(value);},
  setVisible(value){visible=!!value;group.visible=visible;for(const o of obstacles)o.enabled=visible;restaurant?.setVisible(visible);},
  update,get visible(){return visible;},get mode(){return mode;},get intensity(){return intensity;},get state(){return{mode,intensity,shade:restaurant?.shade??.55};},
  dispose(){root.remove(group);restaurant?.dispose();const geometries=new Set(),maps=new Set(authored.textures);group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());disposeOwnedMaterials(m);maps.forEach(p=>p.dispose());for(const o of obstacles)o.enabled=false;}
 };
}
