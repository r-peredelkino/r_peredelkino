// @r_peredelkino · RP-CONCEPT-2026-10-07 · v34 architecture acceptance.
// Run: node tools/qa-v34/architecture-geometry.mjs
// RP_PROJECT_DIR and RP_V33_BASELINE_DIR optionally select actual installed paths.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const baseline=process.env.RP_V33_BASELINE_DIR||path.join(path.dirname(root.replace(/\/$/,'')),'rodina-v33');
const moduleUrl=name=>pathToFileURL(path.join(root,'dist',name)).href;
const T=await import(moduleUrl('vendor/three.module.js'));
const {complexFootprints:f}=await import(moduleUrl('complex-footprints.js'));
const {solidContains,segmentDistance}=await import(moduleUrl('walk-physics.js'));
const {arenaShoulderProfile,arenaShoulderRadiusAt}=await import(moduleUrl('arena-shell-profile.js'));
const {createUpperPodiumGeometry,createUpperPodiumSurfaceGeometry,clipUpperPaneToArena}=await import(moduleUrl('podium-upper-cut.js'));
const {createTracedFanSlabGeometry,createTracedFanEdgeGeometry}=await import(moduleUrl('roof-fan-edge-v34.js'));
const {createCommercialFrontage}=await import(moduleUrl('commercial-frontage.js'));
const {createAttributionTexture}=await import(moduleUrl('attribution.js'));
const checks=[],add=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const r=Math.hypot(f.arena.outer[0][0]-f.arenaCenter[0],f.arena.outer[0][1]-f.arenaCenter[1]);
const material=new T.MeshStandardMaterial({side:T.DoubleSide});
const intervals=[[3.94,6.04,f.podium],[6.04,6.60,f.podium],[6.56,6.64,f.terrace]];
const geometries=intervals.map(([bottom,top,plan])=>{const g=createUpperPodiumGeometry(plan,top-bottom,{bottom});const mesh=new T.Mesh(g,material);mesh.position.y=bottom;mesh.updateMatrixWorld(true);return{g,mesh,bottom,top,plan};});
for(const {g,mesh,bottom,top,plan} of geometries){
 let sampled=0,misses=0,largestGap=-Infinity;
 for(let k=0;k<=40;k++){
  const y=bottom+(top-bottom)*k/40,shell=arenaShoulderRadiusAt(r,y),gap=g.userData.arenaUpperRelief.cutRadius-shell;largestGap=Math.max(largestGap,gap);
  for(let i=0;i<192;i++){
   const a=(i+.5)/192*Math.PI*2,x=f.arenaCenter[0]+Math.cos(a)*(shell+.010),z=f.arenaCenter[1]+Math.sin(a)*(shell+.010);
   if(!solidContains(x,z,plan))continue;sampled++;
   const hit=new T.Raycaster(new T.Vector3(x,top+.05,z),new T.Vector3(0,-1,0),0,top-bottom+.1).intersectObject(mesh,false);
   if(!hit.length||Math.abs(hit[0].point.y-top)>.002)misses++;
  }
 }
 add(`Arena contact at every sampled height ${bottom}–${top}`,sampled>100&&misses===0&&largestGap<=-.0239,{heightSamples:41,angularSamples:192,sourceAbutmentSamples:sampled,misses,largestExposedGap:Math.max(0,largestGap),smallestConcealedUnderlap:-largestGap});
}
const roof=createUpperPodiumSurfaceGeometry(f.terrace,{y:6.648});
add('Gravel and slab use their own actual vertical datum',roof.userData.arenaUpperRelief.bottom===6.648&&geometries[2].g.userData.arenaUpperRelief.bottom===6.56,{roofCut:roof.userData.arenaUpperRelief.cutRadius,slabCut:geometries[2].g.userData.arenaUpperRelief.cutRadius});

const opts={towers:new Map(),whiteMaterial:material,privacyMaterial:new T.MeshStandardMaterial(),brandTexture:createAttributionTexture()};
const frontage=createCommercialFrontage(new T.Group(),opts),partial=frontage.upperCommercialPanes.filter(p=>p.arenaJunction?.trimmed);
let gap=0,contactEnds=0;
for(const p of partial){
 const c=Math.cos(p.angle),s=Math.sin(p.angle);
 for(const side of [-1,1]){
  const distance=Math.hypot(p.x+c*side*p.width/2-f.arenaCenter[0],p.z-s*side*p.width/2-f.arenaCenter[1]);
  if(Math.abs(distance-p.arenaJunction.cutRadius)>.00001)continue;contactEnds++;
  for(let i=0;i<=40;i++)gap=Math.max(gap,distance-arenaShoulderRadiusAt(r,p.bottom+(p.top-p.bottom)*i/40));
 }
}
add('Both upper shoulder bays remain and reach the capsule',partial.length===2&&contactEnds===2&&gap===0&&partial.every(p=>p.width>.6),{upperBays:frontage.upperCommercialPanes.length,partialBays:partial.map(p=>({width:p.width,sourceWidth:p.arenaJunction.sourceWidth})),contactEnds,largestExposedGap:gap});
const near=f.arenaCenter,synthetic={id:0,x:near[0]-19.0,z:near[1],angle:-Math.PI/2,width:12,bottom:3.94,top:6.04};
const pieces=clipUpperPaneToArena(synthetic);
add('A crossed bay preserves both visible ends instead of deleting the whole bay',pieces.length===2&&pieces.every(p=>p.width>.1),{sourceWidth:synthetic.width,visibleWidths:pieces.map(p=>p.width)});

