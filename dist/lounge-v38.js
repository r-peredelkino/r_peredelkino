// @r_peredelkino · optional quiet outdoor concept; existing architecture is retained.
import * as THREE from './vendor/three.module.js';
import {createGroundWalkWorld} from './pedestrian-navigation-v38.js?v=community38';
import {frontageGroundHeight} from './forecourt-ground.js?v=community38';
import {complexFootprints} from './complex-footprints.js?v=community38';
import {solidContains} from './walk-physics.js?v=community38';

export const quietLoungeConcept=Object.freeze({revision:38,author:'@r_peredelkino',name:'Тихая гостиная',authoredConcept:true,sourceArea:'courtyard',architecturalChanges:false,pavingChanges:false,plantingChanges:false,brief:'Warm timber, restrained bronze, slatted shade and shared seating inspired by outdoor hospitality spaces',seed:[27,52],maximumSearchDistance:3,canopy:{width:5,depth:2.8,height:2.9},maximumDrawCalls:7,maximumTriangles:20_000});

function timberTexture(){
 const width=128,height=64,data=new Uint8Array(width*height*4);let seed=38321;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=Math.sin(y*.73+Math.sin(x*.05)*.36)*.032+Math.sin(y*2.3+x*.019)*.024,tone=.94+grain+(seed/4294967296-.5)*.025,at=(y*width+x)*4;data.set([Math.round(249*tone),Math.round(242*tone),Math.round(225*tone),255],at);}
 const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.name='Quiet lounge warm ash grain · @r_peredelkino';texture.userData={authored:true,attribution:{handle:'@r_peredelkino'}};texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
