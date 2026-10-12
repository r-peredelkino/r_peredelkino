// @r_peredelkino · shared, unbranded street vehicle models.
import * as THREE from './vendor/three.module.js';
import {metersToModel as M} from './geo-reference.js?v=community38';

export const vehicleStyles=Object.freeze([
 Object.freeze({id:'sedan',length:4.48,width:1.83,height:1.60,wheelbase:2.69,cabin:[[-1.25,.98],[-.73,1.50],[.53,1.50],[1.13,1.04]]}),
 Object.freeze({id:'suv',length:4.88,width:1.94,height:1.98,wheelbase:2.88,cabin:[[-1.62,1.13],[-1.24,1.84],[.66,1.84],[1.29,1.17]]}),
 Object.freeze({id:'compact',length:4.02,width:1.76,height:1.64,wheelbase:2.49,cabin:[[-1.53,1.01],[-1.10,1.54],[.48,1.54],[1.02,1.06]]}),
 Object.freeze({id:'van',length:4.48,width:1.91,height:2.08,wheelbase:2.81,cabin:[[-1.83,1.10],[-1.74,1.98],[.62,1.98],[1.27,1.16]]})
]);
// Lift the two darkest display colours so small street silhouettes remain
// readable in ordinary scene lighting, without changing vehicle state/seeds.
const paintColors=[0xe2e5dc,0x426f82,0x596b7d,0xcba16c,0x9b4449,0x537378,0xccc394,0x536570];
function hash(n){let a=Math.imul(n^0x986daa,0x45d9f3b);a=Math.imul(a^(a>>>16),0x45d9f3b);return((a^(a>>>16))>>>0)/4294967296;}
export function vehicleStyleFor(car){return car.height>1?1:hash(car.seed+7)<.22?2:hash(car.seed+8)>.84?3:0;}

// A side-profile extrusion gives a faceted, sloping silhouette rather than a
// scaled cube. The four silhouettes have independent cabin and roof geometry.
function profileGeometry(profile,width,bevel=0){
 const shape=new THREE.Shape();profile.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:width-2*bevel,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:1});
 geometry.rotateY(Math.PI/2);geometry.translate(-width/2+bevel,0,0);return geometry;
}
function box(size,position,rotation=null){const geometry=new THREE.BoxGeometry(...size);if(rotation)geometry.rotateX(rotation);geometry.translate(...position);return geometry;}
function beam(a,b,radius=.025){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from),geometry=new THREE.BoxGeometry(radius*2,delta.length(),radius*2);geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));geometry.translate(...from.add(to).multiplyScalar(.5).toArray());return geometry;}
function merge(parts){
 const data={position:[],normal:[],uv:[]};
 for(const source of parts){const flat=source.index?source.toNonIndexed():source;for(const key of Object.keys(data))data[key].push(...flat.getAttribute(key).array);if(flat!==source)flat.dispose();source.dispose();}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));geometry.scale(M(1),M(1),M(1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function bodyGeometry(style){
 const half=style.length/2,hood=style.id==='suv'?1.13:style.id==='van'?1.07:.97;
 const outline=[[-half+.06,.47],[-half+.11,.89],[-half+.43,hood],[half-.44,hood],[half-.10,.85],[half-.06,.47]],archRadius=.405,startAngle=Math.asin(.13/archRadius);
 // True wheel arch cut-outs are part of the side profile; tyres do not pass
 // through the painted body as they would with a simple rectangular shell.
 for(const center of [style.wheelbase/2,-style.wheelbase/2])for(let step=0;step<=6;step++){const angle=startAngle+(Math.PI-2*startAngle)*step/6;outline.push([center+Math.cos(angle)*archRadius,.34+Math.sin(angle)*archRadius]);}
 const body=profileGeometry(outline,style.width,.035),[rearTop,frontTop]=[style.cabin[1],style.cabin[2]],roofSpan=frontTop[0]-rearTop[0];
 const roof=profileGeometry([[rearTop[0]-.045,rearTop[1]+.005],[rearTop[0]-.015,rearTop[1]+.075],[frontTop[0]+.01,frontTop[1]+.075],[frontTop[0]+.045,frontTop[1]+.005]],style.width*.84,.018);
 const parts=[body,roof];
 for(const sign of [-1,1]){
  // Painted mirror caps and handles belong to the shared body silhouette.
  parts.push(box([.18,.095,.235],[sign*(style.width/2+.055),hood+.235,.84]));
  for(const z of [-.67,.53])parts.push(box([.028,.038,.15],[sign*(style.width/2+.006),hood-.055,z]));
 }
 if(style.id==='suv')for(const sign of [-1,1])parts.push(beam([sign*style.width*.30,rearTop[1]+.115,rearTop[0]+.02],[sign*style.width*.30,frontTop[1]+.115,frontTop[0]-.02],.022));
 if(style.id==='van')parts.push(box([style.width*.72,.055,.27],[0,style.cabin[1][1]+.070,-.72]));
 const geometry=merge(parts);geometry.userData={vehicleStyle:style.id,roofSpan,beveled:true};return geometry;
}
function frameGeometry(style){
 const profile=style.cabin,w=style.width*.83,parts=[],hood=style.id==='suv'?1.13:style.id==='van'?1.07:.97;
 for(const sign of [-1,1]){
  const x=sign*(w/2+.009);for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length];parts.push(beam([x,a[1],a[0]],[x,b[1],b[0]],.027));}
  const pillarZ=style.id==='van'?-.58:-.12;parts.push(beam([x,hood,pillarZ],[x,profile[1][1],pillarZ],.035));
  parts.push(box([.02,.026,style.length*.65],[sign*(style.width/2+.012),hood-.16,-.08]));
  parts.push(box([.19,.105,.245],[sign*(style.width/2+.055),hood+.204,.84]));
 }
 for(const p of profile)parts.push(beam([-w/2,p[1],p[0]],[w/2,p[1],p[0]],.021));
 // Grilles and bumper inserts are small geometric details, with no logos.
 parts.push(box([style.width*.57,.16,.035],[0,.665,style.length/2-.055]));
 parts.push(box([style.width*.75,.075,.035],[0,.505,style.length/2-.055]));
 parts.push(box([style.width*.70,.070,.035],[0,.51,-style.length/2+.055]));
 return merge(parts);
}
function tyreGeometry(){const tread=new THREE.TorusGeometry(.269,.071,4,12);tread.rotateY(Math.PI/2);const wall=new THREE.CylinderGeometry(.277,.277,.205,12,1);wall.rotateZ(Math.PI/2);return merge([tread,wall]);}
function rimGeometry(){
 const center=new THREE.CylinderGeometry(.082,.082,.224,10,1);center.rotateZ(Math.PI/2);
 const parts=[center];for(const sign of [-1,1]){const ring=new THREE.TorusGeometry(.205,.022,3,12);ring.rotateY(Math.PI/2);ring.translate(sign*.115,0,0);parts.push(ring);}for(let i=0;i<5;i++)parts.push(box([.225,.032,.365],[0,0,0],i*Math.PI/5));return merge(parts);
}
function lightGeometry(){return merge([box([.42,.095,.055],[0,0,0])]);}

