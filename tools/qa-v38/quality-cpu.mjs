import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=process.env.RP_PROJECT_DIR||fileURLToPath(new URL('../../',import.meta.url)),url=name=>pathToFileURL(path.join(project,'dist',name)).href;
const {createQualityController}=await import(url('quality-v38.js'));
const {forestProximity,createForestSound}=await import(url('forest-sound-v38.js'));
const checks=[],check=(name,pass,details={})=>checks.push({name,pass:!!pass,details});
const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
let ratio=2,forestMode='',lifeProfile=null,trafficProfile=null,shadowSize=0;
const renderer={getPixelRatio:()=>ratio,setPixelRatio:v=>{ratio=v;}},model={neighborhood:{forestBatches:[{setDetail:v=>{forestMode=v;}}]},life:{setQuality:v=>{lifeProfile=v;}},traffic:{setQuality:v=>{trafficProfile=v;}}},lighting={setQuality:v=>{shadowSize=v.shadowSize;}};
const controller=createQualityController({renderer,model,lighting,storage,pixelRatio:()=>2});
check('Auto begins with a bounded balanced profile without changing architecture',controller.getState().choice==='auto'&&controller.getState().effective==='balanced'&&ratio===1.35&&shadowSize===2048&&forestMode==='auto'&&lifeProfile.population===.7&&trafficProfile==='medium');
check('An unsupported choice leaves existing render state intact',controller.set('not-a-profile')===false&&controller.getState().choice==='auto');
controller.recordFrame(0);for(let t=50;t<=18000;t+=50)controller.recordFrame(t);
check('Sustained 50 ms frames reduce auto quality one step',controller.getState().effective==='fast'&&ratio===.9&&lifeProfile.population===.45&&trafficProfile==='low');
for(let t=18016;t<=42000;t+=16)controller.recordFrame(t);
check('Sustained recovery restores one balanced step with hysteresis',controller.getState().effective==='balanced');
controller.set('auto');controller.recordFrame(0);for(let t=200;t<=22000;t+=200)controller.recordFrame(t);
check('A genuinely heavy device rendering at 5 FPS still adapts automatically',controller.getState().effective==='fast'&&ratio===.9);
controller.set('auto');controller.recordFrame(0);for(let t=16;t<=15000;t+=16)controller.recordFrame(t);controller.recordFrame(1000000);
check('A tab/dialog gap clears sampling instead of being treated as a slow frame',controller.getState().effective==='balanced');
controller.set('full');for(let t=0;t<30000;t+=100)controller.recordFrame(t);
check('Manual detail stays manual even on slow hardware',controller.getState().choice==='full'&&ratio===1.75&&shadowSize===4096&&forestMode==='full'&&lifeProfile.population===1&&trafficProfile==='high');
controller.set('max');check('Maximum preserves full population and detailed crowns while capping DPR',controller.getState().effective==='max'&&ratio===2&&shadowSize===4096&&lifeProfile.updateHz===40&&trafficProfile==='ultra');
controller.dispose();check('Disposed quality controller ignores future settings',controller.set('fast')===false&&controller.getState().choice==='max');
const restored=createQualityController({renderer,model,lighting,storage,pixelRatio:()=>1});check('A saved manual choice survives reload and respects device pixel ratio',restored.getState().choice==='max'&&ratio===1);restored.dispose();
const inaccessible={getItem(){throw Error('storage blocked');},setItem(){throw Error('storage blocked');}};
const noStorage=createQualityController({renderer,model,lighting,storage:inaccessible,mobile:true,reducedMotion:true,pixelRatio:()=>1});check('Privacy-mode storage failure still provides economical touch-device rendering',noStorage.getState().effective==='fast'&&noStorage.set('balanced'));check('Quality changes preserve the user preference for reduced motion',lifeProfile.reducedMotion===true);noStorage.dispose();
const edge=[[0,0],[100,0]],at=(x,y,z)=>forestProximity({x,y,z},edge);
check('Audio follows the model forest edge and retains sound inside the woodland',at(50,1.7,20)===1&&at(50,1.7,250)===1);
check('Audio fades on the building side and is silent at distant/high viewpoints',at(50,1.7,-50)>0&&at(50,1.7,-50)<1&&at(50,1.7,-150)===0&&at(50,100,0)===0);
check('Invalid forest or camera coordinates cannot produce audible gain',forestProximity(null,edge)===0&&forestProximity({x:NaN,y:0,z:0},edge)===0&&forestProximity({x:0,y:0,z:0},[])===0);

