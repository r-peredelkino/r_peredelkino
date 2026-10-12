const fs=require('node:fs'),puppeteer=require('/Users/n1estate/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
(async()=>{const base=process.env.RP_QA_URL||'http://127.0.0.1:8095',out=process.env.RP_QA_OUT||'/tmp/rodina-qa-v35';fs.mkdirSync(out,{recursive:true});const browser=await puppeteer.launch({headless:true,executablePath:'/tmp/rodina-reference-qa-v26/chrome-arm64',userDataDir:out+'/geometry-browser',args:['--no-sandbox','--disable-background-networking','--disable-component-update']});const page=await browser.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.setRequestInterception(true);page.on('request',r=>r.url()===base+'/qa-courtyard.html'?r.respond({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'}):r.continue());
 await page.goto(base+'/qa-courtyard.html');
 const result=await page.evaluate(async()=>{
  const T=await import('./vendor/three.module.js'),{createComplex}=await import('./complex-model.js?v=references35'),{createTourWorld,createTourDestinations}=await import('./walking-tour.js?v=references35'),{complexFootprints:f}=await import('./complex-footprints.js?v=references35'),{solidContains}=await import('./walk-physics.js?v=references35'),{attachCyberExperience}=await import('./cyber-experience.js?v=references35');
  const model=createComplex(),islandSnapshot=JSON.stringify(model.courtyard.data.islands),originalRoofObstacleRefs=model.officeTerrace.world.obstacles.slice();attachCyberExperience(model);const world=createTourWorld(model),checks=[];const add=(name,pass,data={})=>checks.push({name,pass,...data});
  // Arena position may change in v35; these unrelated source outlines must not.
  const baseline={buildings:'615b0c1b54edff01915aade5cbaf6185830166f673f8a96ef4fadf578d4959f2',fan:'1e0344e2ff0636f561b17b2b9c9fb27a0021b72dc82fd0dd0ab9d1df43d782e3',podium:'c68de1d59d8d12247c0c4fc40a09972d0849e6389740412bf48b52cc9e57dbfd'};
  for(const [field,expected]of Object.entries(baseline)){
   const bytes=new TextEncoder().encode(JSON.stringify(f[field]));
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   add('Unrelated source '+field+' outline remains exactly v34',hash===expected,{sha256:hash,expected});
  }
  const placement=model.arenaPlacement,arenaCentre=model.arenaCenter;
  add('Arena projects outward with a declared visual registration and no resize',placement?.version===35&&placement.rotation===0&&placement.scale===1&&Math.abs(Math.hypot(...placement.delta)-placement.distance)<1e-9&&placement.groundProjection.after>0&&Math.abs(placement.groundProjection.after-placement.groundProjection.before-placement.distance)<1e-9,{placement});
  const translated=model.arenaFootprint?.outer.every((point,index)=>point.every((value,axis)=>Math.abs(value-f.arena.outer[index][axis]-placement.delta[axis])<1e-8));
  add('Arena ground outline is translated from the exact original ring',translated&&model.arenaFootprint.outer.length===f.arena.outer.length,{points:model.arenaFootprint?.outer.length,centre:arenaCentre});
  const arenaObjects=[model.arenaExterior.arena,model.arenaExterior.upperCore,model.arenaExterior.shell,model.arenaExterior.arenaRoof,model.arenaExterior.group.getObjectByName('Rounded street-facing arena media screen')];
  const objectCentres=arenaObjects.map(o=>o?.getWorldPosition(new T.Vector3()).toArray());
  add('Arena glass, capsule, roof and media remain registered to one centre',objectCentres.every(point=>point&&Math.abs(point[0]-arenaCentre[0])<1e-8&&Math.abs(point[2]-arenaCentre[1])<1e-8)&&model.commercialFrontage.metadata.arenaUpperRelief.centre.every((value,axis)=>Math.abs(value-arenaCentre[axis])<1e-8),{objectCentres,centre:arenaCentre});
  add('Ground walking uses the newly registered arena footprint',world.solids.some(s=>s.outer===model.arenaFootprint.outer)&&!world.free(...arenaCentre),{centre:arenaCentre,blocked:!world.free(...arenaCentre)});
  const data=model.courtyard.data,p=model.passage.data,[start,,end]=p.route;
  const blocked=[];for(let i=0;i<=200;i++){const t=i/200,x=start[0]+(end[0]-start[0])*t,z=start[1]+(end[1]-start[1])*t;if(!world.free(x,z))blocked.push({t,x,z});}
  add('Passage 1–2 centreline is open',blocked.length===0,{blocked,route:p.route});
  const forward=world.move({x:start[0],z:start[1]},end[0]-start[0],end[1]-start[1]),back=world.move({x:end[0],z:end[1]},start[0]-end[0],start[1]-end[1]);add('Passage works in both directions',Math.hypot(forward.x-end[0],forward.z-end[1])<.001&&Math.hypot(back.x-start[0],back.z-start[1])<.001,{forward,back});
  const side=[p.centre[0]+p.tangent[0]*2.15-p.normal[0]*4,p.centre[1]+p.tangent[1]*2.15-p.normal[1]*4];add('Passage side wall remains solid',!world.free(...side),{side});
  model.root.updateMatrixWorld(true);const ray=new T.Raycaster();const rayAt=y=>{const a=new T.Vector3(start[0],y,start[1]),b=new T.Vector3(end[0],y,end[1]);ray.set(a,b.clone().sub(a).normalize());ray.near=.02;ray.far=a.distanceTo(b);return ray.intersectObject(model.root,true).filter(h=>h.object.isMesh&&!h.object.material?.transparent).map(h=>({name:h.object.name,parent:h.object.parent.name,distance:h.distance,point:h.point.toArray()}));};
  const eyeHits=rayAt(1.68),headerHits=rayAt(3.4);add('Rendered passage is clear at eye level',eyeHits.length===0,{eyeHits});add('Occupied volume above passage retained',headerHits.length>0,{headerHits:headerHits.slice(0,4)});
  add('Tree anchors remain in planted soil',data.trees.every(([x,z])=>data.islands.some(i=>solidContains(x,z,i))),{trees:data.trees.length});
  add('Shrubs do not occupy paths or buildings',data.shrubs.every(([x,z])=>data.islands.some(i=>solidContains(x,z,i))),{shrubs:data.shrubs.length});
  add('Source-view zone registration',data.zones.find(z=>z.id==='play').x===25&&data.zones.find(z=>z.id==='play').z===25&&data.zones.find(z=>z.id==='lounge').rx>data.zones.find(z=>z.id==='lounge').rz,{zones:data.zones});
  add('No repeated freestanding tower entry canopies',!model.root.getObjectByName('Organic courtyard entry canopy'));
  const utility=model.neighborhood.backdrop.footprints.utility??Object.values(model.neighborhood.backdrop.footprints).find(s=>s.outer.some(([x,z])=>x>26&&x<54&&z>-7&&z<20));const centre=s=>s.outer.reduce((a,p)=>[a[0]+p[0]/s.outer.length,a[1]+p[1]/s.outer.length],[0,0]);if(utility){const c=centre(utility);add('Existing utility building blocks ground walking',!world.free(...c),{centre:c});}else add('Utility footprint available',false);
  const office=model.officeTerrace,d=office.destination;add('Office terrace spawn is free and elevated',!!d&&office.world.free(...d.point)&&d.elevation>6.6,{destination:d?{point:d.point,elevation:d.elevation}:null,tableCount:office.metadata.tables.length,plantCount:office.metadata.plantCount});
  add('HVAC excluded from office occupied terrace',model.exteriorRoofs.equipmentClusters.every(c=>!c.footprint?.some(([x,z])=>office.world.boundaries.some(s=>solidContains(x,z,s)))),{clusters:model.exteriorRoofs.equipmentClusters.length});
  const garden=model.cyberGarden,restaurant=garden?.restaurant,gm=garden?.metadata;
  add('Garden proposal retains every original planted-island boundary',!!gm&&gm.referenceIslandsByteEquivalent&&JSON.stringify(data.islands)===islandSnapshot,{unchanged:gm?.referenceIslandsByteEquivalent,islands:data.islands.length});
  const plantingBad=[];
  for(const formation of gm?.plantedFormations??[]){
   const island=data.islands[formation.islandIndex];
   for(const point of formation.points)if(!island||!solidContains(...point,island)||Array.from({length:12},(_,i)=>i/12*Math.PI*2).some(a=>!solidContains(point[0]+Math.cos(a)*formation.footprintRadius,point[1]+Math.sin(a)*formation.footprintRadius,island)))plantingBad.push({id:formation.islandId,type:formation.type,point});
  }
  const formationCount=gm?.plantedFormations.reduce((sum,p)=>sum+p.points.length,0);
  add('All four planting palettes and their complete envelopes fit the original islands',gm?.plantCount===457&&formationCount===gm.plantCount&&['grass','understory','lavender','pale'].every(k=>gm.plantsByType[k]>0)&&plantingBad.length===0,{plants:gm?.plantCount,types:gm?.plantsByType,formationCount,bad:plantingBad});
  // Inspect final instanced vertices as well as nominal author envelopes.
  // Rooting in soil must survive actual scale, rotation and baked attribution.
  let plantingVertices=0,plantingVertexBad=0;const matrix=new T.Matrix4(),vertex=new T.Vector3();
  for(const kind of ['grass','understory','lavender','pale']){
   const mesh=garden.group.getObjectByName('Authored layered planting · '+kind),formations=gm.plantedFormations.filter(f=>f.type===kind);
   const islands=formations.flatMap(formation=>Array.from({length:formation.points.length},()=>data.islands[formation.islandIndex]));
   for(let instance=0;instance<mesh.count;instance++){
    mesh.getMatrixAt(instance,matrix);const position=mesh.geometry.attributes.position;
    for(let j=0;j<position.count;j++){vertex.fromBufferAttribute(position,j).applyMatrix4(matrix);plantingVertices++;if(!solidContains(vertex.x,vertex.z,islands[instance]))plantingVertexBad++;}
   }
  }
  add('Actual planted mesh vertices remain rooted inside their own source island',plantingVertices>0&&plantingVertexBad===0,{vertices:plantingVertices,badVertices:plantingVertexBad});
  const art=garden.interactions.find(i=>i.type==='garden-art'),artCollider=garden.obstacles.find(o=>o.source==='cyber-garden-v35');
  add('Garden art has a safe free approach and a colliding removable base',gm.skipped.length===0&&art&&world.free(...art.point)&&artCollider&&world.obstacles.includes(artCollider)&&!world.free(artCollider.x,artCollider.z)&&gm.artHeight<=1.7,{placement:gm.artPlacement,skipped:gm.skipped,height:gm.artHeight});
  const rm=restaurant?.metadata;
  add('Restaurant preserves the existing five tables, fifteen seats and three umbrellas',rm?.originalTableCount===5&&rm.originalChairCount===15&&rm.originalUmbrellaCount===3&&rm.sourceArchitecturalFootprintsUnchanged&&originalRoofObstacleRefs.every(o=>office.world.obstacles.includes(o)),{tables:rm?.originalTableCount,chairs:rm?.originalChairCount,umbrellas:rm?.originalUmbrellaCount,originalColliders:originalRoofObstacleRefs.length});
  const canopy=restaurant.group.getObjectByName('Authorial motorised restaurant shade · twenty batched louvers');
  const roofContains=point=>office.world.boundaries.some(s=>solidContains(...point,s));
  const canopyCorners=rm.shade?Array.from({length:13},(_,i)=>i/12).flatMap(t=>[
   [rm.shade.center[0]-1.58+3.16*t,rm.shade.center[1]-1.58],[rm.shade.center[0]-1.58+3.16*t,rm.shade.center[1]+1.58],
   [rm.shade.center[0]-1.58,rm.shade.center[1]-1.58+3.16*t],[rm.shade.center[0]+1.58,rm.shade.center[1]-1.58+3.16*t]
  ]):[];
  add('New twenty-louver canopy remains wholly within the original occupied roof',!!rm.shade&&canopy?.count===20&&rm.shade.postPoints.length===4&&canopyCorners.length>0&&canopyCorners.every(roofContains)&&rm.shade.postPoints.every(roofContains)&&restaurant.obstacles.every(o=>office.world.obstacles.includes(o)&&o.enabled!==false)&&rm.skipped.length===0,{shade:rm.shade,colliders:restaurant.obstacles.length,skipped:rm.skipped});
  const roofPlantBad=rm.plants.filter(p=>![0,.25,.5,.75].every(a=>office.beds.some(b=>solidContains(p.x+Math.cos(a*Math.PI*2)*.22,p.z+Math.sin(a*Math.PI*2)*.22,b))));
  add('Additional restaurant perennials fit the unchanged original rooftop beds',rm.plants.length===57&&roofPlantBad.length===0,{plants:rm.plants.length,bad:roofPlantBad});
  const roofInteractions=restaurant.interactions;
  add('Both restaurant approaches use the real elevated office walking world',roofInteractions.length===2&&roofInteractions.every(i=>i.world===office.world&&Math.abs(i.elevation-office.metadata.level)<1e-9&&i.world.free(...i.point)),{interactions:roofInteractions.map(i=>({id:i.id,type:i.type,point:i.point,elevation:i.elevation}))});
  const destinations=createTourDestinations(model);add('All tour destinations have a safe spawn',destinations.every(d=>!!(d.world??world).nearest(d.point)),{places:destinations.map(d=>d.name)});
  let finite=true,missing=[],geometries=new Set(),normals=0;model.root.traverse(o=>{if(!o.isMesh)return;if(!o.geometry.attributes.rpAuthor)missing.push(o.name);const g=o.geometry;if(geometries.has(g))return;geometries.add(g);for(const key of ['position','normal'])if(g.attributes[key])for(const v of g.attributes[key].array)if(!Number.isFinite(v))finite=false;normals+=g.attributes.normal?.count??0;});add('Finite geometry and surface normals',finite,{geometries:geometries.size,normals});add('Authorship on newly added model meshes',missing.length===0,{missing});
  add('Fan keeps five architectural openings',f.fan.holes.length===5&&model.bridge.geometry.attributes.position.count>0,{openings:f.fan.holes.length});
  const expectedChecks=31;model.dispose();return{expectedChecks,pass:checks.length===expectedChecks&&checks.every(c=>c.pass),checks};
 });result.errors=errors;fs.writeFileSync(out+'/geometry.json',JSON.stringify(result,null,2));for(const c of result.checks)console.log(JSON.stringify(c));if(!result.pass||errors.length)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
