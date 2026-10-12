import {residentFactory} from './resident-figure.js?v=publication371';
// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import * as THREE from './vendor/three.module.js';
import {direction} from './solar.js?v=publication371';
import {complexFootprints} from './complex-footprints.js?v=publication371';
import {forecourtWalkRoute} from './forecourt-walking-layout.js?v=publication371';
import {frontageGroundHeight} from './forecourt-ground.js?v=publication371';

function routeCurve(route){
 const points=route.points.map(([x,z])=>new THREE.Vector3(x,.035,z));
 if(route.interpolation!=='polyline')return new THREE.CatmullRomCurve3(points,route.closed,'centripetal');
 const curve=new THREE.CurvePath();
 for(let i=1;i<points.length;i++)if(points[i].distanceToSquared(points[i-1])>1e-12)curve.add(new THREE.LineCurve3(points[i-1],points[i]));
 if(route.closed&&points.at(-1).distanceToSquared(points[0])>1e-12)curve.add(new THREE.LineCurve3(points.at(-1),points[0]));
 if(!curve.curves.length)throw new TypeError('Forecourt walking route needs at least one nonzero segment');
 return curve;
}
// Shared animated landscape for presentation and the resident's genplan.
export function createComplexLife(root){
 const life=new THREE.Group();life.name='Clouds, birds and residents';root.add(life);
 const cloudMat=new THREE.MeshStandardMaterial({color:0xf5f8fa,roughness:1,transparent:true,opacity:.67,depthWrite:false});const puffGeo=new THREE.SphereGeometry(1,14,9);const clouds=[];
 for(let i=0;i<7;i++){const g=new THREE.Group();g.name='Drifting cloud';const puffs=[[-12,0,0,13,4.2,7],[-3,2,1,11,6,8],[7,1,-2,12,5,7],[17,-1,0,9,3.4,6],[-1,-2,6,17,2.5,5]];for(const [x,y,z,sx,sy,sz] of puffs){const m=new THREE.Mesh(puffGeo,cloudMat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m)}g.position.set(-50+i*40,140+(i%3)*11,150+(i%3)*35);g.scale.setScalar(.55+(i%3)*.14);life.add(g);clouds.push({g,x:g.position.x,z:g.position.z,speed:1.4+(i%3)*.35})}
 const birdMat=new THREE.MeshStandardMaterial({color:0x34434b,roughness:1,side:THREE.DoubleSide});const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.08,.95,0,-.12,.48,0,-.43],3));wingGeo.computeVertexNormals();const birds=[];const birdBodyGeo=new THREE.SphereGeometry(.13,6,4);
 for(let i=0;i<9;i++){const g=new THREE.Group();g.name='Bird in flight';const body=new THREE.Mesh(birdBodyGeo,birdMat);body.scale.set(.6,.6,2.2);g.add(body);const l=new THREE.Mesh(wingGeo,birdMat),r=new THREE.Mesh(wingGeo,birdMat);l.scale.x=-1;g.add(l,r);g.scale.setScalar(1.05+(i%3)*.14);life.add(g);birds.push({g,l,r,phase:i*.57,flap:4.5+(i%3),height:106+(i%4)*6})}
 // Retain the two established courtyard/eastern routes. The public promenade
 // route was rebuilt against real planting, furnishings and carriageways.
 const routes=[...complexFootprints.walkRoutes.slice(0,2),forecourtWalkRoute].map(r=>({...r,curve:routeCurve(r)}));
 const pathMat=new THREE.MeshStandardMaterial({color:0xd7d4c8,roughness:1});
 for(const route of routes.filter(r=>r.drawSurface!==false)){const positions=[],normals=[];for(let i=0;i<150;i++){const section=[];for(const n of [i,i+1]){const p=route.curve.getPoint(n/150),v=route.curve.getTangent(n/150);section.push([p.x-v.z*1.35,.018,p.z+v.x*1.35],[p.x+v.z*1.35,.018,p.z-v.x*1.35])}for(const idx of [0,2,1,1,2,3]){positions.push(...section[idx]);normals.push(0,1,0)}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));const path=new THREE.Mesh(geo,pathMat);path.receiveShadow=true;path.name='Pedestrian path';life.add(path)}
 const makeResident=residentFactory(),walkers=[];
 for(let i=0;i<40;i++){const person=makeResident(i),route=routes[i%routes.length];life.add(person.g);walkers.push({...person,route,offset:(i*.381966)%1,speed:(.65+(i%4)*.11)/route.curve.getLength(),phase:i*1.7})}
 // Instance identical parts so 40 walkers and cloud clusters remain inexpensive on a phone.
 const skyGeometries=new Set([puffGeo.uuid,wingGeo.uuid,...birds.map(b=>b.g.children[0].geometry.uuid)]);const buckets=new Map();life.traverse(o=>{if(!o.isMesh||o.name==='Pedestrian path')return;const palette=!!o.userData.residentPalette;const key=o.geometry.uuid+(palette?"resident-palette":o.material.uuid);let bucket=buckets.get(key);if(!bucket){bucket={geometry:o.geometry,material:palette?o.material.clone():o.material,palette,objects:[],sky:skyGeometries.has(o.geometry.uuid)};if(palette)bucket.material.color.set(0xffffff);buckets.set(key,bucket)}bucket.objects.push(o);o.visible=false});
 for(const bucket of buckets.values()){bucket.mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.objects.length);if(bucket.palette)bucket.objects.forEach((o,i)=>bucket.mesh.setColorAt(i,o.material.color));bucket.mesh.castShadow=bucket.objects.some(o=>o.castShadow);bucket.mesh.receiveShadow=!bucket.sky;if(bucket.sky)bucket.mesh.userData.excludeFromSolarShadow=true;bucket.mesh.frustumCulled=false;life.add(bucket.mesh)}
 const inverse=new THREE.Matrix4(),instanceMatrix=new THREE.Matrix4();
 const p=new THREE.Vector3(),v=new THREE.Vector3();let enabled=true,elapsed=0,lastSeconds=null;let viewer=null;const closeFigure=new THREE.Vector3();
 let weather={cloudCover:35,windDirection:225,windSpeed:2};
 function update(seconds){if(!Number.isFinite(seconds))return;if(lastSeconds!==null&&enabled)elapsed+=Math.max(0,seconds-lastSeconds);lastSeconds=seconds;const t=elapsed;for(const c of clouds){const wind=direction(weather.windDirection+180,0,Math.max(.4,weather.windSpeed*.5));c.g.position.x=((c.x+220+t*wind[0]*c.speed)%440+440)%440-220;c.g.position.z=((c.z+220+t*wind[2]*c.speed)%440+440)%440-220}for(const b of birds){const a=t*.08+b.phase;b.g.position.set(Math.sin(a)*95, b.height+Math.sin(a*2)*3,Math.cos(a)*79-20);b.g.rotation.y=Math.atan2(Math.cos(a)*95,-Math.sin(a)*79);b.g.rotation.z=Math.sin(a)*.14;const f=Math.sin(t*b.flap+b.phase)*.65;b.l.rotation.z=-f;b.r.rotation.z=f}for(const w of walkers){let progress=w.offset+t*w.speed;let direction=1;if(w.route.closed)progress%=1;else{const part=progress%2;if(part>1){progress=2-part;direction=-1}else progress=part}w.route.curve.getPoint(progress,p);w.route.curve.getTangent(progress,v);if(w.route.sampleGround)p.y=frontageGroundHeight(p.x,p.z)+.035;w.g.position.copy(p);w.g.position.y+=.006+Math.abs(Math.sin(t*5+w.phase))*.009;w.g.userData.hideNearViewer=!!viewer&&viewer.y<12&&Math.hypot(w.g.position.x-viewer.x,w.g.position.z-viewer.z)<2.7;w.g.rotation.y=Math.atan2(v.x*direction,v.z*direction);const swing=Math.sin(t*5.3+w.phase)*.32;w.ll.rotation.x=swing;w.rl.rotation.x=-swing;w.la.rotation.x=-swing*.8;w.ra.rotation.x=swing*.8;w.knees[0].rotation.x=Math.max(0,-Math.sin(t*5.3+w.phase))*.45;w.knees[1].rotation.x=Math.max(0,Math.sin(t*5.3+w.phase))*.45;w.elbows[0].rotation.x=-.17-Math.max(0,swing)*.2;w.elbows[1].rotation.x=-.17-Math.max(0,-swing)*.2;w.head.rotation.y=Math.sin(t*.35+w.phase)*.13}life.updateMatrixWorld(true);inverse.copy(life.matrixWorld).invert();for(const bucket of buckets.values()){bucket.objects.forEach((o,i)=>{instanceMatrix.multiplyMatrices(inverse,o.matrixWorld);if(bucket.palette){let figure=o;while(figure.parent&&figure.parent!==life)figure=figure.parent;if(figure.userData.hideNearViewer)instanceMatrix.scale(closeFigure.setScalar(0));}bucket.mesh.setMatrixAt(i,instanceMatrix)});bucket.mesh.instanceMatrix.needsUpdate=true}}
 update(0);return{pathMaterial:pathMat,group:life,clouds,birds,walkers,routes,update,setViewer(camera){viewer=camera?.position??null;},setSkyVisible(value){for(const bucket of buckets.values())if(bucket.sky)bucket.mesh.visible=!!value},setEnabled(value){enabled=!!value;update(lastSeconds??0)},setWeather(value){weather={...weather,...value};cloudMat.opacity=Math.max(0,Math.min(.85,weather.cloudCover/100*.8))},get enabled(){return enabled},get time(){return elapsed}};
}
