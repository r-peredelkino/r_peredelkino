// Camera fitting for parallel sunlight. Scene geometry and solar angles remain
// unchanged. A receiver and the object shading it have identical light-space XY.
import * as THREE from './vendor/three.module.js';

const edgeIndices=[];
for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))edgeIndices.push([i,i|bit]);
const finiteBox=box=>box?.isBox3&&!box.isEmpty()&&[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite);
const boxCorners=box=>{
 const points=[];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));
 return points;
};
const boxPlanes=box=>[
 new THREE.Plane(new THREE.Vector3(1,0,0),-box.min.x),new THREE.Plane(new THREE.Vector3(-1,0,0),box.max.x),
 new THREE.Plane(new THREE.Vector3(0,1,0),-box.min.y),new THREE.Plane(new THREE.Vector3(0,-1,0),box.max.y),
 new THREE.Plane(new THREE.Vector3(0,0,1),-box.min.z),new THREE.Plane(new THREE.Vector3(0,0,-1),box.max.z)
];

function clipEdge(a,b,planes,out){
 let begin=0,end=1;
 for(const plane of planes){
  const first=plane.distanceToPoint(a),last=plane.distanceToPoint(b);
  if(first< -1e-9&&last< -1e-9)return;
  if(first>=-1e-9&&last>=-1e-9)continue;
  const t=first/(first-last);
  if(first<0)begin=Math.max(begin,t);else end=Math.min(end,t);
  if(begin>end)return;
 }
 out.push(a.clone().lerp(b,begin),a.clone().lerp(b,end));
}

/**
 * Vertices of the intersection of a camera frustum and a receiver AABB.
 * Clipping both sets of twelve edges covers all intersection vertex types:
 * an input vertex, a frustum edge crossing a box face, or the reverse.
 */
export function solarShadowReceiverPoints(camera,receiverBounds){
 if(!finiteBox(receiverBounds))throw new TypeError('Finite receiver bounds are required');
 if(!camera)return{points:boxCorners(receiverBounds),visible:true};
 camera.updateWorldMatrix(true,false);
 const projection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const frustum=new THREE.Frustum().setFromProjectionMatrix(projection,camera.coordinateSystem);
 const near=camera.coordinateSystem===THREE.WebGPUCoordinateSystem?0:-1;
 const frustumCorners=[];
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [near,1])frustumCorners.push(new THREE.Vector3(x,y,z).unproject(camera));
 if(frustumCorners.some(point=>!point.toArray().every(Number.isFinite)))throw new RangeError('A finite camera frustum is required');
 const receiverCorners=boxCorners(receiverBounds),planes=boxPlanes(receiverBounds),points=[];
 for(const [a,b] of edgeIndices){
  clipEdge(receiverCorners[a],receiverCorners[b],frustum.planes,points);
  clipEdge(frustumCorners[a],frustumCorners[b],planes,points);
 }
 return{points,visible:points.length>0};
}

/**
 * Scan static geometry once after construction. Instanced bounds use their
 * matrices; geometry vertices are not traversed by fit(). Conservative hidden
 * seasonal/selection geometry is included by default. Recollect after changing
 * the source geometry or when moving a caster outside the captured envelope.
 */