const fan=createTracedFanSlabGeometry(f.fan,2.25),fanMesh=new T.Mesh(fan,material);fanMesh.position.y=92.95;fanMesh.updateMatrixWorld(true);let fanHits=0;
for(let i=0;i<=100;i++)for(const offset of [-.65,0,.65]){
 const x=20+i/100*15,z=49.7+i/100*.9+offset;
 const hits=new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0),0,10).intersectObject(fanMesh,false);if(hits.length&&Math.abs(hits[0].point.y-95.2)<.002)fanHits++;
}
add('The unchanged fan is solid throughout the 4–5 connection',fanHits===303&&f.fan.holes.length===5,{raySamples:303,hits:fanHits,retainedArchitecturalOpenings:f.fan.holes.length,removedZeroAreaTriangles:fan.userData.tracedFanSlab.removedZeroAreaTriangles});
const edge=createTracedFanEdgeGeometry(f.fan.outer,95.17,.045),p=edge.attributes.position;let deviation=0;
for(let i=0;i<edge.userData.tracedFanEdge.retainedPoints;i++){
 const x=(p.getX(i*7)+p.getX(i*7+3))*.5,z=(p.getZ(i*7)+p.getZ(i*7+3))*.5;let d=Infinity;
 // Opposite radial samples cancel precisely; the remaining Float32 error is
 // bounded against the actual segments, including the short 4–5 junction.
 for(let j=1;j<f.fan.outer.length;j++)d=Math.min(d,segmentDistance(x,z,f.fan.outer[j-1],f.fan.outer[j]));deviation=Math.max(deviation,d);
}
add('Fan trim follows source edges with no Catmull overshoot',deviation<.00002&&edge.userData.tracedFanEdge.closed,{maximumCentrelineDeviation:deviation,segments:edge.userData.tracedFanEdge.segments});
let invalid=0,shortNormals=0;
for(const g of [...geometries.map(x=>x.g),roof,fan,edge]){for(const name of ['position','normal','uv'])for(const x of g.attributes[name].array)if(!Number.isFinite(x))invalid++;for(let i=0;i<g.attributes.normal.count;i++)if(Math.hypot(g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i))<.9)shortNormals++;}
add('New architectural geometries have finite arrays and valid normals',invalid===0&&shortNormals===0,{invalid,shortNormals});

const oldProfile=radius=>{const controls=[[0,3.56],[.16,3.68],[.52,3.96],[.76,4.34],[.88,4.80],[.91,5.38],[.85,5.99],[.70,6.48],[.46,6.87],[.22,7.17],[.15,7.40]];return new T.CatmullRomCurve3(controls.map(([v,y])=>new T.Vector3(radius+v,y,0)),false,'centripetal').getPoints(128).map(p=>[p.x,p.y]);};
add('The arena shell profile is numerically identical to v33',JSON.stringify(oldProfile(r))===JSON.stringify(arenaShoulderProfile(r).map(p=>p.toArray())));
for(const name of ['complex-footprints.js','public-realm-layout.js']){
 const a=fs.readFileSync(path.join(root,'dist',name)),b=fs.readFileSync(path.join(baseline,'dist',name));add(`Source ${name} remains byte-identical`,a.equals(b),{sha256:createHash('sha256').update(a).digest('hex')});
}
const {createCommercialFrontage:before}=await import(pathToFileURL(path.join(baseline,'dist','commercial-frontage.js')).href),old=before(new T.Group(),opts);
add('Ground retail panes and existing exterior doors stay unchanged',JSON.stringify(old.commercialPanes)===JSON.stringify(frontage.commercialPanes)&&JSON.stringify(old.doors)===JSON.stringify(frontage.doors),{groundBays:frontage.commercialPanes.length,existingDoors:frontage.doors.length,upperBefore:old.upperCommercialPanes.length,upperAfter:frontage.upperCommercialPanes.length});
const result={revision:34,pass:checks.every(c=>c.pass),checks};
const output=process.env.RP_QA_OUTPUT||path.join(root,'tools','qa-v34','architecture-geometry.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;
