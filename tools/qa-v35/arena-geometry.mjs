// @r_peredelkino · RP-CONCEPT-2026-10-07 · v35 coordinated arena acceptance.
// node tools/qa-v35/arena-geometry.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const baseline=process.env.RP_V34_BASELINE_DIR||path.join(path.dirname(root.replace(/\/$/,'')),'rodina-v34');
const url=(name,dir=root)=>pathToFileURL(path.join(dir,'dist',name)).href;
const T=await import(url('vendor/three.module.js'));
const {complexFootprints:f}=await import(url('complex-footprints.js'));
const {arenaPlacement:p,arenaCenter:centre,arenaGroundRadius:r,arenaFootprint}=await import(url('arena-placement-v35.js'));
const {arenaShoulderProfile,arenaShoulderRadiusAt}=await import(url('arena-shell-profile.js'));
const {createUpperPodiumGeometry,createUpperPodiumSurfaceGeometry,createGroundArenaUnionGeometry}=await import(url('podium-upper-cut.js'));
const {solidContains,createWalkWorld}=await import(url('walk-physics.js'));
const checks=[],add=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const baselineF=(await import(url('complex-footprints.js',baseline))).complexFootprints;
for(const key of ['buildings','podium','terrace','fan','arena','arenaCenter']){
 const serialized=JSON.stringify(f[key]);add('Source '+key+' is exactly v34',serialized===JSON.stringify(baselineF[key]),{sha256:createHash('sha256').update(serialized).digest('hex')});
}
add('Placement is an outward translation with no scale or rotation',p.scale===1&&p.rotation===0&&Math.abs(Math.hypot(...p.delta)-8.4)<1e-10&&p.outward[0]<-.99&&Math.abs(p.outward[1])<.06,
 {centre,delta:p.delta,outward:p.outward,groundProjection:p.groundProjection,dimensionStatus:p.sourceMapping.magnitudeStatus});
let contourError=0;for(let i=0;i<f.arena.outer.length;i++)for(let j=0;j<2;j++)contourError=Math.max(contourError,Math.abs(arenaFootprint.outer[i][j]-f.arena.outer[i][j]-p.delta[j]));
add('The transformed walking contour is the same circle, translated',contourError<1e-12&&arenaFootprint.outer.length===f.arena.outer.length,{vertices:arenaFootprint.outer.length,contourError});
add('Arena projects beyond the source retail corner',p.groundProjection.before<0&&p.groundProjection.after>7.9&&p.groundProjection.after<8.0,{before:p.groundProjection.before,after:p.groundProjection.after});

const material=new T.MeshStandardMaterial({side:T.DoubleSide}),geometries=[];
for(const [bottom,top,plan] of [[3.94,6.04,f.podium],[6.04,6.60,f.podium],[6.56,6.64,f.terrace]]){
 const g=createUpperPodiumGeometry(plan,top-bottom,{bottom}),mesh=new T.Mesh(g,material);mesh.position.y=bottom;mesh.updateMatrixWorld(true);geometries.push(g);
 let samples=0,misses=0,maxGap=-Infinity;
 for(let k=0;k<=40;k++){
  const y=bottom+(top-bottom)*k/40,shell=arenaShoulderRadiusAt(r,y);maxGap=Math.max(maxGap,g.userData.arenaUpperRelief.cutRadius-shell);
  for(let i=0;i<192;i++){
   const a=(i+.5)/192*Math.PI*2,x=centre[0]+Math.cos(a)*(shell+.01),z=centre[1]+Math.sin(a)*(shell+.01);
   if(!solidContains(x,z,plan))continue;samples++;
   const hits=new T.Raycaster(new T.Vector3(x,top+.05,z),new T.Vector3(0,-1,0),0,top-bottom+.1).intersectObject(mesh,false);
   if(!hits.length||Math.abs(hits[0].point.y-top)>.002)misses++;
  }
 }
 add(`Shared shoulder contact throughout ${bottom}–${top}`,samples>100&&misses===0&&maxGap<=-.0239,{heights:41,angles:192,samples,misses,exposedGap:Math.max(0,maxGap),underlap:-maxGap});
}
const surface=createUpperPodiumSurfaceGeometry(f.terrace,{y:6.648});geometries.push(surface);
add('Upper slab, cornice and gravel share the new centre at their own elevations',geometries.every(g=>JSON.stringify(g.userData.arenaUpperRelief.centre)===JSON.stringify(centre))&&surface.userData.arenaUpperRelief.bottom===6.648);
const fascia=createGroundArenaUnionGeometry(f.podium,.78),fasciaMesh=new T.Mesh(fascia,material);fasciaMesh.position.y=3.16;fasciaMesh.updateMatrixWorld(true);geometries.push(fascia);
let outboard=0,fasciaMisses=0;for(let i=0;i<192;i++){
 const a=(i+.5)/192*Math.PI*2,x=centre[0]+Math.cos(a)*(r-.04),z=centre[1]+Math.sin(a)*(r-.04);if(solidContains(x,z,f.podium))continue;outboard++;
 const hits=new T.Raycaster(new T.Vector3(x,4.02,z),new T.Vector3(0,-1,0),0,.94).intersectObject(fasciaMesh,false);if(!hits.length||Math.abs(hits[0].point.y-3.94)>.002)fasciaMisses++;
}
add('A continuous unioned white fascia covers the projecting ground circle',outboard>60&&fasciaMisses===0,{outboardArcSamples:outboard,misses:fasciaMisses});

