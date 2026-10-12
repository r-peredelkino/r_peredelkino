// @r_peredelkino · original, softly synthesised woodland ambience.
const clamp=(value,a,b)=>Math.min(b,Math.max(a,value));
export function forestProximity(position,edge){
 if(!position||!Array.isArray(edge)||edge.length<2||![position.x,position.y,position.z].every(Number.isFinite))return 0;
 let nearest=Infinity,inside=false;
 for(let i=1;i<edge.length;i++){
  const a=edge[i-1],b=edge[i],dx=b[0]-a[0],dz=b[1]-a[1],lengthSq=dx*dx+dz*dz;
  if(!lengthSq)continue;
  const t=clamp(((position.x-a[0])*dx+(position.z-a[1])*dz)/lengthSq,0,1),x=a[0]+dx*t,z=a[1]+dz*t,d=Math.hypot(position.x-x,position.z-z);
  if(d<nearest){nearest=d;inside=(-dz*(position.x-x)+dx*(position.z-z))>0;}
 }
 // The source woodland grows on the left side of this traced edge. Deep forest
 // retains its ambience; the opposite side fades out towards the buildings.
 const distance=inside?0:nearest;
 const horizontal=1-clamp((distance-8)/110,0,1),altitude=1-clamp((position.y-14)/65,0,1);
 return horizontal*horizontal*altitude;
}
export function createForestSound({panel,forestEdge,getCamera,storage=globalThis.localStorage,document:doc=globalThis.document,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,random=Math.random}={}){
 const button=panel?.querySelector('[data-forest-sound]'),slider=panel?.querySelector('[data-forest-volume]'),status=panel?.querySelector('[data-forest-status]');
 let volume=.35,preferred=false,enabled=false,dead=false,context=null,master=null,wind=null,windFilter=null,windGain=null,timer=null,nextBird=0,proximity=0,lastGain=-1,blocked=true,resumeSerial=0;
 const transient=new Set(),key='rp.forest-sound.v38';
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved){volume=clamp(Number(saved.volume)||0,0,1);preferred=saved.enabled===true;}}catch{}
 const supported=typeof AudioContextClass==='function';
 function save(){try{storage?.setItem(key,JSON.stringify({enabled,volume}));}catch{}}
 function reflect(){
  if(button){button.disabled=!supported;button.textContent=enabled?'Звуки леса · выкл':'Включить звуки леса';button.setAttribute('aria-pressed',String(enabled));}
  if(slider){slider.value=String(Math.round(volume*100));slider.disabled=!supported;}
  const text=!supported?'Этот браузер не поддерживает звуки сцены.':!enabled?(preferred?'Нажмите «Включить»: браузер ждёт вашего действия.':'Ветер и птицы звучат только после включения.'):blocked?'Звук на паузе, пока открыто помещение или другая вкладка.':proximity<.01?'Подойдите к лесу: звук усиливается у деревьев.':`Рядом с лесом · громкость ${Math.round(volume*100)}%.`;
  if(status&&status.textContent!==text)status.textContent=text;
 }
 function muted(){return doc.hidden||!!doc.querySelector('dialog[open], #sheet[open]')||doc.body.classList.contains('showroom-open')||doc.body.classList.contains('reference-open');}
 function clearBirds(){for(const nodes of transient){for(const node of nodes){try{node.stop?.();}catch{}node.disconnect();}}transient.clear();}
 function graph(){
  if(context||!supported)return;
  context=new AudioContextClass({latencyHint:'playback'});master=context.createGain();master.gain.value=0;master.connect(context.destination);
  const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*3),context.sampleRate),channel=buffer.getChannelData(0);let previous=0;
  for(let i=0;i<channel.length;i++){previous=(previous+(random()*2-1)*.03)/1.03;channel[i]=previous*3.2;}
  const fade=Math.min(Math.floor(context.sampleRate*.045),Math.floor(channel.length/2));for(let i=0;i<fade;i++){const amplitude=i/fade;channel[i]*=amplitude;channel[channel.length-1-i]*=amplitude;}
  wind=context.createBufferSource();wind.buffer=buffer;wind.loop=true;
  windFilter=context.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=680;windFilter.Q.value=.5;
  windGain=context.createGain();windGain.gain.value=.1;wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);wind.start();
  timer=setInterval(schedule,500);
 }
 function chirp(at,pitch,duration){
  const oscillator=context.createOscillator(),gain=context.createGain(),panner=context.createStereoPanner?.(),nodes=[oscillator,gain,...(panner?[panner]:[])];transient.add(nodes);
  oscillator.type='sine';oscillator.frequency.setValueAtTime(pitch,at);oscillator.frequency.exponentialRampToValueAtTime(pitch*1.3,at+duration*.32);oscillator.frequency.exponentialRampToValueAtTime(pitch*.83,at+duration);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.026,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
  oscillator.connect(gain);if(panner){panner.pan.value=random()*.9-.45;gain.connect(panner);panner.connect(master);}else gain.connect(master);
  oscillator.onended=()=>{nodes.forEach(node=>node.disconnect());transient.delete(nodes);};oscillator.start(at);oscillator.stop(at+duration+.015);
 }
 function schedule(){
  if(dead||!enabled||blocked||!context||context.state!=='running'||proximity<.04||volume===0)return;
  const now=context.currentTime;if(now<nextBird)return;
  const pitch=2200+random()*1700,at=now+.08,count=2+Math.floor(random()*3);
  for(let i=0;i<count;i++)chirp(at+i*.17,pitch*(1+i*.04),.095+random()*.09);
  nextBird=now+4+random()*6;
 }
 function applyGain(immediate=false){
  if(!context||!master)return;
  const value=enabled&&!blocked?volume*proximity:0;
  if(value===lastGain&&!immediate)return;lastGain=value;
  const at=context.currentTime;master.gain.cancelScheduledValues(at);if(immediate)master.gain.setValueAtTime(value,at);else master.gain.setTargetAtTime(value,at,.15);
 }
 async function syncMute(){
  if(dead)return;
  const serial=++resumeSerial;blocked=muted();applyGain(blocked||!enabled);reflect();
  if(!context)return;
  if(blocked||!enabled){clearBirds();try{await context.suspend();}catch{}}
  else{try{await context.resume();}catch{}if(dead||serial!==resumeSerial)return;nextBird=context.currentTime+1;applyGain();}
 }
 async function toggle(){
  if(dead||!supported)return;
  enabled=!enabled;preferred=enabled;save();if(enabled){try{graph();}catch{enabled=false;reflect();return;}}
  await syncMute();
 }
 function update(){if(dead)return;proximity=forestProximity(getCamera?.()?.position,forestEdge);applyGain();reflect();}
 const onVisibility=()=>syncMute(),onMutation=records=>{if(records.some(record=>record.target===doc.body||record.attributeName==='open'||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&(node.matches?.('dialog')||node.querySelector?.('dialog')))))syncMute();};
 const observer=typeof MutationObserver==='function'?new MutationObserver(onMutation):null;
 observer?.observe(doc.body,{attributes:true,attributeFilter:['class','open'],childList:true,subtree:true});doc.addEventListener('visibilitychange',onVisibility);
 if(button)button.onclick=toggle;
 if(slider)slider.oninput=event=>{volume=clamp(Number(event.target.value)/100,0,1);save();applyGain();reflect();};
 blocked=muted();update();
 return{toggle,update,getState:()=>({enabled,preferred,volume,proximity,blocked,supported,contextState:context?.state??'uncreated',transientNodes:transient.size}),dispose(){if(dead)return;dead=true;++resumeSerial;observer?.disconnect();doc.removeEventListener('visibilitychange',onVisibility);if(timer!==null)clearInterval(timer);if(button)button.onclick=null;if(slider)slider.oninput=null;clearBirds();if(wind){try{wind.stop();}catch{}wind.disconnect();wind.buffer=null;}windFilter?.disconnect();windGain?.disconnect();master?.disconnect();context?.close().catch(()=>{});context=master=wind=windFilter=windGain=null;}};
}