export function collectSolarShadowBounds(root,{includeInvisible=true,padding=.5,ignore=null}={}){
 if(!root?.traverse)throw new TypeError('A THREE.Object3D root is required');
 if(!Number.isFinite(padding)||padding<0)throw new RangeError('Bounds padding must be non-negative');
 root.updateWorldMatrix(true,true);
 const casterBounds=new THREE.Box3(),receiverBounds=new THREE.Box3(),invalid=[];
 let casterMeshes=0,receiverMeshes=0,emptyMeshes=0;
 root.traverse(object=>{
  if(!object.isMesh||!object.geometry||(!object.castShadow&&!object.receiveShadow)||ignore?.(object)||object.userData.excludeFromSolarShadow)return;
  if(!includeInvisible){for(let ancestor=object;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;}
  if(object.isInstancedMesh&&object.count===0){emptyMeshes++;return;}
  if(!object.geometry.attributes.position?.count){emptyMeshes++;return;}
  let local;
  if(object.isInstancedMesh){object.computeBoundingBox();local=object.boundingBox;}
  else{if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();local=object.geometry.boundingBox;}
  if(!finiteBox(local)){invalid.push(object.name||object.type);return;}
  const world=local.clone().applyMatrix4(object.matrixWorld);
  if(!finiteBox(world)){invalid.push(object.name||object.type);return;}
  if(object.castShadow){casterBounds.union(world);casterMeshes++;}
  if(object.receiveShadow){receiverBounds.union(world);receiverMeshes++;}
 });
 if(invalid.length)throw new RangeError(`Non-finite shadow geometry bounds: ${invalid.slice(0,4).join(', ')}`);
 if(!finiteBox(casterBounds)||!finiteBox(receiverBounds))throw new RangeError('Scene must contain bounded shadow casters and receivers');
 casterBounds.expandByScalar(padding);receiverBounds.expandByScalar(padding);
 return{casterBounds,receiverBounds,maxCasterY:casterBounds.max.y,metadata:{casterMeshes,receiverMeshes,emptyMeshes,padding,includeInvisible,computedOnce:true}};
}

function setWorldPosition(object,world){
 if(object.parent){object.parent.updateWorldMatrix(true,false);object.position.copy(object.parent.worldToLocal(world.clone()));}
 else object.position.copy(world);
 object.updateWorldMatrix(true,false);
}

/**
 * Fit one directional shadow camera to the visible receivers. XY fit and depth
 * fit are intentionally independent: the full caster depth prevents a remote
 * building roof from disappearing at low sun. Unseen regions consume no XY.
 *
 * API: createSolarShadowCameraFitter(light, collectSolarShadowBounds(model.root))
 *      fitter.fit({camera, direction: [x,y,z]});
 *      fitter.setBounds({casterBounds,receiverBounds}); // after geometry changes
 * Options: xyPadding, depthPadding, minSpan, extentQuantum, shrinkThreshold.
 */
export function createSolarShadowCameraFitter(light,{
 casterBounds,receiverBounds,xyPadding=1.5,depthPadding=8,minSpan=12,
 extentQuantum=1.025,shrinkThreshold=.88,square=true
}={}){
 if(!light?.isDirectionalLight||!light.shadow?.camera?.isOrthographicCamera)throw new TypeError('A shadowed directional light is required');
 if(!finiteBox(casterBounds)||!finiteBox(receiverBounds))throw new TypeError('Finite caster and receiver bounds are required');
 if(!Number.isFinite(xyPadding)||xyPadding<0||!Number.isFinite(depthPadding)||depthPadding<=0||!Number.isFinite(minSpan)||minSpan<=0||!Number.isFinite(extentQuantum)||extentQuantum<=1||!Number.isFinite(shrinkThreshold)||shrinkThreshold<=0||shrinkThreshold>1)throw new RangeError('Invalid shadow camera fitting options');
 let casters=casterBounds.clone(),receivers=receiverBounds.clone(),casterCorners=boxCorners(casters),lastWidth=0,lastHeight=0,state=null;
 let cachedCamera=null,cachedMatrix=new THREE.Matrix4(),cachedProjection=new THREE.Matrix4(),cachedReceiverBounds=null,cachedIntersection=null;
 const n=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),worldUp=new THREE.Vector3(0,1,0),position=new THREE.Vector3(),target=new THREE.Vector3();
 const quantize=required=>Math.pow(extentQuantum,Math.ceil(Math.log(required)/Math.log(extentQuantum)));
 const stabilized=(required,previous)=>previous>=required&&required>previous*shrinkThreshold?previous:quantize(required);
 function setBounds({casterBounds:nextCasters,receiverBounds:nextReceivers}){
  if(!finiteBox(nextCasters)||!finiteBox(nextReceivers))throw new TypeError('Finite caster and receiver bounds are required');
  casters.copy(nextCasters);receivers.copy(nextReceivers);casterCorners=boxCorners(casters);cachedIntersection=null;cachedReceiverBounds=null;lastWidth=lastHeight=0;
 }
 function fit({camera=null,direction,receiverBounds:override=null}={}){
  if(direction?.isVector3)n.copy(direction);else if(Array.isArray(direction)||ArrayBuffer.isView(direction))n.fromArray(direction);else throw new TypeError('A solar direction vector is required');
  if(!n.toArray().every(Number.isFinite)||n.lengthSq()<1e-16)throw new RangeError('Invalid solar direction');
  n.normalize();
  right.crossVectors(worldUp,n);
  // The public site never reaches zenith, but keep the generic helper finite.
  if(right.lengthSq()<1e-14)right.set(1,0,0);else right.normalize();
  up.crossVectors(n,right).normalize();
  const current=override||receivers;
  if(!finiteBox(current))throw new TypeError('Finite receiver bounds are required');
  if(camera)camera.updateWorldMatrix(true,false);
  const reusable=cachedIntersection&&cachedCamera===camera&&cachedReceiverBounds?.equals(current)&&(!camera||(cachedMatrix.equals(camera.matrixWorld)&&cachedProjection.equals(camera.projectionMatrix)));
  let intersection;
  if(reusable)intersection=cachedIntersection;
  else{
   intersection=solarShadowReceiverPoints(camera,current);cachedIntersection=intersection;cachedCamera=camera;cachedReceiverBounds=current.clone();
   if(camera){cachedMatrix.copy(camera.matrixWorld);cachedProjection.copy(camera.projectionMatrix);}
  }
  // Sky-only views have no shadow receivers. Keep a valid light transform by
  // using the complete supplied receiver envelope until surfaces return.
  const points=intersection.visible?intersection.points:boxCorners(current);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const point of points){const x=point.dot(right),y=point.dot(up),z=point.dot(n);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
  for(const point of casterCorners){const z=point.dot(n);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
  const pixelsX=Math.max(16,light.shadow.mapSize.x),pixelsY=Math.max(16,light.shadow.mapSize.y),guardTexels=2;
  let width=Math.max(minSpan,(maxX-minX+2*xyPadding)/(1-2*guardTexels/pixelsX));
  let height=Math.max(minSpan,(maxY-minY+2*xyPadding)/(1-2*guardTexels/pixelsY));
  if(square)width=height=Math.max(width,height);
  width=stabilized(width,lastWidth);height=stabilized(height,lastHeight);
  if(square)width=height=Math.max(width,height);
  lastWidth=width;lastHeight=height;
  const texelX=width/pixelsX,texelY=height/pixelsY;
  const centerX=Math.round((minX+maxX)/2/texelX)*texelX,centerY=Math.round((minY+maxY)/2/texelY)*texelY;
  const near=.1,originZ=maxZ+depthPadding+near,far=Math.max(near+1,originZ-minZ+depthPadding);
  position.copy(right).multiplyScalar(centerX).addScaledVector(up,centerY).addScaledVector(n,originZ);
  target.copy(position).addScaledVector(n,-1);
  setWorldPosition(light,position);setWorldPosition(light.target,target);
  const shadowCamera=light.shadow.camera;
  // Use the same explicit basis at zenith as the fitting calculation.
  shadowCamera.up.copy(up);
  Object.assign(shadowCamera,{left:-width/2,right:width/2,bottom:-height/2,top:height/2,near,far});
  shadowCamera.updateProjectionMatrix();light.shadow.updateMatrices(light);
  state={receiverVisible:intersection.visible,receiverVertexCount:points.length,worldDirection:n.toArray(),lightSpaceRight:right.toArray(),lightSpaceUp:up.toArray(),receiverLightBounds:[minX,maxX,minY,maxY],casterAndReceiverLightDepth:[minZ,maxZ],width,height,near,far,texelWorld:[texelX,texelY],snappedLightCenter:[centerX,centerY,originZ],lightWorldPosition:position.toArray(),lightWorldTarget:target.toArray(),casterBounds:{min:casters.min.toArray(),max:casters.max.toArray()},receiverBounds:{min:current.min.toArray(),max:current.max.toArray()},geometryChanged:false};
  light.shadow.camera.userData.solarFit=state;
  return state;
 }
 return{fit,setBounds,getState:()=>state};
}