function box(width,height,depth,x,y,z){const geometry=new THREE.BoxGeometry(width,height,depth);geometry.translate(x,y,z);return geometry;}
function cylinder(top,bottom,height,x,y,z,segments=16){const geometry=new THREE.CylinderGeometry(top,bottom,height,segments);geometry.translate(x,y,z);return geometry;}
function ring(radius,tube,x,y,z){const geometry=new THREE.TorusGeometry(radius,tube,4,20);geometry.rotateX(Math.PI/2);geometry.translate(x,y,z);return geometry;}
function merge(parts){
 const expanded=parts.map(source=>source.index?source.toNonIndexed():source),vertices=expanded.reduce((n,geometry)=>n+geometry.attributes.position.count,0),position=new Float32Array(vertices*3),normal=new Float32Array(vertices*3),uv=new Float32Array(vertices*2);let at=0;
 for(let i=0;i<expanded.length;i++){const geometry=expanded[i];position.set(geometry.attributes.position.array,at*3);normal.set(geometry.attributes.normal.array,at*3);if(geometry.attributes.uv)uv.set(geometry.attributes.uv.array,at*2);at+=geometry.attributes.position.count;if(geometry!==parts[i])geometry.dispose();parts[i].dispose();}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function findPlacement(model){
 const world=createGroundWalkWorld(model,{radius:.55}),seed=quietLoungeConcept.seed,candidates=[seed];
 for(let distance=.5;distance<=quietLoungeConcept.maximumSearchDistance;distance+=.5)for(let i=0;i<24;i++){const angle=i/24*Math.PI*2;candidates.push([seed[0]+Math.cos(angle)*distance,seed[1]+Math.sin(angle)*distance]);}
 for(const [x,z] of candidates){let clear=true;
  // Check the entire furniture/shade envelope with the final strict ground
  // model, rather than checking only its centre or an approximate shrub map.
  for(let dx=-2.55;dx<=2.55+.001&&clear;dx+=.255)for(let dz=-1.55;dz<=1.55+.001;dz+=.2583333333333333)if(!world.free(x+dx,z+dz)||!solidContains(x+dx,z+dz,complexFootprints.fan)){clear=false;break;}
  if(!clear||!world.free(x,z-1.85))continue;
  return{point:[x,z],ground:frontageGroundHeight(x,z),searchDistance:Math.hypot(x-seed[0],z-seed[1]),clearanceRadius:world.radius,envelope:[5.1,3.1],underTracedFan:true};
 }
 return null;
}

export function createQuietLounge(model){
 const group=new THREE.Group();group.name='Quiet lounge · warm timber, bronze and slatted shade';model.root.add(group);
 const placement=findPlacement(model),colliders=[],interactions=[],benchAnchors=[],resources={geometries:new Set(),materials:new Set(),textures:new Set()};let visible=!!placement,disposed=false,lightMaterial=null;
 const metadata={...quietLoungeConcept,placement,drawCalls:0,triangles:0,seatCount:0,resourceOwnership:{geometry:'parent scene traversal',materials:'parent scene traversal',woodTexture:'lounge helper'},skipped:placement?null:'No clear furniture envelope beneath the traced fan within the bounded search'};group.userData.concept=metadata;
 if(placement){
  const [cx,cz]=placement.point;group.position.set(cx,placement.ground,cz);const woodMap=timberTexture();resources.textures.add(woodMap);
  const materials={wood:new THREE.MeshStandardMaterial({color:0xb89062,map:woodMap,roughness:.64}),bronze:new THREE.MeshStandardMaterial({color:0x8c7356,metalness:.72,roughness:.34}),stone:new THREE.MeshStandardMaterial({color:0xc8bca5,roughness:.92}),fabric:new THREE.MeshStandardMaterial({color:0xe0d3bc,roughness:.91}),leaves:new THREE.MeshStandardMaterial({color:0x6e8467,roughness:.88}),light:new THREE.MeshStandardMaterial({color:0xffe4ae,emissive:0xffd398,emissiveIntensity:.08,roughness:.43}),charging:new THREE.MeshStandardMaterial({color:0x29312f,metalness:.4,roughness:.45})};
  lightMaterial=materials.light;for(const material of Object.values(materials))resources.materials.add(material);const parts=Object.fromEntries(Object.keys(materials).map(key=>[key,[]]));
  function obstacle(record){colliders.push({...record,x:(record.x??0)+cx,z:(record.z??0)+cz,enabled:true,source:'quiet-lounge-v38'});}
  // Four thin bronze posts and a fine frame keep the shade visually light.
  for(const x of [-2.39,2.39])for(const z of [-1.26,1.26]){parts.bronze.push(box(.066,2.77,.066,x,1.405,z),cylinder(.086,.094,.055,x,.0275,z));obstacle({type:'circle',x,z,radius:.10});}
  for(const z of [-1.32,1.32]){parts.bronze.push(box(5,.078,.045,0,2.79,z));parts.light.push(box(4.75,.012,.013,0,2.745,z));}
  for(const x of [-2.47,2.47])parts.bronze.push(box(.048,.078,2.68,x,2.79,0));
  for(let i=0;i<32;i++)parts.wood.push(box(.079,.095,2.8,-2.425+i*(4.85/31),2.8525,0));
  // A long bench has three real cushion surfaces at exactly 0.50 m.
  for(let i=0;i<8;i++)parts.wood.push(box(3.78,.048,.048,0,.443,.67+i*.07));
  for(const x of [-1.62,0,1.62]){parts.bronze.push(box(.055,.42,.055,x,.245,.72),box(.055,.84,.055,x,.47,1.17),box(.055,.055,.52,x,.404,.94));}
  for(let i=0;i<4;i++)parts.wood.push(box(3.78,.058,.039,0,.658+i*.083,1.178));
  for(const x of [-1.08,0,1.08])parts.fabric.push(box(.96,.046,.43,x,.477,.929));
  parts.bronze.push(box(3.45,.023,.025,0,.365,.662));parts.light.push(box(3.45,.009,.011,0,.357,.660));
  obstacle({type:'box',x:0,z:.94,width:3.85,depth:.65});
  // Two small shared charging tables leave the central walking strip open.
  for(const x of [-1.78,1.78]){const z=-.60;
   parts.bronze.push(cylinder(.024,.035,.67,x,.365,z),cylinder(.16,.19,.035,x,.0175,z));parts.stone.push(cylinder(.282,.272,.045,x,.7215,z));
   parts.charging.push(cylinder(.06,.06,.004,x,.746,z));parts.light.push(ring(.071,.0035,x,.748,z),box(.031,.008,.012,x+.07,.705,z+.264));obstacle({type:'circle',x,z,radius:.29});
  }
  // Compact planters use a restrained evergreen silhouette, without moving
  // or replacing any of the developer-reference planting.
  for(const x of [-2.01,2.01]){const z=-1.17;
   parts.stone.push(cylinder(.275,.226,.44,x,.22,z));parts.bronze.push(ring(.276,.010,x,.432,z));parts.charging.push(cylinder(.256,.256,.012,x,.440,z));
   for(let i=0;i<5;i++){const angle=i/5*Math.PI*2,dx=Math.cos(angle)*.085,dz=Math.sin(angle)*.085,h=.66+(i%3)*.07;parts.wood.push(cylinder(.012,.018,h-.45,x+dx,(h+.45)/2,z+dz,7));const crown=new THREE.SphereGeometry(.18,8,5);crown.scale(1,.78,1);crown.translate(x+dx,h,z+dz);parts.leaves.push(crown);}
   const tip=new THREE.SphereGeometry(.15,8,5);tip.scale(.84,1.15,.84);tip.translate(x,.88,z);parts.leaves.push(tip);obstacle({type:'circle',x,z,radius:.35});
  }
  for(const [key,geometries] of Object.entries(parts)){const geometry=merge(geometries),mesh=new THREE.Mesh(geometry,materials[key]);mesh.name='Quiet lounge merged '+key;mesh.castShadow=key!=='light'&&key!=='charging';mesh.receiveShadow=key!=='light';mesh.userData.authoredConcept=true;mesh.userData.noAutomaticCollider=true;resources.geometries.add(geometry);group.add(mesh);metadata.triangles+=geometry.attributes.position.count/3;metadata.drawCalls++;}
  const positions=[-1.08,0,1.08];positions.forEach((x,index)=>{const approach=[cx+x,cz-.03],seatPoint=[cx+x,cz+.93],lookAt=[cx+x,cz-2.2],seatHeight=placement.ground+.5,id='quiet-lounge-seat-'+(index+1);
   interactions.push({id,type:'seat',label:'Тихая гостиная · место '+(index+1),point:approach,seatPoint,seatHeight,lookAt,radius:2.2,elevation:frontageGroundHeight(...approach),authoredConcept:true,layer:'lounge',sourceArea:'courtyard'});
   benchAnchors.push({id,point:seatPoint.slice(),height:seatHeight,yaw:Math.PI,approach:approach.slice(),owner:'quietLounge',authoredConcept:true});
  });metadata.seatCount=interactions.length;
 }
 group.visible=visible;
 const destination=placement?{name:quietLoungeConcept.name,point:[placement.point[0],placement.point[1]-1.85],look:[placement.point[0],placement.point[1]+.92],heightAt:frontageGroundHeight,authoredConcept:true,layer:'lounge',sourceArea:'courtyard'}:null;
 function update(_seconds,{night=0}={}){if(disposed||!lightMaterial)return;lightMaterial.emissiveIntensity=.08+THREE.MathUtils.clamp(Number(night)||0,0,1)*1.1;}
 function setVisible(value){if(disposed)return;visible=!!value&&!!placement;group.visible=visible;for(const collider of colliders)collider.enabled=visible;}
 // The parent scene traverses geometry/materials after this helper runs.
 // Keep these meshes attached; only the helper-owned DataTexture is released.
 function dispose(){if(disposed)return;disposed=true;visible=false;group.visible=false;for(const collider of colliders)collider.enabled=false;for(const texture of resources.textures)texture.dispose();}
 return{group,colliders,interactions,destination,benchAnchors,metadata,resources,update,setVisible,dispose,get visible(){return visible},get disposed(){return disposed}};
}
