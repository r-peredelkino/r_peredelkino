import assert from 'node:assert/strict';
import * as THREE from '../../dist/vendor/three.module.js';
import {createWalkWorld,solidContains} from '../../dist/walk-physics.js';
import {createComplex} from '../../dist/complex-model.js';
import {createTourWorld,createTourDestinations} from '../../dist/walking-tour.js';
import {tourSurfaceElevation} from '../../dist/play-bridge-walk.js';
import {readPixelSignature} from '../../dist/baked-authorship.js';
const ring=(x,z,w,h)=>[[x,z],[x+w,z],[x+w,z+h],[x,z+h],[x,z]];
const world=createWalkWorld({boundary:ring(-20,-20,40,40),solids:[{outer:ring(-1,-10,2,20),holes:[]}],obstacles:[{type:'segment',a:[-12,-5],b:[-12,5],radius:.02}]});
const crossed=world.move({x:-5,z:0},12,0);assert.ok(crossed.blocked&&crossed.x<=-1.35&&world.free(crossed.x,crossed.z));
const slide=world.move({x:-1.5,z:0},2,4);assert.ok(slide.blocked&&slide.z>3.9&&world.free(slide.x,slide.z));
const fence=world.move({x:-15,z:0},6,0);assert.ok(fence.blocked&&fence.x< -12.35);
const boundary=world.move({x:10,z:14},0,30);assert.ok(boundary.blocked&&boundary.z<19.65&&world.free(boundary.x,boundary.z));
const hole=createWalkWorld({solids:[{outer:ring(-10,-10,20,20),holes:[ring(-4,-4,8,8)]}]});assert.ok(hole.free(0,0));assert.ok(!hole.free(7,0));assert.ok(!hole.free(3.8,0));const exitHole=hole.move({x:0,z:0},20,0);assert.ok(exitHole.blocked&&exitHole.x<3.65);
const furniture=createWalkWorld({obstacles:[{type:'circle',x:0,z:0,radius:.5},{type:'box',x:6,z:0,width:3,depth:.5,angle:Math.PI/4}]});assert.ok(!furniture.free(0,0));assert.ok(furniture.free(1,0));assert.ok(!furniture.free(6,0));assert.equal(furniture.nearest([0,0],0),null);assert.ok(furniture.nearest([0,0]));
// A narrow overlap or a shared edge must not become a wall between two walk areas.
const originalBoundary=ring(-10,-10,20,20),boundaryBefore=JSON.stringify(originalBoundary);
for(const x of [5,9.8,10]){const combined=createWalkWorld({boundary:originalBoundary,boundaryExtensions:[{outer:ring(x,-4,12,8),holes:[]}]});assert.ok(combined.free(10,0));const crossing=combined.move({x:8,z:0},6,0);assert.equal(crossing.blocked,false);assert.ok(Math.abs(crossing.x-14)<1e-8);assert.equal(combined.free(x+11.8,0),false,'Outer edge still retains player radius');assert.equal(combined.free(20,5),false);assert.equal(combined.free(9.9,3.8),false,'Radius cannot cut the exposed concave corner')}
assert.equal(JSON.stringify(originalBoundary),boundaryBefore,'Base contour is not modified');
const unionHole=createWalkWorld({boundary:originalBoundary,boundaryExtensions:[{outer:ring(8,-4,12,8),holes:[ring(8.5,-1,5,2)]}]});assert.ok(unionHole.free(9,0),'Base region fills the overlapping part of an extension hole');assert.equal(unionHole.free(12,0),false,'Uncovered hole remains closed');assert.equal(unionHole.free(12,1.2),false,'Radius is retained around a hole');
const model=createComplex(),actual=createTourWorld(model);assert.equal(actual.obstacles.length,model.courtyard.colliders.length+model.publicRealm.colliders.length+model.publicRealm.treePositions.length+model.treePositions.length+(model.salesOffice?.colliders.length||0)+(model.neighborhood?.backdropGarden?.colliders.length||0));assert.ok(actual.obstacles.length>500);assert.ok(actual.solids.length>=24);const starts=[[-8,7],[-92,10],[-55,-40]];for(const p of starts){const pos=actual.nearest(p);assert.ok(pos&&actual.free(pos.x,pos.z));let seed=217;for(let i=0;i<1500;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed/4294967296*Math.PI*2,step=.1+(i%9)*.18,next=actual.move(pos,Math.cos(a)*step,Math.sin(a)*step);assert.ok(actual.free(next.x,next.z));assert.ok(Math.hypot(next.x-pos.x,next.z-pos.z)<=step+1e-8);Object.assign(pos,next)}}
for(const [id,t] of model.towers)assert.ok(!actual.free(t.spec.x,t.spec.z),`Solid building ${id}`);
const destinations=createTourDestinations(model);for(const d of destinations){const active=d.world||actual;assert.ok(active.free(...d.point),`Destination ${d.name} is clear without a search or jump`)}
// The play bridge is an independent surface: walk every physical tread from
// ground, match the rendered deck, traverse both lobes, and return down the stair.
const bridgeDestination=destinations.find(d=>d.name==='Мостик');assert.ok(bridgeDestination);
const bridgeWorld=bridgeDestination.world,pavilion=model.courtyard.playPavilion,route=pavilion.upperRoute;
assert.notEqual(bridgeWorld,actual);assert.equal(route.treads.length,22);assert.equal(bridgeWorld.heightAt(...bridgeDestination.point),0);
assert.ok(actual.free(...bridgeDestination.point),'The separate route begins at actual clear ground');
assert.equal(tourSurfaceElevation({name:'Площадка'}, {x:route.landing[0],z:route.landing[1]}),0,'Ground destinations never sample the roof');
assert.equal(bridgeWorld.heightAt(-999,-999),null);
const treadCentres=route.treads.map(t=>t.outer.reduce((sum,p)=>[sum[0]+p[0]/t.outer.length,sum[1]+p[1]/t.outer.length],[0,0]));
const surfaceMeshes=pavilion.meshes.filter(m=>m===pavilion.playBridge||m.name==='Curved stair tread to the play bridge');
model.root.updateMatrixWorld(true);const surfaceRay=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
function verifySurface(point){const height=bridgeWorld.heightAt(...point);assert.ok(Number.isFinite(height));surfaceRay.set(new THREE.Vector3(point[0],10,point[1]),down);const hit=surfaceRay.intersectObjects(surfaceMeshes,false)[0];assert.ok(hit,'A real visible mesh supports the walking surface');assert.ok(Math.abs(height-hit.point.y)<.0002,`Foot height matches rendered triangles at ${point}`);return height;}
let bridgePosition={x:bridgeDestination.point[0],z:bridgeDestination.point[1]},previousHeight=0;
for(const [index,point] of treadCentres.entries()){
 assert.ok(bridgeWorld.free(...point));const moved=bridgeWorld.move(bridgePosition,point[0]-bridgePosition.x,point[1]-bridgePosition.z);
 assert.equal(moved.blocked,false,`Physical tread ${index+1} can be reached`);assert.ok(Math.hypot(moved.x-point[0],moved.z-point[1])<1e-8);
 const height=verifySurface(point);assert.ok(height>=previousHeight-1e-5&&height-previousHeight<=bridgeWorld.maxStep+.0001,'Every riser is an actual small step');assert.ok(Math.abs(height-route.treads[index].height)<.015);
 previousHeight=height;bridgePosition=moved;
}
const ontoDeck=bridgeWorld.move(bridgePosition,route.landing[0]-bridgePosition.x,route.landing[1]-bridgePosition.z);
assert.equal(ontoDeck.blocked,false,'The final tread joins the open rail gap');verifySurface(route.landing);
// A fine grid discovers real reachable deck paths rather than assuming that
// a line across one of the open sky courts is walkable.
const minX=Math.min(...route.outer.map(p=>p[0])),maxX=Math.max(...route.outer.map(p=>p[0])),minZ=Math.min(...route.outer.map(p=>p[1])),maxZ=Math.max(...route.outer.map(p=>p[1])),gridStep=.12,columns=Math.ceil((maxX-minX)/gridStep),rows=Math.ceil((maxZ-minZ)/gridStep),deckCells=new Map();
for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=columns;ix++){const point=[minX+(ix+.5)*gridStep,minZ+(iz+.5)*gridStep];if(bridgeWorld.free(...point)&&bridgeWorld.heightAt(...point)>2.6)deckCells.set(iz*(columns+1)+ix,{ix,iz,point});}
const visited=new Set(),queue=[];
for(const [key,cell] of deckCells){if(Math.hypot(cell.point[0]-route.landing[0],cell.point[1]-route.landing[1])>.4)continue;const move=bridgeWorld.move(ontoDeck,cell.point[0]-ontoDeck.x,cell.point[1]-ontoDeck.z);if(!move.blocked){visited.add(key);queue.push(cell);}}
assert.ok(queue.length,'Landing connects to the upper walking surface');
for(let head=0;head<queue.length;head++){const cell=queue[head];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
 const key=(cell.iz+dz)*(columns+1)+cell.ix+dx,next=deckCells.get(key);if(!next||visited.has(key)||Math.abs(next.ix-cell.ix)>1)continue;
 const moved=bridgeWorld.move({x:cell.point[0],z:cell.point[1]},next.point[0]-cell.point[0],next.point[1]-cell.point[1]);if(!moved.blocked){visited.add(key);queue.push(next);}
}}
assert.ok(queue.some(c=>c.point[0]<minX+2)&&queue.some(c=>c.point[0]>maxX-2),'Both real upper loops are connected to the stair');
for(let i=0;i<queue.length;i+=Math.max(1,Math.floor(queue.length/80)))verifySurface(queue[i].point);
for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const moved=bridgeWorld.move(ontoDeck,Math.cos(angle)*30,Math.sin(angle)*30);assert.ok(moved.blocked&&bridgeWorld.free(moved.x,moved.z));assert.ok(Number.isFinite(bridgeWorld.heightAt(moved.x,moved.z)),'Neither the outer edge nor either open court can be fallen through');}
for(const guard of route.guardSegments){const point=[(guard.a[0]+guard.b[0])/2,(guard.a[1]+guard.b[1])/2];assert.equal(bridgeWorld.free(...point),false,'Every actual upper glass guard blocks the walking body');}
bridgePosition=ontoDeck;for(const point of [...treadCentres].reverse().concat([bridgeDestination.point])){const moved=bridgeWorld.move(bridgePosition,point[0]-bridgePosition.x,point[1]-bridgePosition.z);assert.equal(moved.blocked,false,'The same physical stair can be descended');bridgePosition=moved;}
assert.equal(tourSurfaceElevation(bridgeDestination,bridgePosition),0);assert.equal(tourSurfaceElevation({elevation:6.695},bridgePosition),6.695,'Selecting a terrace restores its fixed surface height');
if(model.salesOffice){
 const office=model.salesOffice;assert.equal(actual.boundaries.length,1+office.boundaryExtensions.length);assert.equal(actual.free(...office.center),false,'The glazed office remains a closed building');
 const d=destinations.find(d=>d.name==='Офис продаж');assert.ok(d);const approach=actual.move({x:d.point[0],z:d.point[1]},office.center[0]-d.point[0],office.center[1]-d.point[1]);assert.ok(approach.blocked&&actual.free(approach.x,approach.z));assert.equal(solidContains(approach.x,approach.z,office.solids[0]),false,'Moving toward the entrance cannot tunnel into the office');
 let p={x:office.layout.drive[0][0],z:office.layout.drive[0][1]};for(const target of office.layout.drive.slice(1)){const moved=actual.move(p,target[0]-p.x,target[1]-p.z);assert.equal(moved.blocked,false,`External drive remains connected toward ${target}`);assert.ok(Math.hypot(moved.x-target[0],moved.z-target[1])<1e-7);p=moved}
 for(const o of office.colliders){const point=o.type==='segment'?[(o.a[0]+o.b[0])/2,(o.a[1]+o.b[1])/2]:[o.x,o.z];assert.equal(actual.free(...point),false,'Office car, tree or furnishing has a collision');}
}
for(const entry of model.courtyard.playPavilion.metadata.archEntries){const start={x:entry.outside[0],z:entry.outside[1]},walk=actual.move(start,entry.inside[0]-start.x,entry.inside[1]-start.z);assert.equal(walk.blocked,false,'Every modelled pavilion arch is traversable');assert.ok(Math.hypot(walk.x-entry.inside[0],walk.z-entry.inside[1])<1e-8)}
// Terrace walks use their own raised boundary: sprinting cannot leave the slab or cross furniture.
assert.ok(model.terraces.destinations.length>=5);for(const d of model.terraces.destinations){assert.ok(d.elevation>4);const start=d.world.nearest(d.point);assert.ok(start&&d.world.free(start.x,start.z));for(let angle=0;angle<Math.PI*2;angle+=.13){const moved=d.world.move(start,Math.cos(angle)*40,Math.sin(angle)*40);assert.ok(moved.blocked&&d.world.free(moved.x,moved.z));assert.ok(Math.hypot(moved.x-start.x,moved.z-start.z)<40)}for(const collider of d.world.obstacles)assert.ok(!d.world.free(collider.x,collider.z))}
const light=model.commercialLights,texture=light.interiorTexture,panes=model.commercialFrontage.allCommercialPanes,layout=model.commercialFrontage.interiorLayout;
assert.equal(light.material.map,texture);assert.equal(light.material.emissiveMap,texture);assert.equal(texture.image.width,2048);assert.equal(texture.image.height,640);assert.equal(texture.userData.reference.variants,4);assert.equal(texture.userData.reference.tiers,2);assert.equal(texture.flipY,true,'Atlas rows are sampled with the intended vertical orientation');assert.ok(readPixelSignature(texture.image.data).startsWith('@r_peredelkino|'));
const attributes=light.geometry.attributes;for(const name of ['shopStyle','shopUVRange','shopTier','shopReverse'])assert.equal(attributes[name].count,panes.length);
assert.equal(new Set(attributes.shopStyle.array).size,4);assert.deepEqual([...new Set(attributes.shopTier.array)].sort(),[0,1]);assert.equal(light.material.transparent,false,'Shop rooms retain depth-writing instanced glazing');
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};light.material.onBeforeCompile(shader);
for(const name of ['shopStyle','shopUVRange','shopTier','shopReverse'])assert.ok(shader.vertexShader.includes(name),`Commercial shader uses ${name}`);
assert.ok(shader.vertexShader.includes('1.0-shopTier'),'The two atlas rows follow the declared flipY orientation');assert.ok(shader.fragmentShader.includes('texture2D(map,vShopUV)'));assert.ok(shader.fragmentShader.includes('texture2D(emissiveMap,vShopUV)'));assert.ok(shader.fragmentShader.includes('vPaneGlow * nightFactor'));assert.ok(shader.fragmentShader.includes('paneAuthorInk'));
// Walkers see the outward face of each box, including the reversed-U negative
// face. Neighbouring panes must advance through one room, not restart it.
const roomBays=new Map();let reversedFaces=0,forwardFaces=0;
for(let i=0;i<panes.length;i++){
 const pane=panes[i],record=layout.records[i],style=attributes.shopStyle.getX(i),tier=attributes.shopTier.getX(i),u0=attributes.shopUVRange.getX(i),u1=attributes.shopUVRange.getY(i),reverse=attributes.shopReverse.getX(i);
 assert.ok(Number.isInteger(style)&&style>=0&&style<4);assert.equal(tier,pane.storey===2?1:0);assert.ok(u0>=0&&u1<=1&&u1>u0);assert.ok(reverse===0||reverse===1);
 const outward=Math.sin(pane.angle)*pane.nx+Math.cos(pane.angle)*pane.nz;outward<0?reversedFaces++:forwardFaces++;
 for(let vertex=0;vertex<attributes.position.count;vertex++)if(attributes.normal.getZ(vertex)*outward>.9){
  const raw=attributes.uv.getX(vertex),u=raw*(1-reverse)+(1-raw)*reverse;assert.ok(Math.abs(u-attributes.position.getX(vertex)-.5)<.0002,'Visible room slices have a consistent left-to-right direction');
 }
 let bays=roomBays.get(record.groupId);if(!bays){bays=new Map();roomBays.set(record.groupId,bays)}const previous=bays.get(pane.frontageIndex);
 if(previous){assert.ok(Math.abs(previous.u0-u0)<.000001&&Math.abs(previous.u1-u1)<.000001,'Both commercial storeys align across the same facade bay')}else bays.set(pane.frontageIndex,{pane,u0,u1});
}
assert.ok(reversedFaces>0&&forwardFaces>0,'UV checks cover both contour orientations');assert.ok([...roomBays.values()].filter(bays=>bays.size>=3).length>roomBays.size*.75,'Most interiors span at least three facade bays');
for(const [id,bays] of roomBays){
 const ordered=[...bays.values()].sort((a,b)=>a.pane.frontageIndex-b.pane.frontageIndex),group=layout.groups.find(g=>g.id===id);
 for(let i=1;i<ordered.length;i++){
  const a=ordered[i-1],b=ordered[i];assert.equal(b.pane.frontageIndex,a.pane.frontageIndex+1,'An interior never bridges a missing facade bay');
  const frameGap=((a.pane.pitch-a.pane.width)+(b.pane.pitch-b.pane.width))/2/group.width;
  assert.ok(Math.abs(b.u0-a.u1-frameGap)<.000001,'Only the actual mullion separates adjacent slices of one shop');
 }
}
// Inspect each 512×320 room separately. Regional contrasts tolerate fine grain
// and the author film, while still rejecting flat glass tint or a duplicated row.
const variants=4,tiers=2,tileWidth=texture.image.width/variants,tileHeight=texture.image.height/tiers,pixels=texture.image.data;
const luma=(variant,tier,u,v)=>{const x=variant*tileWidth+Math.round(u*(tileWidth-1)),y=tier*tileHeight+Math.round(v*(tileHeight-1)),i=(y*texture.image.width+x)*4;return pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;};
const regionMean=(variant,tier,u0,v0,u1,v1)=>{let sum=0;for(let y=0;y<9;y++)for(let x=0;x<9;x++)sum+=luma(variant,tier,u0+(u1-u0)*(x+.5)/9,v0+(v1-v0)*(y+.5)/9);return sum/81;};
const tierMeans=[[],[]];
for(let tier=0;tier<tiers;tier++){
 const signatures=[];
 for(let variant=0;variant<variants;variant++){
  const values=[];for(let y=.04;y<.98;y+=.021)for(let x=.03;x<.97;x+=.023)values.push(luma(variant,tier,x,y));
  const sorted=[...values].sort((a,b)=>a-b);assert.ok(sorted[Math.floor(sorted.length*.95)]-sorted[Math.floor(sorted.length*.05)]>40,'Every room retains a shaded doorway, furnishings and a lighter back wall');
  signatures.push(values.map(Math.round).join(','));tierMeans[tier].push(values.reduce((sum,value)=>sum+value,0)/values.length);
  assert.ok(regionMean(variant,tier,.203,.185,.237,.204)>regionMean(variant,tier,.31,.10,.39,.16)+50,'Pendant fixtures remain readable against the ceiling on both storeys');
 }
 assert.equal(new Set(signatures).size,variants,`All four room variants differ on tier ${tier}`);
}
for(let variant=0;variant<variants;variant++)assert.ok(tierMeans[1][variant]<tierMeans[0][variant]*.95&&tierMeans[1][variant]>tierMeans[0][variant]*.65,'Upper galleries are quieter without losing their interior detail');
const counterContrast=tier=>regionMean(0,tier,.31,.642,.40,.656)-regionMean(0,tier,.31,.75,.40,.79);
assert.ok(counterContrast(0)>60,'The lower cafe has one readable counter top above its darker face');assert.ok(counterContrast(1)<counterContrast(0)*.5,'The upper gallery does not repeat the lower counter');
assert.ok(new Set(pixels).size>100);assert.equal(texture.generateMipmaps,true,'Fine interior detail has mipmaps at distance');
model.dispose();console.log('PASS: union boundaries; all ground destinations; 22 real stair treads up/down; rendered-triangle foot heights; both upper play loops, guards and no falls; terrace resets; 4500 ground movements; 2048×640 shop atlas with four variants on two tiers, continuous outward-face UVs, restrained upper galleries, fixture contrast and attribution');