export function createVehicleModels(group,cars){
 const buckets=vehicleStyles.map((style,index)=>({style,index,cars:cars.filter(car=>vehicleStyleFor(car)===index)}));
 // The scene has no environment reflection map: a mostly dielectric painted
 // surface keeps its diffuse colour instead of disappearing into black metal.
 const bodyMaterial=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.20,roughness:.31});
 const glassMaterial=new THREE.MeshStandardMaterial({color:0x26414c,metalness:.54,roughness:.18});
 const frameMaterial=new THREE.MeshStandardMaterial({color:0x202b30,metalness:.26,roughness:.40});
 const tyreMaterial=new THREE.MeshStandardMaterial({color:0x141b1d,roughness:.93});
 const rimMaterial=new THREE.MeshStandardMaterial({color:0xc3cdd1,metalness:.74,roughness:.29});
 const headMaterial=new THREE.MeshStandardMaterial({color:0xffe7bd,emissive:0xffe7ac,emissiveIntensity:.07,roughness:.24});
 const tailMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
 const meshes=[],bodies=[],glass=[],frames=[],resources={geometries:new Set(),materials:new Set([bodyMaterial,glassMaterial,frameMaterial,tyreMaterial,rimMaterial,headMaterial,tailMaterial])};
 function instances(geometry,material,count,name){resources.geometries.add(geometry);const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.vehiclePart=name;meshes.push(mesh);group.add(mesh);return mesh;}
 for(const bucket of buckets){
  const body=instances(bodyGeometry(bucket.style),bodyMaterial,bucket.cars.length,`v38 ${bucket.style.id} painted silhouette`),windows=instances(merge([profileGeometry(bucket.style.cabin,bucket.style.width*.83)]),glassMaterial,bucket.cars.length,`v38 ${bucket.style.id} windscreen and side glazing`),frame=instances(frameGeometry(bucket.style),frameMaterial,bucket.cars.length,`v38 ${bucket.style.id} frames, mirrors and grille`);
  bodies.push(body);glass.push(windows);frames.push(frame);body.castShadow=true;windows.castShadow=true;body.receiveShadow=true;
  bucket.cars.forEach((car,slot)=>{car.vehicleStyle=bucket.style.id;car.vehicleStyleIndex=bucket.index;car.vehicleSlot=slot;body.setColorAt(slot,new THREE.Color(paintColors[Math.floor(hash(car.seed+10)*paintColors.length)]));});if(body.instanceColor)body.instanceColor.needsUpdate=true;
 }
 const tyres=instances(tyreGeometry(),tyreMaterial,cars.length*4,'v38 shared tyre tread'),rims=instances(rimGeometry(),rimMaterial,cars.length*4,'v38 five-spoke rotating alloy rims'),heads=instances(lightGeometry(),headMaterial,cars.length*2,'v38 front light pairs'),tails=instances(lightGeometry(),tailMaterial,cars.length*2,'v38 rear light pairs');
 const matrix=new THREE.Matrix4(),tailColor=new THREE.Color(),zero=new THREE.Matrix4().makeScale(0,0,0),unit=M(1);let night=0,quality='high',disposed=false,yawCos=1,yawSin=0,wheelCos=1,wheelSin=0;
 function transform(car,mesh,slot,x=0,y=0,z=0,wheel=false){
  const cos=wheel?wheelCos:1,sin=wheel?wheelSin:0;
  matrix.set(yawCos,yawSin*sin,yawSin*cos,car.world.x+unit*(yawCos*x+yawSin*z),0,cos,-sin,car.world.y+unit*y,-yawSin,yawCos*sin,yawCos*cos,car.world.z+unit*(-yawSin*x+yawCos*z),0,0,0,1);mesh.setMatrixAt(slot,matrix);
 }
 function render(){
  if(disposed)return;
  for(const car of cars){const style=vehicleStyles[car.vehicleStyleIndex],slot=car.vehicleSlot,index=car.vehicleStyleIndex;
   if(!car.active){for(const mesh of [bodies[index],glass[index],frames[index]])mesh.setMatrixAt(slot,zero);for(let j=0;j<4;j++){tyres.setMatrixAt(car.index*4+j,zero);rims.setMatrixAt(car.index*4+j,zero);}for(let j=0;j<2;j++){heads.setMatrixAt(car.index*2+j,zero);tails.setMatrixAt(car.index*2+j,zero);tails.setColorAt(car.index*2+j,tailColor.setRGB(0,0,0));}continue;}
   yawCos=Math.cos(car.heading);yawSin=Math.sin(car.heading);wheelCos=Math.cos(car.spin);wheelSin=Math.sin(car.spin);
   for(const mesh of [bodies[index],glass[index],frames[index]])if(mesh.visible)transform(car,mesh,slot);
   for(let j=0;j<4;j++){const x=(j%2?1:-1)*(style.width/2-.04),z=(j<2?1:-1)*style.wheelbase/2;transform(car,tyres,car.index*4+j,x,.34,z,true);if(rims.visible)transform(car,rims,car.index*4+j,x,.34,z,true);}
   for(let j=0;j<2;j++){const x=(j?1:-1)*style.width*.31,y=style.id==='suv'||style.id==='van'?.855:.775;transform(car,heads,car.index*2+j,x,y,style.length/2-.055);transform(car,tails,car.index*2+j,x,y,-style.length/2+.055);tailColor.setRGB(car.braking?2.4:.14+night*.7,car.braking?.07:.018,car.braking?.025:.01);tails.setColorAt(car.index*2+j,tailColor);}
  }
  for(const mesh of meshes)if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;if(tails.instanceColor)tails.instanceColor.needsUpdate=true;
 }
 function setNight(value){night=THREE.MathUtils.clamp(Number(value)||0,0,1);headMaterial.emissiveIntensity=.07+night*5;}
 function setQuality(value){const aliases={fast:'low',balanced:'medium',full:'high',max:'ultra'},name=typeof value==='number'?['low','medium','high','ultra'][Math.max(0,Math.min(3,Math.round(value)))]:aliases[value]||value;if(!['low','medium','high','ultra'].includes(name))throw new RangeError('Unknown vehicle quality');quality=name;for(const mesh of frames)mesh.visible=quality!=='low';rims.visible=quality!=='low';render();}
 function getStats(){let triangles=0,drawCalls=0;for(const mesh of meshes)if(mesh.visible&&mesh.count>0){drawCalls++;triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3*mesh.count;}return{modelRevision:38,styles:buckets.map(bucket=>({id:bucket.style.id,count:bucket.cars.length})),poolCars:cars.length,activeCars:cars.filter(car=>car.active).length,drawCalls,maximumDrawCalls:16,triangles,quality,instanced:true,simulationDensityUnchanged:true};}
 function dispose(){if(disposed)return;disposed=true;for(const mesh of meshes)group.remove(mesh);for(const geometry of resources.geometries)geometry.dispose();for(const material of resources.materials)material.dispose();}
 return{bodies,glass,frames,tyres,rims,heads,tails,meshes,resources,render,setNight,setQuality,getStats,dispose,get quality(){return quality}};
}
