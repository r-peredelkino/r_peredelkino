// Ground circulation regression: actual source solids, props, roads and passage.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url));
const moduleURL=name=>pathToFileURL(path.join(project,'dist',name)).href;
const {createComplex}=await import(moduleURL('complex-model.js'));
const {attachCyberExperience}=await import(moduleURL('cyber-experience.js'));
const {createPedestrianNavigation,createGroundWalkWorld,walkSegmentFree}=await import(moduleURL('pedestrian-navigation-v38.js'));
const {createTourWorld}=await import(moduleURL('walking-tour.js'));
const {createWalkWorld,solidContains,segmentDistance}=await import(moduleURL('walk-physics.js'));
const checks=[],check=(name,pass,details={})=>{checks.push({name,pass:!!pass,details});if(!pass)throw new Error(name+' '+JSON.stringify(details));};
const started=performance.now(),model=createComplex();attachCyberExperience(model);
const before=JSON.stringify({towers:Array.from(model.towers.values()).map(t=>({spec:t.spec,shape:t.shape.getPoints(32),windowMatrices:Array.from(t.windows.instanceMatrix.array)})),islands:model.courtyard.data.islands,publicIslands:model.publicRealm.data.islands});
const planningStart=performance.now(),nav=createPedestrianNavigation(model),initialPlanningMs=performance.now()-planningStart;
model.pedestrianNavigation=nav;
check('Visitor and resident navigation share the same physical ground world',createTourWorld(model)===nav.world&&nav.world.radius===.36);
const routeReports=[];
for(const radius of [.48,.65,.95]){
 const t=performance.now(),routes=nav.routesForRadius(radius),actualWorld=nav.worldForRadius(radius);let samples=0,collisions=0,movementBlocked=0;
 for(const route of routes){
  check('Polyline '+route.id+' is navigable at radius '+radius,route.length>6&&route.interpolation==='polyline'&&route.drawSurface===false&&nav.validateRoute(route,{radius}));
  const n=Math.ceil(route.length/.1);
  let previous=null;
  for(let i=0;i<=n;i++){
   const p=nav.sampleRoute(route,i/n);samples++;if(!actualWorld.free(p.x,p.z)||!Number.isFinite(p.dx+p.dz+p.y))collisions++;
   if(previous){const moved=actualWorld.move(previous,p.x-previous.x,p.z-previous.z);if(Math.hypot(moved.x-p.x,moved.z-p.z)>.000001)movementBlocked++}
   previous=p;
  }
 }
 check('All actual route samples and movement segments clear source props at radius '+radius,routes.length>=4&&collisions===0&&movementBlocked===0,{routes:routes.length,samples,collisions,movementBlocked});
 routeReports.push({radius,planningAndValidationMs:performance.now()-t,samples,routes:routes.map(r=>({id:r.id,length:r.length,vertices:r.points.length}))});
}
const passage=model.passage.data,[start,,end]=passage.route;
check('K1–K2 centreline remains fully open in both directions',walkSegmentFree(nav.world,start,end)&&walkSegmentFree(nav.world,end,start));
for(const [a,b] of [[start,end],[end,start]]){const p=nav.world.move({x:a[0],z:a[1]},b[0]-a[0],b[1]-a[1]);check('K1–K2 continuous movement reaches its destination',Math.hypot(p.x-b[0],p.z-b[1])<.000001,{position:p});}
const side=[passage.centre[0]+passage.tangent[0]*2.15-passage.normal[0]*4,passage.centre[1]+passage.tangent[1]*2.15-passage.normal[1]*4];
check('K1–K2 adjacent wall remains solid',!nav.world.free(...side));
let roadSamples=0,roadFree=[];
for(const lane of model.traffic.lanes)for(const p of lane.pointsWorld){roadSamples++;if(nav.world.free(p[0],p[2]))roadFree.push({id:lane.id,point:p});}
check('Active traffic centreline samples remain outside ground walk space',roadSamples>3000&&roadFree.length===0,{roadSamples,free:roadFree.slice(0,8)});
const plants=[...model.courtyard.data.shrubs,...model.publicRealm.data.shrubs],unblockedPlants=plants.filter(([x,z])=>nav.world.free(x,z));
check('Courtyard and promenade shrub roots cannot be walked through',plants.length>1000&&unblockedPlants.length===0,{plants:plants.length,unblocked:unblockedPlants.slice(0,8)});
check('Bench approaches are navigable and source seats retain their real height',nav.benches.length===3&&nav.benches.every(b=>nav.worldForRadius(.48).free(...b.approach)&&b.height>.45&&b.height<.5),{benches:nav.benches});
const at=nav.routes[0],one=nav.planPath(at.points[0],at.points.at(-1)),statsBefore=nav.stats;
const two=nav.planPath(at.points[0],at.points.at(-1));
check('Repeated path requests reuse a bounded planning cache',one&&two&&JSON.stringify(one)===JSON.stringify(two)&&nav.stats.cacheHits===statsBefore.cacheHits+1&&nav.stats.cachedPaths<=257);

