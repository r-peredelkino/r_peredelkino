// Procedural daylight for the reconstructed 3D scene. This is not the source panorama.
import {stampGeometry} from './baked-authorship.js?v=community38';
import {attribution} from './attribution.js?v=community38';
import * as THREE from './vendor/three.module.js';
import {direction as geographicSunDirection} from './solar.js?v=community38';
import {collectSolarShadowBounds,createSolarShadowCameraFitter} from './solar-shadow-camera.js?v=community38';

export function createArchitecturalLighting(scene,renderer,{mobile=false,model=null,modelRoot=null,receiverBounds=null,shadowRegion='quarter'}={}){
 const ambient=new THREE.HemisphereLight(0xe4e9ec,0x95958b,.95);
 const sun=new THREE.DirectionalLight(0xfff0df,3.15);
 sun.name='Geographic sunlight with architectural shadows';sun.castShadow=true;
 sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;
 sun.shadow.mapSize.set(mobile?2048:4096,mobile?2048:4096);
 Object.assign(sun.shadow.camera,{left:-190,right:190,top:190,bottom:-190,near:1,far:1100});
 sun.shadow.bias=-.0000001;sun.shadow.normalBias=.001;
 sun.shadow.camera.updateProjectionMatrix();
 scene.add(ambient,sun,sun.target);
 const uniforms={day:{value:1},cloud:{value:.08},sunDirection:{value:new THREE.Vector3(-.3,.8,-.5).normalize()}};
 const material=new THREE.ShaderMaterial({
  uniforms,side:THREE.BackSide,depthWrite:false,depthTest:false,
  vertexShader:'varying vec3 vSkyDirection; void main(){vSkyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec3 vSkyDirection;uniform float day;uniform float cloud;uniform vec3 sunDirection;
   void main(){
    vec3 d=normalize(vSkyDirection);float up=max(d.y,0.0),h=pow(1.0-up,.65);
    vec3 blue=mix(vec3(.21,.39,.64),vec3(.77,.82,.85),h);
    vec3 gray=mix(vec3(.48,.54,.61),vec3(.73,.77,.79),h);
    vec3 sky=mix(blue,gray,cloud*.87);
    float haze=pow(max(dot(d,sunDirection),0.0),32.0);
    sky+=vec3(.27,.23,.16)*haze*(1.0-cloud);
    vec3 ground=vec3(.20,.22,.19);
    vec3 daylight=mix(ground,sky,smoothstep(-.10,.025,d.y));
    vec3 night=mix(vec3(.006,.009,.016),vec3(.014,.024,.050),max(d.y,0.0));
    gl_FragColor=vec4(mix(night,daylight,day),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const geometry=new THREE.SphereGeometry(1,32,16);stampGeometry(geometry,{mutable:true,label:'daylight-sky'});material.userData.attribution={...attribution};
 const sky=new THREE.Mesh(geometry,material);sky.name='Continuous daylight sky';sky.userData.attribution={...attribution};sky.scale.setScalar(1400);sky.frustumCulled=false;sky.renderOrder=-10000;scene.add(sky);
 const radianceScene=new THREE.Scene(),radianceSky=new THREE.Mesh(geometry,material);radianceSky.scale.setScalar(10);radianceScene.add(radianceSky);
 const generator=new THREE.PMREMGenerator(renderer);
 let environmentTarget=null,environmentKey='',dead=false,bounds=null,fitter=null,region=shadowRegion,customReceivers=receiverBounds?.clone()??null,receiverRegions={},lastElevation=45,shadowDirty=true;
 let lastFitAt=-Infinity,lastDrawAt=-Infinity,lastCamera=null,shadowInterval=100,fitCount=0,redrawCount=0;
 const fittedCameraWorld=new THREE.Matrix4(),fittedProjection=new THREE.Matrix4(),nextSolarDirection=new THREE.Vector3();
 const solarDirection=new THREE.Vector3(-.3,.8,-.5).normalize();
 const belongsTo=(object,parent)=>{if(!parent)return false;for(let node=object;node;node=node.parent)if(node===parent)return true;return false;};
 function refreshBounds(root=modelRoot||model?.root||scene,override=undefined){
  if(dead)return;shadowDirty=true;modelRoot=root;if(override!==undefined)customReceivers=override?.clone()??null;
  bounds=collectSolarShadowBounds(root);
  // Traffic occupies a fixed lane envelope. Include all route samples once so
  // a moving vehicle remains a caster even beyond its construction-time pose.
  for(const lane of model?.traffic?.lanes??[])for(const p of lane.pointsWorld??[]){const x=p.x??p[0],y=p.y??p[1],z=p.z??p[2];if([x,y,z].every(Number.isFinite)){bounds.casterBounds.expandByPoint(new THREE.Vector3(x-4,y-2,z-4));bounds.casterBounds.expandByPoint(new THREE.Vector3(x+4,y+5,z+4));}}
  receiverRegions={all:bounds.receiverBounds};
  if(model?.neighborhood){
   const {group:district,forestGroup,roadside}=model.neighborhood,traffic=model.traffic?.group;
   const districtBounds=collectSolarShadowBounds(root,{ignore:o=>belongsTo(o,forestGroup)}).receiverBounds;
   const quarterBounds=collectSolarShadowBounds(root,{ignore:o=>!belongsTo(o,roadside?.group)&&(belongsTo(o,district)||belongsTo(o,forestGroup)||belongsTo(o,traffic))}).receiverBounds;
   receiverRegions={all:bounds.receiverBounds,district:districtBounds,quarter:quarterBounds};
  }
  const selected=customReceivers||receiverRegions[region]||bounds.receiverBounds;
  if(fitter)fitter.setBounds({casterBounds:bounds.casterBounds,receiverBounds:selected});
  else fitter=createSolarShadowCameraFitter(sun,{casterBounds:bounds.casterBounds,receiverBounds:selected});
  return getBounds();
 }
 function getBounds(){return{region,custom:!!customReceivers,casters:bounds?.casterBounds.clone(),receivers:(customReceivers||receiverRegions[region]||bounds?.receiverBounds)?.clone(),regions:receiverRegions};}
 function setRegion(value){if(!['quarter','district','all'].includes(value))throw new RangeError('Unknown sunlight shadow region');if(region!==value){region=value;shadowDirty=true;}return getBounds();}
 function setQuality(profile={}){
  if(dead)return;
  const size=Math.max(512,Math.min(4096,Number(profile.shadowSize)||2048));
  shadowInterval=1000/Math.max(1,Math.min(30,Number(profile.shadowHz)||8));
  if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();sun.shadow.map=null;sun.shadow.mapPass=null;shadowDirty=true;sun.shadow.needsUpdate=true;}
 }
 function focus(camera){
  if(dead||!camera)return;model?.neighborhood?.setViewer?.(camera);
  sky.position.copy(camera.position);sky.scale.setScalar(Math.min(camera.far*.88,1400));
  if(!fitter)refreshBounds();
  const now=performance.now();camera.updateWorldMatrix(true,false);
  const cameraChanged=lastCamera!==camera||!fittedCameraWorld.equals(camera.matrixWorld)||!fittedProjection.equals(camera.projectionMatrix);
  const refit=shadowDirty||(cameraChanged&&now-lastFitAt>=80);
  if(refit){
   lastFitAt=now;shadowDirty=false;lastCamera=camera;fittedCameraWorld.copy(camera.matrixWorld);fittedProjection.copy(camera.projectionMatrix);fitCount++;
   fitter.fit({camera,direction:solarDirection,receiverBounds:customReceivers||receiverRegions[region]||bounds.receiverBounds});
  }
  const dynamic=!!model?.life?.enabled||!!model?.traffic?.enabled;
  const redraw=sun.castShadow&&(refit||(dynamic&&now-lastDrawAt>=shadowInterval));
  if(redraw){lastDrawAt=now;redrawCount++;sun.shadow.needsUpdate=true;}
  const fit=fitter.getState();if(!fit)return;
  // Keep the geometric displacement small at low altitude. The old constant
  // normalBias moved a sunrise shadow by metres even with the right sun angle.
  const sine=Math.max(0,Math.sin(lastElevation*Math.PI/180));
  sun.shadow.normalBias=.003*sine;
  sun.shadow.bias=-Math.max(1e-7,.008*sine/(fit.far-fit.near));
  const diagnostics=scene.userData.architecturalLighting??={};Object.assign(diagnostics,{shadowMap:sun.shadow.mapSize.x,shadowRegion:customReceivers?'selected-surface':region,environment:true,referencePanorama:false,shadowFit:fit,bias:sun.shadow.bias,normalBias:sun.shadow.normalBias,fitCount,redrawCount,dynamicShadowHz:1000/shadowInterval});
 }
 function set({elevation=45,azimuth=180,cloudCover=8,direction=null}={}){
  if(dead)return;
  const day=THREE.MathUtils.clamp((elevation+7)/12,0,1),cloud=THREE.MathUtils.clamp(cloudCover/100,0,1);
  if(direction?.isVector3)nextSolarDirection.copy(direction).normalize();
  else if(direction)nextSolarDirection.set(...direction).normalize();
  else nextSolarDirection.set(...geographicSunDirection(azimuth,elevation));
  if(solarDirection.distanceToSquared(nextSolarDirection)>1e-14||sun.castShadow!==(elevation>0))shadowDirty=true;
  solarDirection.copy(nextSolarDirection);lastElevation=elevation;sun.castShadow=elevation>0;
  uniforms.day.value=day;uniforms.cloud.value=cloud;uniforms.sunDirection.value.copy(solarDirection);
  ambient.intensity=.18+day*.48;ambient.color.set(day<.1?0x8fa4c2:0xe3e8ec);ambient.groundColor.set(day<.1?0x414956:0x99988a);
  sun.intensity=elevation<=0?0:(1.1+2.8*Math.max(0,Math.sin(elevation*Math.PI/180)))*(1-cloud*.77);
  sun.color.set(elevation<12?0xffcba0:0xfff0df);
  const key=[Math.round(day*10),Math.round(cloud*5),Math.round(elevation/8),Math.round(azimuth/20)].join(':');
  if(key!==environmentKey){
   const next=generator.fromScene(radianceScene,.035,.1,30);
   next.texture.name='Analytic sky radiance for facade reflections';scene.environment=next.texture;
   environmentTarget?.dispose();environmentTarget=next;environmentKey=key;
  }
  scene.environmentIntensity=.20+day*.30;
 }
 return{ambient,sun,sky,set,focus,refreshBounds,getBounds,setRegion,setQuality,getShadowState:()=>fitter?.getState(),dispose(){if(dead)return;dead=true;scene.remove(ambient,sun,sun.target,sky);if(scene.environment===environmentTarget?.texture)scene.environment=null;environmentTarget?.dispose();generator.dispose();geometry.dispose();material.dispose();sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();}};
}
