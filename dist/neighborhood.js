import {createForecourtRoadside} from './forecourt-roadside.js?v=community38';
import {forecourtReference} from './forecourt-reference-data.js?v=community38';
import {forecourtRoadsideReserved} from './forecourt-ground.js?v=community38';
import {createContextServices,registeredContextFootprints} from './context-services.js?v=community38';
import {worldToModel,metersToModel} from './geo-reference.js?v=community38';
import {addReferenceBackdrop} from './reference-backdrop.js?v=community38';
import {addBackdropGarden} from './backdrop-garden.js?v=community38';
import {createTransportInfrastructure} from './transport-infrastructure.js?v=community38';
import {createLocalAccess} from './local-access.js?v=community38';
import {roads} from './transport-data.js?v=community38';
export {roads} from './transport-data.js?v=community38';
import {createNeighborBuildings} from './neighbor-buildings.js?v=community38';
import {crownGeometry,branchingTrunk,woodlandCrownGeometry,moundedShrubGeometry} from './botanical-geometry.js?v=community38';
import {spatiallyPartitionInstances} from './spatial-instances.js?v=community38';
import {moundedShrubLODGeometry} from './botanical-lod.js?v=community38';
import {createFoliageMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=community38';
import {salesOfficeLayout,salesOfficeReserved} from './sales-office.js?v=community38';
// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import * as THREE from './vendor/three.module.js';
import {mapPoint,location} from './solar.js?v=community38';
import {complexFootprints as f} from './complex-footprints.js?v=community38';
// The two detailed commercial reference models retain their courtyard relationship.
// Residential addresses and all motor roads now use the georeferenced data modules.
export const contextBuildings=['shopping','medical','police','parking'].map(role=>{
 const b=registeredContextFootprints.find(item=>item.role===role),points=b.world.map(p=>worldToModel(...p));
 const es=points.map(p=>p[0]),ns=points.map(p=>p[1]),minE=Math.min(...es),maxE=Math.max(...es),minN=Math.min(...ns),maxN=Math.max(...ns);
 return{name:b.name||b.address,address:b.address,osmWayId:b.id,e:(minE+maxE)/2,n:(minN+maxN)/2,w:maxE-minE,d:maxN-minN,h:role==='shopping'?9:role==='medical'?8:metersToModel((b.levels??b.estimatedLevels)*3.15+.65),footprintEN:points};
});
function inside(x,z,poly){let ok=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])ok=!ok;return ok}
function distance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t)}
export function createNeighborhood(root){
 const group=new THREE.Group();group.name='Streets, surrounding blocks and forest';root.add(group);
 const groundMat=new THREE.MeshStandardMaterial({color:0x7f9870,roughness:1}),roadMat=new THREE.MeshStandardMaterial({color:0x384650,roughness:.85}),sidewalkMat=new THREE.MeshStandardMaterial({color:0xc9cbbf,roughness:1}),lineMat=new THREE.MeshStandardMaterial({color:0xe5e5d5,roughness:1}),ghostMat=new THREE.MeshStandardMaterial({color:0x87959e,transparent:true,opacity:.25,depthWrite:false,roughness:1});
 const mesh=(geometry,material)=>{const m=new THREE.Mesh(geometry,material);m.receiveShadow=true;group.add(m);return m};
 function strip(a,b,width,material,y){const p=mapPoint(...a,y),q=mapPoint(...b,y),len=Math.hypot(p[0]-q[0],p[2]-q[2]);const m=mesh(new THREE.BoxGeometry(len,.12,width),material);const uv=m.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(1,len/12),uv.getY(i)*Math.max(1,width/3));m.position.set((p[0]+q[0])/2,y,(p[2]+q[2])/2);m.rotation.y=-Math.atan2(q[2]-p[2],q[0]-p[0]);return m}
 function polygon(points,mat,y){const shape=new THREE.Shape(points.map(p=>{const v=mapPoint(...p);return new THREE.Vector2(v[0],-v[2])}));const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);const m=mesh(geo,mat);m.position.y=y;return m}
 const woodlandGround=polygon([[-2600,-2600],[2600,-2600],[2600,2600],[-2600,2600]],groundMat,-1.42);woodlandGround.name="Continuous woodland ground";
 const blockMat=new THREE.MeshStandardMaterial({color:0xb4baa7,roughness:1});const triangle=polygon([[-123,-74],[163,-74],[163,25],[-53,224],[-123,240]],blockMat,-1.02);triangle.name='Neighbourhood wedge between streets and forest';
 // Carriageways, junction geometry, crossings, metro and lane arrows share
 // one source of georeferenced polylines with the moving traffic.
 const localAccess=createLocalAccess(group),roadside=createForecourtRoadside(group,{data:forecourtReference.roadside});
 const streetReservations={reserved:(x,z,margin=0)=>localAccess.reserved(x,z,margin)||roadside.reserved(x,z,margin)||forecourtRoadsideReserved(x,z,margin)};
 const transport=createTransportInfrastructure(group,{localAccess:streetReservations});
 
 // The two low reference buildings and the white garden boundary have real facades.
 const backdrop=addReferenceBackdrop(group),backdropGarden=addBackdropGarden(group);
 const contextServices=createContextServices(group);
 const neighborBuildings=createNeighborBuildings(group,contextBuildings);
 const positions=[];let seed=92481;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const edgeCurve=new THREE.CatmullRomCurve3(salesOfficeLayout.forestEdge.map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal');
 const edgePoint=(u,depth)=>{const clamped=Math.max(0,Math.min(1,u)),p=edgeCurve.getPointAt(clamped),t=edgeCurve.getTangentAt(clamped),extension=(u-clamped)*edgeCurve.getLength();return{x:p.x-t.z*depth+t.x*extension,z:p.z+t.x*depth+t.z*extension}};
 // The former random woodland mask left the entire sales-office side bare. Its edge now
 // follows the same continuous pine wall visible in all three external references.
 for(let attempt=0;attempt<24000&&positions.length<1150;attempt++){
  const u=random(),depth=6+Math.pow(random(),1.85)*255,q=edgePoint(u,depth),[x,z]=[q.x,q.z],e=x*location.east[0]+z*location.east[1],n=x*location.north[0]+z*location.north[1];
  if(inside(x,z,f.site.outer)||salesOfficeReserved(x,z,2)||transport.reserved(x,z,3)||localAccess.reserved(x,z,3)||roadside.reserved(x,z,3)||positions.some(p=>Math.hypot(p.x-x,p.z-z)<3.4))continue;
  const pine=random()<.81,height=pine?23+random()*9:12+random()*8;
  positions.push({x,z,e,n,pine,height,size:.85+random()*.35,crown:pine?2.5+random()*1.1:2.6+random()*1.1});
 }
 // Deeper trees overlap in projection behind the close wall, giving the long forest horizon.
 for(let i=0;i<700;i++){const q=edgePoint(-.35+random()*1.7,150+random()*650),x=q.x,z=q.z,pine=random()<.84;positions.push({x,z,e:x*location.east[0]+z*location.east[1],n:x*location.north[0]+z*location.north[1],pine,height:23+random()*10,size:.95+random()*.4,crown:3+random()*1.2})}
 // Retain the two v26 planting passes verbatim, then relocate only crowns that
 // intersect a newly opaque house. A separate seed leaves every unaffected
 // tree, species, height and the sales-office forest edge unchanged.
 const neighborTreeCorrections=[];
 for(let index=0;index<positions.length;index++){
  const tree=positions[index],clearance=tree.crown*1.48+.60;
  if(!neighborBuildings.reserved(tree.x,tree.z,clearance)&&!transport.reserved(tree.x,tree.z,clearance)&&!localAccess.reserved(tree.x,tree.z,clearance)&&!contextServices.reserved(tree.x,tree.z,clearance)&&!roadside.reserved(tree.x,tree.z,clearance))continue;
  const before={x:tree.x,z:tree.z};let treeSeed=(0x270910+index*7919)>>>0,placed=false;
  const sample=()=>{treeSeed=(Math.imul(treeSeed,1664525)+1013904223)>>>0;return treeSeed/4294967296;};
  for(let attempt=0;attempt<3000;attempt++){
   const near=index<1150,u=near?sample():-.35+sample()*1.7,depth=near?6+Math.pow(sample(),1.85)*255:150+sample()*650,q=edgePoint(u,depth),x=q.x,z=q.z,e=x*location.east[0]+z*location.east[1],n=x*location.north[0]+z*location.north[1];
   if(inside(x,z,f.site.outer)||salesOfficeReserved(x,z,clearance)||neighborBuildings.reserved(x,z,clearance)||contextServices.reserved(x,z,clearance)||transport.reserved(x,z,clearance)||localAccess.reserved(x,z,clearance)||roadside.reserved(x,z,clearance)||positions.some((p,j)=>j!==index&&Math.hypot(p.x-x,p.z-z)<3.4))continue;
   Object.assign(tree,{x,z,e,n});neighborTreeCorrections.push({index,ring:near?'near':'deep',before,after:{x,z}});placed=true;break;
  }
  if(!placed)throw new Error(`No clear forest position for neighbouring-house tree ${index}`);
 }
 const forestGroup=new THREE.Group();forestGroup.name='Continuous mature pine forest behind the sales office';root.add(forestGroup);forestGroup.add(woodlandGround);
 const forestFloorMat=new THREE.MeshStandardMaterial({color:0x304429,roughness:1}),floorOutline=[edgePoint(-.12,0),...edgeCurve.getPoints(120).map(p=>({x:p.x,z:p.z})),edgePoint(1.25,0),edgePoint(1.25,900),edgePoint(-.12,900)],floorShape=new THREE.Shape(floorOutline.map(p=>new THREE.Vector2(p.x,-p.z))),floorGeometry=new THREE.ShapeGeometry(floorShape);floorGeometry.rotateX(-Math.PI/2);const floorMesh=new THREE.Mesh(floorGeometry,forestFloorMat);floorMesh.position.y=-.68;floorMesh.receiveShadow=true;floorMesh.name='Dark continuous woodland floor behind the pine edge';forestGroup.add(floorMesh);
 const trunkMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1}),branchMat=new THREE.MeshStandardMaterial({color:0x806b50,roughness:1}),leafMat=createFoliageMaterial(0x5c794c,{dense:true}),pineMat=createFoliageMaterial(0x455f41,{evergreen:true,dense:true}),underMat=createFoliageMaterial(0x4c663e,{dense:true}),middleMat=createFoliageMaterial(0x354f32,{dense:true}),snowMat=new THREE.MeshStandardMaterial({color:0xe9f2f4,roughness:1});
 const trunkGeo=new THREE.CylinderGeometry(.15,.29,1,7),trunkColors=new Float32Array(trunkGeo.attributes.position.count*3),bottom=new THREE.Color(0x514b3d),top=new THREE.Color(0xa78964),trunkColor=new THREE.Color();
 for(let i=0;i<trunkGeo.attributes.position.count;i++){const h=trunkGeo.attributes.position.getY(i)+.5;trunkColor.copy(bottom).lerp(top,h*.85);trunkColor.toArray(trunkColors,i*3)}trunkGeo.setAttribute('color',new THREE.BufferAttribute(trunkColors,3));
 // Existing context tree anchors remain unchanged. Crown width is
 // bounded against the same buildings and road reservations before expansion.
 const plantingReserved=(x,z,r)=>inside(x,z,f.site.outer)||salesOfficeReserved(x,z,r)||neighborBuildings.reserved(x,z,r)||contextServices.reserved(x,z,r)||transport.reserved(x,z,r)||localAccess.reserved(x,z,r)||roadside.reserved(x,z,r)||forecourtRoadsideReserved(x,z,r);
 const crownProfiles=new Map();let crownClearanceReductions=0;
 for(const [i,p] of positions.entries()){const variation=((i*7919)%101)/100;let radius=p.crown*(p.pine?1.14+variation*.19:1.23);const wanted=radius;while(radius>.65&&plantingReserved(p.x,p.z,radius+.15))radius-=.15;if(radius<wanted-.01)crownClearanceReductions++;crownProfiles.set(p,{radius,height:p.height*(p.pine?.30+variation*.13:.54+variation*.10)});}
 const pinePositions=positions.filter(p=>p.pine),leafPositions=positions.filter(p=>!p.pine);
 const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,positions.length),leaves=new THREE.InstancedMesh(woodlandCrownGeometry(1,1,false),leafMat,leafPositions.length),pines=new THREE.InstancedMesh(woodlandCrownGeometry(1,1,true),pineMat,pinePositions.length),branches=new THREE.InstancedMesh(branchingTrunk(.075,4.5),branchMat,pinePositions.length),snowCaps=new THREE.InstancedMesh(crownGeometry(2.8,2.8,true,0),snowMat,pinePositions.length);
 trunks.name="Tall bare pine and deciduous trunks";pines.name="High irregular pine crowns";leaves.name="Deciduous woodland crowns";branches.name="Upper pine branches";snowCaps.name="Seasonal pine snow caps";
 // A woodland has overlapping shrub, young-tree and mature-canopy layers. The
 // old single sparse row left a blue gap below tiny crowns on 30 m trunks.
 const undergrowth=[],middleGrowth=[];
 for(let attempt=0;attempt<6000&&undergrowth.length<960;attempt++){const q=edgePoint(random(),2.2+Math.pow(random(),1.6)*65),radius=1.55+random()*1.50;if(plantingReserved(q.x,q.z,radius+.3))continue;undergrowth.push({...q,radius,height:1.45+random()*3.4})}
 for(let attempt=0;attempt<4000&&middleGrowth.length<440;attempt++){const q=edgePoint(random(),10+random()*135),radius=2.0+random()*1.70;if(plantingReserved(q.x,q.z,radius+.3))continue;middleGrowth.push({...q,radius,height:5.0+random()*6.0})}
 // Beyond the detailed wall the source forest remains closed all the way to
 // the horizon. Low-detail overlapping crowns fill its existing woodland mask
 // instead of exposing the old distant row of isolated trees over flat grass.
 const distantGrowth=[];let distantSeed=303009;
 const distantRandom=()=>{distantSeed=(Math.imul(distantSeed,1664525)+1013904223)>>>0;return distantSeed/4294967296;};
 for(let attempt=0;attempt<12000&&distantGrowth.length<5200;attempt++){
  const q=edgePoint(-.20+distantRandom()*1.40,210+distantRandom()*690),radius=4.3+distantRandom()*1.7;
  if(plantingReserved(q.x,q.z,radius+.4))continue;
  distantGrowth.push({...q,radius,height:23+distantRandom()*9,crownHeight:6+distantRandom()*4});
 }
 const distantCrownGeometry=new THREE.SphereGeometry(1,8,6),distantVertices=distantCrownGeometry.attributes.position;
 for(let i=0;i<distantVertices.count;i++){const x=distantVertices.getX(i),y=distantVertices.getY(i),z=distantVertices.getZ(i),jitter=1+.13*Math.sin(x*17+y*13+z*19);distantVertices.setXYZ(i,x*jitter,y,z*jitter);}
 distantCrownGeometry.computeVertexNormals();
 // SphereGeometry retains unused seam/pole vertices; recomputation zeros those
 // normals. Keep a unit radial normal there as well for robust export/QA.
 const distantNormals=distantCrownGeometry.attributes.normal;
 for(let i=0;i<distantNormals.count;i++)if(Math.hypot(distantNormals.getX(i),distantNormals.getY(i),distantNormals.getZ(i))<.8){const n=new THREE.Vector3().fromBufferAttribute(distantVertices,i).normalize();distantNormals.setXYZ(i,n.x,n.y,n.z);}
 distantCrownGeometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(distantVertices.count*3).fill(1),3));
 const distantCanopy=new THREE.InstancedMesh(distantCrownGeometry,pineMat,distantGrowth.length),distantTrunks=new THREE.InstancedMesh(trunkGeo,trunkMat,distantGrowth.length);
 distantCanopy.name='Continuous distant pine woodland canopy within the forest mask';distantTrunks.name='Low-detail trunks within distant woodland';
 const understorey=new THREE.InstancedMesh(moundedShrubGeometry(1,1),underMat,undergrowth.length),middleStorey=new THREE.InstancedMesh(woodlandCrownGeometry(1,1,false),middleMat,middleGrowth.length),dummy=new THREE.Object3D();forestGroup.add(trunks,leaves,pines,branches,understorey,middleStorey,snowCaps);snowCaps.visible=false;
 forestGroup.add(distantCanopy,distantTrunks);
 middleStorey.name='Overlapping young-tree layer inside the forest edge';
 const forestMeshes=[trunks,leaves,pines,branches,understorey,middleStorey,distantCanopy,distantTrunks,snowCaps];
 const instanceTint=(mesh,list,palette)=>{list.forEach((p,i)=>mesh.setColorAt(i,new THREE.Color(palette[i%palette.length])));if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;};
 instanceTint(pines,pinePositions,[0xffffff,0xe4eadf,0xd1decd,0xf1eddb,0xdbe5d7]);instanceTint(leaves,leafPositions,[0xffffff,0xe7eccf,0xf3ecd0,0xdce5c9]);instanceTint(understorey,undergrowth,[0xffffff,0xf0efd3,0xdde6c9,0xf7efd6]);instanceTint(middleStorey,middleGrowth,[0xffffff,0xdde7ce,0xe9eccd,0xf0eed8]);
 instanceTint(distantCanopy,distantGrowth,[0xffffff,0xd7e1d1,0xe7ebd8,0xcddcc9,0xdee6cf]);
 const forestBatches=[];
 function treeMatrices(winter=false){
  positions.forEach((p,i)=>{const h=p.pine?p.height-.8:p.height*.62;dummy.position.set(p.x,h/2-.6,p.z);dummy.rotation.set(0,i*2.4,(i%5-2)*.003);dummy.scale.set(p.size,h,p.size);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix)});
  leafPositions.forEach((p,i)=>{const profile=crownProfiles.get(p),season=winter?.38:1;dummy.position.set(p.x,p.height-.6-profile.height/2,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.set(profile.radius*season,profile.height*season,profile.radius*season);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix)});
  pinePositions.forEach((p,i)=>{const profile=crownProfiles.get(p);dummy.position.set(p.x,p.height-.6-profile.height/2,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.set(profile.radius,profile.height,profile.radius);dummy.updateMatrix();pines.setMatrixAt(i,dummy.matrix);dummy.position.y=p.height-profile.height*.56;dummy.scale.set(profile.radius/2.3,profile.height/6.2,profile.radius/2.3);dummy.updateMatrix();branches.setMatrixAt(i,dummy.matrix);dummy.position.y=p.height-.85;dummy.scale.set(profile.radius/3.1,.63,profile.radius/3.1);dummy.updateMatrix();snowCaps.setMatrixAt(i,dummy.matrix)});
  undergrowth.forEach((p,i)=>{dummy.position.set(p.x,-.64,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.set(p.radius,p.height*(winter?.65:1),p.radius);dummy.updateMatrix();understorey.setMatrixAt(i,dummy.matrix)});
  middleGrowth.forEach((p,i)=>{const season=winter?.55:1;dummy.position.set(p.x,-.64+p.height*season*.50,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.set(p.radius*season,p.height*season,p.radius*season);dummy.updateMatrix();middleStorey.setMatrixAt(i,dummy.matrix)});
  distantGrowth.forEach((p,i)=>{dummy.position.set(p.x,p.height-.6-p.crownHeight*.5,p.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.set(p.radius,p.crownHeight*.5,p.radius*(.84+(i%4)*.08));dummy.updateMatrix();distantCanopy.setMatrixAt(i,dummy.matrix);dummy.position.y=(p.height-.8)*.5-.6;dummy.scale.set(1,p.height-.8,1);dummy.updateMatrix();distantTrunks.setMatrixAt(i,dummy.matrix)});
  for(const m of forestMeshes){m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere()}
  for(const batch of forestBatches)batch.sync();
 }
 understorey.name="Dense low forest-edge undergrowth";
 treeMatrices();for(const o of [trunks,leaves,pines,branches,understorey,middleStorey,distantCanopy])o.receiveShadow=true;trunks.castShadow=pines.castShadow=leaves.castShadow=understorey.castShadow=middleStorey.castShadow=true;
 for(const [source,geometry] of [[pines,woodlandCrownGeometry(1,1,true,true)],[leaves,woodlandCrownGeometry(1,1,false,true)],[middleStorey,woodlandCrownGeometry(1,1,false,true)],[understorey,moundedShrubLODGeometry(1,1)]])forestBatches.push(spatiallyPartitionInstances(source,{cellSize:64,lod:{geometry,distance:35,fade:8}}));
 forestBatches.forEach(b=>b.group.autoUpdate=false);
 forestGroup.userData.reference={photos:[1,2,3],pineHeight:[23,32],unbranchedLowerTrunk:true,continuousEdge:true};
 forestGroup.userData.neighborTreeCorrections=neighborTreeCorrections;
 forestGroup.userData.fidelity={revision:30,treeAnchorsPreserved:true,canopyType:'flattened pine boughs, dark understorey and closed distant woodland',matureTrees:positions.length,pineCrowns:pinePositions.length,deciduousCrowns:leafPositions.length,lowShrubClumps:undergrowth.length,youngTreeClumps:middleGrowth.length,distantWoodlandTrees:distantGrowth.length,pineCanopyHeightFraction:[.30,.43],crownClearanceReductions,forestDraws:forestMeshes.length};
 const lamps=[...transport.lamps,...roadside.lamps];
 // All static opaque street pieces share a few draws instead of hundreds of individual stripes.
 const batches=new Map();for(const o of [...group.children]){if(!o.isMesh||o.isInstancedMesh||o.material.transparent)continue;let batch=batches.get(o.material);if(!batch){batch=[];batches.set(o.material,batch)}o.updateMatrix();let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrix);batch.push(geo);o.geometry.dispose();group.remove(o)}
 for(const [mat,geos] of batches){const size=geos.reduce((n,g)=>n+g.attributes.position.array.length,0),pos=new Float32Array(size),norm=new Float32Array(size),uv=new Float32Array(size/3*2);let offset=0;for(const geo of geos){pos.set(geo.attributes.position.array,offset);norm.set(geo.attributes.normal.array,offset);if(geo.attributes.uv)uv.set(geo.attributes.uv.array,offset/3*2);offset+=geo.attributes.position.array.length;geo.dispose()}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(norm,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));const m=mesh(geo,mat);m.name='Batched streets and landscape'}
 return{forestBatches,setViewer(camera){forestBatches.forEach(b=>b.updateLOD(camera));},backdrop,backdropGarden,neighborBuildings,contextServices,transport,localAccess,roadside,group,forestGroup,trees:positions,roads,lamps,ghostMaterial:ghostMat,setSeason(winter,month=9){roadside.setSeason(winter);neighborBuildings.setSeason(winter);transport.setSeason?.(winter,month);localAccess.setSeason(winter);contextServices.setSeason(winter);backdropGarden.setSeason(winter,month);groundMat.color.set(winter?0xdce6e7:0x7f9870);blockMat.color.set(winter?0xdce5e4:0xb4baa7);leafMat.color.set(winter?0x899583:[8,9,10].includes(month)?0x7c8450:0x5c794c);pineMat.color.set(winter?0x698071:0x455f41);middleMat.color.set(winter?0x8a9b88:0x354f32);forestFloorMat.color.set(winter?0xa8b6a4:0x304429);underMat.color.set(winter?0xb5c0af:0x4c663e);snowCaps.visible=winter;treeMatrices(winter)},setNight(night){roadside.materials.lamp.emissiveIntensity=.02+night*3.4;neighborBuildings.setNight(night);transport.setNight(night)},setWetness(wet){roadside.setWetness(wet);transport.setWetness(wet);localAccess.setWetness(wet);roadMat.roughness=.85-Number(wet)*.52;roadMat.metalness=.04+Number(wet)*.16;sidewalkMat.roughness=1-Number(wet)*.48},dispose(){forestBatches.forEach(b=>b.dispose());roadside.dispose();group.add(forestGroup);root.remove(group);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.isInstancedMesh)o.dispose()});geometries.forEach(g=>g.dispose());disposeOwnedMaterials(Object.fromEntries([...materials].map((m,i)=>[i,m])))}};
}