// The broad-phase may reject candidates cheaply, but must never drop an exact
// collision. Compare its result with a simple exhaustive geometric oracle.
const circles=Array.from({length:1800},(_,i)=>({type:'circle',x:(i%45)*2.1-47,z:Math.floor(i/45)*2.1-42,radius:.12+(i%3)*.05}));
const obstacles=[...circles,{type:'box',x:1,z:1,width:5,depth:.2,angle:.71},{type:'segment',a:[-7,-3],b:[9,5],radius:.02}];
const fixture=createWalkWorld({obstacles,radius:.48});
const exhaustive=(x,z)=>!obstacles.some(o=>{
 if(o.enabled===false)return false;
 if(o.type==='circle')return Math.hypot(x-o.x,z-o.z)<.48+o.radius;
 if(o.type==='segment')return segmentDistance(x,z,o.a,o.b)<.48+o.radius;
 const c=Math.cos(o.angle),s=Math.sin(o.angle),dx=x-o.x,dz=z-o.z,u=c*dx-s*dz,v=s*dx+c*dz;
 return Math.hypot(Math.max(Math.abs(u)-o.width/2,0),Math.max(Math.abs(v)-o.depth/2,0))<.48;
});
let broadPhaseMismatches=0;fixture.resetStats();const lookupStart=performance.now();
for(let i=0;i<6000;i++){const x=-50+(i*7.918273)%100,z=-46+(i*3.782397)%92;if(fixture.free(x,z)!==exhaustive(x,z))broadPhaseMismatches++;}
const lookupMs=performance.now()-lookupStart;
check('Spatial broad-phase matches exhaustive collisions with 1802 props',broadPhaseMismatches===0,{samples:6000,mismatches:broadPhaseMismatches,stats:fixture.stats,lookupMs});
check('Spatial broad-phase keeps prop tests local',fixture.stats.obstacleTests<6000*80,{obstacleTests:fixture.stats.obstacleTests,exhaustiveWorstCase:6000*obstacles.length});
const dynamicallyAdded={type:'circle',x:110,z:110,radius:2};obstacles.push(dynamicallyAdded);
check('Appending a collider updates the spatial broad-phase',!fixture.free(110,110));dynamicallyAdded.enabled=false;
check('Toggling an existing collider remains live',fixture.free(110,110));
const wall=createWalkWorld({obstacles:[{type:'segment',a:[0,-5],b:[0,5],radius:.01}],radius:.36});
const moved=wall.move({x:-2,z:0},8,0);check('Sprint-sized movement cannot tunnel through a thin wall',moved.blocked&&moved.x<-.36,{moved});
const point=nav.sampleRoute(nav.routes[2],.4),oldWorld=nav.world;
model.publicRealm.colliders.push({type:'circle',x:point.x,z:point.z,radius:1});
check('A newly appended scene prop invalidates navigation caches',nav.refresh()&&nav.world!==oldWorld&&!nav.world.free(point.x,point.z)&&nav.stats.cachedCells===0);
model.publicRealm.colliders.pop();nav.refresh();
check('Navigation never changes towers, facade panes or source planted islands',JSON.stringify({towers:Array.from(model.towers.values()).map(t=>({spec:t.spec,shape:t.shape.getPoints(32),windowMatrices:Array.from(t.windows.instanceMatrix.array)})),islands:model.courtyard.data.islands,publicIslands:model.publicRealm.data.islands})===before);
nav.dispose();model.dispose();
const result={revision:38,pass:checks.every(c=>c.pass),checkCount:checks.length,initialPlanningMs,totalMs:performance.now()-started,routeReports,checks};
const output=process.env.RP_QA_OUT;if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'navigation-cpu.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