// PMREM requires a GPU and is tested by the native browser suite. Substitute
// only its radiance output here to exercise the real shadow camera/cache logic.
const T=await import(url('vendor/three.module.js')),{createArchitecturalLighting}=await import(url('architectural-lighting.js'));
const oldFromScene=T.PMREMGenerator.prototype.fromScene,oldPerformance=Object.getOwnPropertyDescriptor(globalThis,'performance');let clock=0,radianceDisposed=0;
T.PMREMGenerator.prototype.fromScene=()=>({texture:new T.Texture(),dispose(){radianceDisposed++;}});Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
try{
 const scene=new T.Scene(),root=new T.Group(),floor=new T.Mesh(new T.BoxGeometry(20,1,20),new T.MeshStandardMaterial()),tower=new T.Mesh(new T.BoxGeometry(2,15,2),new T.MeshStandardMaterial());floor.receiveShadow=true;tower.castShadow=true;tower.position.y=7.5;root.add(floor,tower);scene.add(root);
 const model={root,life:{enabled:false},traffic:{enabled:false,lanes:[{pointsWorld:[[700,-.5,600],[800,-.5,650]]}]}},camera=new T.PerspectiveCamera(60,1,.1,1500);camera.position.set(20,15,20);camera.lookAt(0,2,0);
 const rig=createArchitecturalLighting(scene,{}, {model,modelRoot:root});rig.set({elevation:45,azimuth:180});rig.focus(camera);
 check('Future car route positions are conservatively included in the cached caster envelope',rig.getBounds().casters.max.x>=804&&rig.getBounds().casters.max.z>=654);
 for(let i=0;i<120;i++){clock+=16;rig.focus(camera);}let diagnostics=scene.userData.architecturalLighting;
 check('An unchanged paused scene fits and renders its sunlight shadow only once',diagnostics.fitCount===1&&diagnostics.redrawCount===1,{fitCount:diagnostics.fitCount,redrawCount:diagnostics.redrawCount});
 model.life.enabled=true;const before=diagnostics.redrawCount;for(let i=0;i<60;i++){clock+=16;rig.focus(camera);}diagnostics=scene.userData.architecturalLighting;
 check('Moving residents redraw shadows at the budgeted cadence without refitting static bounds',diagnostics.fitCount===1&&diagnostics.redrawCount-before>=8&&diagnostics.redrawCount-before<=11,{redraws:diagnostics.redrawCount-before});
 model.life.enabled=false;clock+=200;camera.position.x+=5;camera.lookAt(0,2,0);rig.focus(camera);
 check('Changing a camera invalidates the shadow fit',scene.userData.architecturalLighting.fitCount===2);
 clock+=200;camera.aspect=2;camera.updateProjectionMatrix();rig.focus(camera);
 check('Changing camera projection invalidates the shadow fit',scene.userData.architecturalLighting.fitCount===3);
 clock+=200;rig.set({elevation:45,azimuth:180});rig.focus(camera);
 check('Repeated identical solar selections do not invalidate the fit',scene.userData.architecturalLighting.fitCount===3);
 clock+=200;rig.set({elevation:15,azimuth:130});rig.focus(camera);
 check('A new geographic solar direction refits the actual shadow camera',scene.userData.architecturalLighting.fitCount===4&&rig.getShadowState().worldDirection.every(Number.isFinite));
 let mapDisposed=0;rig.sun.shadow.map={dispose(){mapDisposed++;}};rig.sun.shadow.mapPass={dispose(){mapDisposed++;}};rig.setQuality({shadowSize:1024,shadowHz:5});clock+=200;rig.focus(camera);
 check('Changing shadow resolution releases the obsolete GPU targets and refits once',mapDisposed===2&&rig.sun.shadow.map===null&&rig.sun.shadow.mapPass===null&&scene.userData.architecturalLighting.fitCount===5&&scene.userData.architecturalLighting.dynamicShadowHz===5);
 rig.setRegion('district');clock+=200;rig.focus(camera);check('A receiver region change refits while retaining finite shadow coverage',scene.userData.architecturalLighting.fitCount===6&&rig.getShadowState().near>0&&rig.getShadowState().far>rig.getShadowState().near);
 rig.dispose();rig.dispose();check('Lighting releases the analytic environment once and removes the rig',scene.environment===null&&!rig.sun.parent&&radianceDisposed===2);floor.geometry.dispose();floor.material.dispose();tower.geometry.dispose();tower.material.dispose();
}finally{T.PMREMGenerator.prototype.fromScene=oldFromScene;Object.defineProperty(globalThis,'performance',oldPerformance);}