const {createComplex}=await import(url('complex-model.js')),{createComplex:createBefore}=await import(url('complex-model.js',baseline));
const model=createComplex(),before=createBefore();
const almost=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-8);
// RP13 embeds provenance in exactly the two lowest Float32 mantissa bits.
// Revision dates may change that payload; all higher bits must remain exact.
const sameCoordinates=(a,b)=>{
 if(a.length!==b.length)return false;
 const aw=new Uint32Array(a.buffer,a.byteOffset,a.length),bw=new Uint32Array(b.buffer,b.byteOffset,b.length);
 return aw.every((word,i)=>(word&0xfffffffc)===(bw[i]&0xfffffffc));
};
const positionDelta=(a,b)=>{let largest=0;for(let i=0;i<a.length;i++)largest=Math.max(largest,Math.abs(a[i]-b[i]));return largest;};
let arenaMeshes=[];for(const key of ['arena','upperCore','shell','arenaRoof']){
 const a=model.arenaExterior[key],b=before.arenaExterior[key];
 arenaMeshes.push({key,centre:almost([a.position.x,a.position.z],centre),sameGeometry:sameCoordinates(a.geometry.attributes.position.array,b.geometry.attributes.position.array),provenanceMantissaDelta:positionDelta(a.geometry.attributes.position.array,b.geometry.attributes.position.array),sameScale:almost(a.scale.toArray(),b.scale.toArray()),sameRotation:almost(a.quaternion.toArray(),b.quaternion.toArray())});
}
const screen=model.arenaMedia.mesh,oldScreen=before.arenaMedia.mesh;
arenaMeshes.push({key:'media',centre:almost([screen.position.x,screen.position.z],centre),sameGeometry:sameCoordinates(screen.geometry.attributes.position.array,oldScreen.geometry.attributes.position.array),provenanceMantissaDelta:positionDelta(screen.geometry.attributes.position.array,oldScreen.geometry.attributes.position.array),sameScale:almost(screen.scale.toArray(),oldScreen.scale.toArray()),sameRotation:almost(screen.quaternion.toArray(),oldScreen.quaternion.toArray())});
add('Cylinder, shoulder, crown and LED move together without changing their geometry',arenaMeshes.every(m=>m.centre&&m.sameGeometry&&m.sameScale&&m.sameRotation),{components:arenaMeshes});
let groundEnds=0,upperEnds=0,glassGap=0;
for(const pane of [...model.commercialFrontage.commercialPanes,...model.commercialFrontage.upperCommercialPanes]){
 const junction=pane.arenaGroundJunction??pane.arenaJunction;if(!junction?.trimmed)continue;
 for(const side of [-1,1]){
  const d=Math.hypot(pane.x+Math.cos(pane.angle)*side*pane.width/2-centre[0],pane.z-Math.sin(pane.angle)*side*pane.width/2-centre[1]);
  if(Math.abs(d-junction.cutRadius)>1e-5)continue;
  if(pane.storey===1){groundEnds++;glassGap=Math.max(glassGap,d-r);}else{upperEnds++;for(let i=0;i<=40;i++)glassGap=Math.max(glassGap,d-arenaShoulderRadiusAt(r,pane.bottom+(pane.top-pane.bottom)*i/40));}
 }
}
add('Both ground and upper glazing end against the same capsule without an exposed gap',groundEnds===2&&upperEnds===2&&glassGap===0,{groundEnds,upperEnds,largestGap:glassGap,partialUpperWidths:model.commercialFrontage.metadata.arenaAbutment.partialUpperBays.map(p=>p.width)});
const oldById=new Map(before.commercialFrontage.commercialPanes.map(p=>[p.id,p]));let remoteBays=0,remoteChanged=[];
for(const pane of model.commercialFrontage.commercialPanes){
 if(pane.arena||Math.hypot(pane.x-centre[0],pane.z-centre[1])<r+5||Math.hypot(pane.x-p.sourceCentre[0],pane.z-p.sourceCentre[1])<r+5)continue;
 remoteBays++;const old=oldById.get(pane.id);if(!old||['x','z','width','height','angle','nx','nz','officeLobby'].some(k=>pane[k]!==old[k]))remoteChanged.push(pane.id);
}
add('Ground shop geometry and IDs away from the arena remain v34',remoteBays>150&&remoteChanged.length===0,{remoteBays,changedIds:remoteChanged});
let fixedTowers=0;for(const [id,t] of model.towers){const old=before.towers.get(id);if(sameCoordinates(t.facade.geometry.attributes.position.array,old.facade.geometry.attributes.position.array)&&almost(t.facade.matrix.toArray(),old.facade.matrix.toArray()))fixedTowers++;}
add('All five residential facades, the office facade and the fan geometry remain v34',fixedTowers===6&&sameCoordinates(model.bridge.geometry.attributes.position.array,before.bridge.geometry.attributes.position.array),{fixedBuildings:fixedTowers,fanProvenanceMantissaDelta:positionDelta(model.bridge.geometry.attributes.position.array,before.bridge.geometry.attributes.position.array),excludedSignatureBits:2});
let poolError=0,matrix=new T.Matrix4();for(let i=0;i<12;i++){model.lighting.fields.arena.mesh.getMatrixAt(i,matrix);const a=i/12*Math.PI*2;poolError=Math.max(poolError,Math.hypot(matrix.elements[12]-(centre[0]+Math.cos(a)*22),matrix.elements[14]-(centre[1]+Math.sin(a)*22)));}
add('Twelve arena spill lights are centred on the translated capsule',poolError<1e-5,{largestFloat32PositionError:poolError});
const isolated=createWalkWorld({solids:[arenaFootprint]}),inside=[centre[0]+p.outward[0]*(r-.3),centre[1]+p.outward[1]*(r-.3)],outside=[centre[0]+p.outward[0]*(r+1),centre[1]+p.outward[1]*(r+1)];
add('Arena collision blocks its newly projecting front and allows its exterior',!isolated.free(...inside)&&isolated.free(...outside)&&!solidContains(...inside,f.arena),{newFrontInside:inside,exterior:outside});
const {createTourWorld}=await import(url('walking-tour.js')),{createExteriorInteractions}=await import(url('exterior-interactions.js'));
const world=createTourWorld(model),entrances=createExteriorInteractions(model,world),arenaEntry=entrances.find(i=>i.id==='arena-entry');
add('The complete walk world blocks the new arena and retains all eleven exterior entrances',!world.free(...inside)&&entrances.length===11&&entrances.every(i=>world.free(...i.point))&&!!arenaEntry,
 {entrances:entrances.map(i=>i.id),arenaEntry:arenaEntry?{point:arenaEntry.point,objectPoint:arenaEntry.objectPoint,approachDistance:arenaEntry.approachDistance}:null});
let invalid=0;for(const g of geometries)for(const name of ['position','normal','uv'])for(const v of g.attributes[name].array)if(!Number.isFinite(v))invalid++;
add('New union and relief geometry is finite',invalid===0,{invalid});
const result={revision:35,pass:checks.every(c=>c.pass),placement:p,checks};
const output=process.env.RP_QA_OUTPUT||(process.env.RP_QA_OUT?path.join(process.env.RP_QA_OUT,'architecture-geometry.json'):path.join(root,'tools','qa-v35','arena-geometry.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));for(const g of geometries)g.dispose();material.dispose();model.dispose();before.dispose();if(!result.pass)process.exitCode=1;
