// Procedural daylight for the reconstructed 3D scene. This is not the source panorama.
import {stampGeometry} from './baked-authorship.js?v=references37';
import {attribution} from './attribution.js?v=references37';
import * as THREE from './vendor/three.module.js';
import {direction as geographicSunDirection} from './solar.js?v=references37';
import {collectSolarShadowBounds,createSolarShadowCameraFitter} from './solar-shadow-camera.js?v=references37';

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
 let environmentTarget=null,environmentKey='',dead=false,bounds=null,fitter=null,region=shadowRegion,customReceivers=receiverBounds?.clone()??null,receiverRegions={},lastElevation=45,lastShadowAt=-Infinity,shadowDirty=true;
 const solarDirection=new THREE.Vector3(-.3,.8,-.5).normalize();
 const belongsTo=(object,parent)=>{if(!parent)return false;for(let node=object;node;node=node.parent)if(node===parent)return true;return false;};
 function refreshBounds(root=modelRoot||model?.root||scene,override=undefined){
  if(dead)return;shadowDirty=true;modelRoot=root;if(override!==undefined)customReceivers=override?.clone()??null;
  bounds=collectSolarShadowBounds(root);
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
 function setRegion(value){if(!['quarter','district','all'].includes(value))throw new RangeError('Unknown sunlight shadow region');region=value;shadowDirty=true;return getBounds();}
 function focus(camera){
  if(dead||!camera)return;model?.neighborhood?.setViewer?.(camera);
  sky.position.copy(camera.position);sky.scale.setScalar(Math.min(camera.far*.88,1400));
  if(!fitter)refreshBounds();
  const now=performance.now();if(!shadowDirty&&now-lastShadowAt<100)return;
  lastShadowAt=now;shadowDirty=false;sun.shadow.needsUpdate=true;
  const fit=fitter.fit({camera,direction:solarDirection,receiverBounds:customReceivers||receiverRegions[region]||bounds.receiverBounds});
  // Keep the geometric displacement small at low altitude. The old constant
  // normalBias moved a sunrise shadow by metres even with the right sun angle.
  const sine=Math.max(0,Math.sin(lastElevation*Math.PI/180));
  sun.shadow.normalBias=.003*sine;
  sun.shadow.bias=-Math.max(1e-7,.008*sine/(fit.far-fit.near));
  scene.userData.architecturalLighting={shadowMap:sun.shadow.mapSize.x,shadowRegion:customReceivers?'selected-surface':region,environment:true,referencePanorama:false,shadowFit:fit,bias:sun.shadow.bias,normalBias:sun.shadow.normalBias};
 }
 function set({elevation=45,azimuth=180,cloudCover=8,direction=null}={}){
  if(dead)return;
  const day=THREE.MathUtils.clamp((elevation+7)/12,0,1),cloud=THREE.MathUtils.clamp(cloudCover/100,0,1);
  if(direction?.isVector3)solarDirection.copy(direction).normalize();
  else if(direction)solarDirection.set(...direction).normalize();
  else solarDirection.set(...geographicSunDirection(azimuth,elevation));
  lastElevation=elevation;sun.castShadow=elevation>0;shadowDirty=true;
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
 return{ambient,sun,sky,set,focus,refreshBounds,getBounds,setRegion,getShadowState:()=>fitter?.getState(),dispose(){dead=true;scene.remove(ambient,sun,sun.target,sky);if(scene.environment===environmentTarget?.texture)scene.environment=null;environmentTarget?.dispose();generator.dispose();geometry.dispose();material.dispose();sun.shadow.map?.dispose();}};
}