const events=new Map();let modal=false,contextCount=0,closed=0,stopped=0,disconnected=0;
const button={disabled:false,textContent:'',setAttribute(){}},slider={disabled:false,value:''},status={textContent:''};
const panel={querySelector:s=>s==='[data-forest-sound]'?button:s==='[data-forest-volume]'?slider:s==='[data-forest-status]'?status:null};
const document={hidden:false,body:{classList:{contains:()=>false}},querySelector:()=>modal?{}:null,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}};
const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},cancelScheduledValues(){},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
const node=()=>({gain:parameter(),frequency:parameter(),Q:parameter(),pan:parameter(),connect(){},disconnect(){disconnected++;},start(){},stop(){stopped++;}});
class AudioContext{
 constructor(){contextCount++;this.sampleRate=100;this.currentTime=0;this.state='suspended';this.destination={};}
 createGain(){return node();}createBiquadFilter(){return node();}createBufferSource(){return node();}createOscillator(){return node();}createStereoPanner(){return node();}
 createBuffer(channels,length){const buffer=new Float32Array(length);return{getChannelData:()=>buffer};}
 async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';closed++;}
}
saved.set('rp.forest-sound.v38',JSON.stringify({enabled:true,volume:.41}));
const sound=createForestSound({panel,forestEdge:edge,getCamera:()=>({position:{x:50,y:2,z:1}}),storage,document,AudioContextClass:AudioContext,random:()=>.5});
check('A saved sound preference creates no audio context before a user gesture',contextCount===0&&!sound.getState().enabled&&sound.getState().preferred&&sound.getState().volume===.41&&status.textContent.includes('Нажмите'));
await button.onclick();check('An explicit user action starts one context at the forest',contextCount===1&&sound.getState().enabled&&sound.getState().contextState==='running'&&sound.getState().proximity===1);
slider.oninput({target:{value:'75'}});check('Volume changes affect and persist only the local audio setting',sound.getState().volume===.75&&JSON.parse(saved.get('rp.forest-sound.v38')).volume===.75);
document.hidden=true;events.get('visibilitychange')();await Promise.resolve();check('A hidden tab suspends audio immediately even when rendering is paused',sound.getState().blocked&&sound.getState().contextState==='suspended');
document.hidden=false;modal=true;events.get('visibilitychange')();await Promise.resolve();check('A room/dialog keeps woodland sound muted after returning to the tab',sound.getState().blocked&&sound.getState().contextState==='suspended');
modal=false;events.get('visibilitychange')();await Promise.resolve();check('Closing the room restores the already authorised context',!sound.getState().blocked&&sound.getState().contextState==='running'&&contextCount===1);
await button.onclick();check('Disabling sound suspends the same context and saves the off choice',!sound.getState().enabled&&sound.getState().contextState==='suspended'&&JSON.parse(saved.get('rp.forest-sound.v38')).enabled===false);
sound.dispose();sound.dispose();check('Disposal closes once, stops/disconnects the owned source, and removes handlers',closed===1&&stopped===1&&disconnected>=4&&events.size===0&&button.onclick===null&&slider.oninput===null);
const report={revision:38,pass:checks.every(c=>c.pass),checks};
const out=process.env.RP_QA_OUTPUT||path.join(process.env.RP_QA_OUT||path.dirname(fileURLToPath(import.meta.url)),'quality-cpu.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
