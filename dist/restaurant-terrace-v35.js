// @r_peredelkino · optional outdoor restaurant programme, not an operator plan.
// Existing office roof, planted beds, five tables and fifteen seats are retained.
import * as T from './vendor/three.module.js';
import {bakeSceneAuthorship} from './baked-authorship.js?v=publication371';
import {createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=publication371';
import {batchStatic} from './scene-batches.js?v=publication371';
import {solidContains} from './walk-physics.js?v=publication371';
import {officeTerraceFootprints} from './office-terrace-v33.js?v=publication371';
import {perennialSprigGeometry} from './botanical-geometry.js?v=publication371';

export function createRestaurantTerrace(root,{officeTerrace}={}){
 if(!officeTerrace?.world||!officeTerrace.metadata)return null;
 const group=new T.Group();group.name='Authored outdoor restaurant terrace · existing office roof';root.add(group);
 const level=officeTerrace.metadata.level,world=officeTerrace.world,tables=officeTerrace.metadata.tables,
  m={mineral:createMineralMaterial(0xe9e5d9,{grain:.025,name:'Outdoor restaurant ceramic and mineral finish'}),bronze:new T.MeshStandardMaterial({color:0x88816d,metalness:.65,roughness:.37}),warm:new T.MeshStandardMaterial({color:0xead6ae,emissive:0xeec995,emissiveIntensity:.05,roughness:.38}),fabric:new T.MeshStandardMaterial({color:0xcec6ac,roughness:.92}),leaf:new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.87,side:T.DoubleSide})};
 const obstacles=[],interactions=[],skipped=[],plants=[],dummy=new T.Object3D();
 const mesh=(g,mat)=>{const o=new T.Mesh(g,mat);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
 const box=(w,h,d,x,y,z,mat)=>{const o=mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y+h/2,z);return o;};
 // Tableware is low, removable furniture on the original tables. No dining
 // layout, fit-out contract, restaurant operator or reservation is asserted.
 for(const [i,p]of tables.entries()){
  const top=level+.781;
  const vase=mesh(new T.CylinderGeometry(.035,.055,.12,12),m.mineral);vase.position.set(p.x,top+.06,p.z);
  for(let j=0;j<3;j++){
   const a=j/3*Math.PI*2+i*.35,x=p.x+Math.cos(a)*.28,z=p.z+Math.sin(a)*.28;
   const plate=mesh(new T.CylinderGeometry(.087,.087,.012,18),m.mineral);plate.position.set(x,top+.008,z);
   const napkin=box(.085,.006,.055,x,top+.015,z,m.fabric);napkin.rotation.y=-a;
   const cup=mesh(new T.CylinderGeometry(.033,.027,.064,12,1,true),m.mineral);cup.position.set(p.x+Math.cos(a+.34)*.29,top+.033,p.z+Math.sin(a+.34)*.29);
  }
 }
 // Extra perennials root in the same existing raised bed. They do not add
 // new soil, planter boundaries or walking barriers to the roof wing.
 for(const bed of officeTerrace.beds||[]){
  const xs=bed.outer.map(p=>p[0]),zs=bed.outer.map(p=>p[1]);
  for(let x=Math.min(...xs)+.22;x<Math.max(...xs);x+=.85)for(let z=Math.min(...zs)+.22;z<Math.max(...zs);z+=.85){
   if(![0,.25,.5,.75].every(a=>solidContains(x+Math.cos(a*Math.PI*2)*.22,z+Math.sin(a*Math.PI*2)*.22,bed)))continue;
   plants.push({x,z,height:.44+Math.abs(Math.sin(x*7+z*3))*.19,island:'office-existing-raised-bed'});
  }
 }
 const flowerGeometry=perennialSprigGeometry(0xc4acc9);flowerGeometry.scale(1.35,1,1.35);
 const flowers=new T.InstancedMesh(flowerGeometry,m.leaf,plants.length);flowers.name='Authorial terrace perennials inside the unchanged planted bed';
 plants.forEach((p,i)=>{dummy.position.set(p.x,level+.36,p.z);dummy.rotation.y=i*2.399;dummy.scale.setScalar(p.height);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);});flowers.instanceMatrix.needsUpdate=true;flowers.castShadow=flowers.receiveShadow=true;group.add(flowers);
 let canopy=null,shade=.55,shadeAngle=(1-.55)*1.28,shadeTarget=(1-.55)*1.28;
 const targetTable=tables.find(p=>p.x===63&&p.z===-74)||tables.find(p=>!p.umbrella);
 const canopyCenter=targetTable?[targetTable.x,targetTable.z]:null,postPoints=canopyCenter?[[canopyCenter[0]-1.5,canopyCenter[1]-1.5],[canopyCenter[0]+1.5,canopyCenter[1]-1.5],[canopyCenter[0]+1.5,canopyCenter[1]+1.5],[canopyCenter[0]-1.5,canopyCenter[1]+1.5]]:[];
 // Louvres stay within the original office-terrrace floor footprint. Columns
 // must be on free paving, including a standing clearance around each one.
 const validCanopy=canopyCenter&&postPoints.every(([x,z])=>officeTerraceFootprints.some(p=>solidContains(x,z,p))&&world.free(x,z))&&Array.from({length:13},(_,i)=>i/12).every(t=>[
  [canopyCenter[0]-1.58+3.16*t,canopyCenter[1]-1.58],[canopyCenter[0]-1.58+3.16*t,canopyCenter[1]+1.58],
  [canopyCenter[0]-1.58,canopyCenter[1]-1.58+3.16*t],[canopyCenter[0]+1.58,canopyCenter[1]-1.58+3.16*t]
 ].every(([x,z])=>officeTerraceFootprints.some(p=>solidContains(x,z,p))));
 if(validCanopy){
  for(const [x,z]of postPoints){box(.064,3.1,.064,x,level,z,m.bronze);obstacles.push({type:'circle',x,z,radius:.055,source:'restaurant-terrace-v35',enabled:true});}
  for(const [x,z,w,d]of [[canopyCenter[0],canopyCenter[1]-1.53,3.16,.075],[canopyCenter[0],canopyCenter[1]+1.53,3.16,.075],[canopyCenter[0]-1.53,canopyCenter[1],.075,3.16],[canopyCenter[0]+1.53,canopyCenter[1],.075,3.16]])box(w,.10,d,x,level+3.10,z,m.bronze);
  for(const xof of [-1.47,1.47])box(.018,.018,2.9,canopyCenter[0]+xof,level+3.03,canopyCenter[1],m.warm);
  canopy=new T.InstancedMesh(new T.BoxGeometry(3.04,.035,.127),m.mineral,20);canopy.name='Authorial motorised restaurant shade · twenty batched louvers';canopy.userData.dynamic=true;group.add(canopy);
  // The world keeps references to these objects: visibility changes disable
  // only our new columns while preserving every existing rooftop collider.
  world.obstacles.push(...obstacles);
 }else skipped.push({id:'restaurant-smart-shade',reason:'Existing footprint or safe column placement did not permit the proposed shade'});
 const rawApproach=targetTable?[targetTable.x-.8,targetTable.z+2]:[62,-83],freeApproach=world.nearest(rawApproach,2);
 const restaurantPoint=freeApproach?[freeApproach.x,freeApproach.z]:officeTerrace.destination?.point;
 let seatPoint=null,seatLook=null;
 if(targetTable){const originalIndex=[...officeTerrace.metadata.tables].findIndex(p=>p===targetTable),seedIndex=targetTable.x===63&&targetTable.z===-74?5:originalIndex;const a=seedIndex*.35;seatPoint=[targetTable.x+Math.cos(a)*.91,targetTable.z+Math.sin(a)*.91];seatLook=[targetTable.x,targetTable.z];}
 if(restaurantPoint)interactions.push({id:'restaurant-terrace-office',type:'terrace-restaurant',label:'Ресторанная терраса · столик и навес',point:restaurantPoint,objectPoint:canopyCenter||restaurantPoint,radius:2.6,world,elevation:level,seatPoint,seatHeight:level+.45,lookAt:seatLook||canopyCenter,authoredConcept:true,menuConcept:true,layer:'garden',sourceArea:'courtyard'});
 const diningApproach=targetTable?world.nearest([targetTable.x-.8,targetTable.z-1.5],2):null;
 if(seatPoint&&diningApproach)interactions.push({id:'restaurant-dining-seat',type:'seat',label:'Сесть за стол · ресторанная терраса',point:[diningApproach.x,diningApproach.z],objectPoint:seatLook,radius:2.3,world,elevation:level,seatPoint,seatHeight:level+.45,lookAt:seatLook,authoredConcept:true,layer:'garden',sourceArea:'courtyard'});
 const destination=restaurantPoint?{name:'Ресторанная терраса',point:restaurantPoint,look:seatLook||[71,-81],world,elevation:level,authoredConcept:true}:null;
 batchStatic(group);const authored=bakeSceneAuthorship(group,{label:'restaurant-terrace-v35'});
 const metadata={revision:35,authoredConcept:true,operatorConfirmed:false,sourceArchitecturalFootprintsUnchanged:true,originalTableCount:tables.length,originalChairCount:tables.reduce((n,p)=>n+p.chairs,0),originalUmbrellaCount:tables.filter(p=>p.umbrella).length,plants,shade:canopy?{center:canopyCenter,postPoints,louvers:20,footprint:[3.16,3.16],authorial:true}:null,skipped,restaurantPoint,seatPoint,level,meshCount:group.children.filter(p=>p.isMesh).length};group.userData.concept=metadata;
 function updateLouvers(){if(!canopy)return;for(let i=0;i<20;i++){dummy.position.set(canopyCenter[0],level+3.13,canopyCenter[1]-1.43+i/19*2.86);dummy.rotation.set(shadeAngle,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);}canopy.instanceMatrix.needsUpdate=true;}
 updateLouvers();let visible=true,lastTime=null;
 return{group,world,obstacles,interactions,metadata,destination,
  setShade(value){const numeric=typeof value==='string'&&['open','filtered','closed'].includes(value)?{open:0,filtered:.55,closed:1}[value]:+value;shade=T.MathUtils.clamp(Number.isFinite(numeric)?numeric:.55,0,1);shadeTarget=(1-shade)*1.28;},
  setVisible(value){visible=!!value;group.visible=visible;for(const o of obstacles)o.enabled=visible;},
  update(seconds,{night=0}={}){if(!visible)return;const t=Number.isFinite(+seconds)?+seconds:0,dt=lastTime===null?0:Math.max(0,Math.min(.1,t-lastTime));lastTime=t;if(Math.abs(shadeAngle-shadeTarget)>.002){shadeAngle=T.MathUtils.lerp(shadeAngle,shadeTarget,Math.min(1,dt*2.8));updateLouvers();}m.warm.emissiveIntensity=.045+T.MathUtils.clamp(+night||0,0,1)*1.25;},
  get visible(){return visible;},get shade(){return shade;},
  dispose(){root.remove(group);const geos=new Set(),maps=new Set(authored.textures);group.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.isInstancedMesh)o.dispose();});geos.forEach(g=>g.dispose());disposeOwnedMaterials(m);maps.forEach(t=>t.dispose());for(const o of obstacles)o.enabled=false;}
 };
}
