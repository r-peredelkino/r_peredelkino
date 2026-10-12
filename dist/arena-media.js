// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import {stampCanvasFrame} from './baked-authorship.js?v=community38';
import * as THREE from './vendor/three.module.js';
// One continuous curved LED surface, spanning the upper floor of the arena.
export function createArenaMedia(points,root){
 const pts=[];for(const p of points){const q=pts.at(-1);if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>1e-5)pts.push(p)}if(Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-5)pts.pop();let signedArea=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];signedArea+=a[0]*b[1]-b[0]*a[1]}if(signedArea>0)pts.reverse();const lengths=[0];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];lengths.push(lengths.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]))}const perimeter=lengths.at(-1),position=[],uv=[];
 for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],u=lengths[i]/perimeter,v=lengths[i+1]/perimeter;const quad=[[a[0],3.78,a[1],u,0],[b[0],3.78,b[1],v,0],[a[0],7.06,a[1],u,1],[b[0],7.06,b[1],v,1]];for(const k of [0,1,2,2,1,3]){const q=quad[k];position.push(...q.slice(0,3));uv.push(...q.slice(3))}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
 let canvas,ctx,texture;
 if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=1536;canvas.height=192;ctx=canvas.getContext('2d')}
 if(ctx){texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.wrapS=THREE.RepeatWrapping;texture.repeat.x=4}else{const data=new Uint8Array([8,21,40,255,21,168,224,255,35,52,108,255,4,14,33,255]);texture=new THREE.DataTexture(data,4,1,THREE.RGBAFormat);texture.needsUpdate=true}
 const material=new THREE.MeshBasicMaterial({map:texture,color:0xffffff,toneMapped:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.name='Full upper-floor animated wraparound LED display';root.add(mesh);
 let last=-Infinity,frames=0;const schedule=['ДОБРО ПОЖАЛОВАТЬ','РОДИНА · ПЕРЕДЕЛКИНО','CYBER ARENA'];
 function update(t){if(!ctx||!Number.isFinite(t)||Math.abs(t-last)<1/15)return;last=t;frames++;const w=canvas.width,h=canvas.height,phase=Math.floor(t/8)%3,f=(t%8)/8;
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#031422');bg.addColorStop(.45,phase===2?'#27154d':'#083b53');bg.addColorStop(1,'#04131f');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 // Slow energy waves and fine LED scanlines stay behind the greeting.
 for(let j=0;j<4;j++){const x=((t*95+j*430)%1900)-190;const g=ctx.createLinearGradient(x-120,0,x+120,0);g.addColorStop(0,'#00cfff00');g.addColorStop(.5,phase===2?'#9463ff55':'#32dcff55');g.addColorStop(1,'#00cfff00');ctx.fillStyle=g;ctx.fillRect(x-120,0,240,h)}
 ctx.strokeStyle='#73d7ed15';ctx.lineWidth=1;for(let x=0;x<w;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=6){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 const alpha=Math.min(1,f*12,(1-f)*12);ctx.globalAlpha=Math.max(0,alpha);ctx.fillStyle='#e9fcff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 66px Arial, sans-serif';ctx.shadowColor='#57d9ff';ctx.shadowBlur=9;ctx.fillText(schedule[phase],w/2+Math.sin(t*.55)*14,93);ctx.shadowBlur=0;ctx.font='500 24px Arial, sans-serif';ctx.fillStyle='#8fdef1';ctx.fillText(phase===2?'ИГРА · ТЕХНОЛОГИИ · СООБЩЕСТВО':'ВАШ ДОМ. ВАШЕ ПРОСТРАНСТВО.',w/2,151);ctx.globalAlpha=1;ctx.fillStyle='#a8eeff';ctx.fillRect(0,h-4,w*f,3);stampCanvasFrame(ctx,w,h);texture.needsUpdate=true;
 }
 update(.5);return{mesh,texture,geometry,height:3.28,perimeter,update,sampleEmission(t){return{color:new THREE.Color(Math.floor(t/8)%3===2?0x9870f1:0x46cdeb),power:.74+.16*Math.sin(t*.8)+.1*Math.sin(t*2.1)}},get frames(){return frames},dispose(){texture.dispose()}};
}
