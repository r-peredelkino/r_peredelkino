// @r_peredelkino · rounded circular arena and its street-facing capsule screen.
// Sources: the supplied promo_new.jpg and developer panorama 12.03.33.
import * as THREE from './vendor/three.module.js';
import {complexFootprints as footprint} from './complex-footprints.js?v=publication371';
import {location} from './solar.js?v=publication371';
import {createArenaCrownGeometry} from './exterior-roofs.js?v=publication371';
import {embedPixelSignature} from './baked-authorship.js?v=publication371';
import {attribution} from './attribution.js?v=publication371';
import {retailLevels} from './frontage-zones.js?v=publication371';
import {arenaShoulderProfile} from './arena-shell-profile.js?v=publication371';
import {arenaCenter,arenaGroundRadius,arenaPlacement} from './arena-placement-v35.js?v=publication371';
export {arenaShoulderProfile} from './arena-shell-profile.js?v=publication371';

// A rounded rectangle in developed arc length is mapped onto the same curved
// vertical section as the white shell. The upper/lower/side edges all stay
// visibly rounded; neither a blue cylinder nor a flat rectangle is substituted.
export function createArenaScreenGeometry(radius,{frontAngle=Math.atan2(-location.north[0],-location.north[1]),arcAngle=2.68,bottom=4.00,top=7.08,cornerRadius=1.46}={}){
 const profile=arenaShoulderProfile(radius),radiusAt=y=>{
  let i=1;while(i<profile.length-1&&profile[i].y<y)i++;const a=profile[i-1],b=profile[i],t=(y-a.y)/(b.y-a.y);return THREE.MathUtils.lerp(a.x,b.x,t)+.024;
 },columns=112,rows=32,halfWidth=radius*arcAngle/2,rounding=Math.min(cornerRadius,(top-bottom)*.5),positions=[],uv=[],indices=[];
 for(let row=0;row<=rows;row++){
  const v=row/rows,y=THREE.MathUtils.lerp(bottom,top,v),r=radiusAt(y),cap=Math.max(bottom+rounding-y,y-(top-rounding),0),half=halfWidth-rounding+Math.sqrt(Math.max(0,rounding*rounding-cap*cap));
  for(let col=0;col<=columns;col++){
   const u=col/columns,arc=(u*2-1)*half,theta=frontAngle+arc/radius;
   positions.push(Math.sin(theta)*r,y,Math.cos(theta)*r);uv.push((arc+halfWidth)/(halfWidth*2),v);
   if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.arenaScreen={frontAngle,arcAngle,bottom,top,cornerRadius:rounding,arcWidth:halfWidth*2,profile:'rounded white shoulder with a bounded front LED surface'};return g;
}

function arenaMediaTexture(){
 let canvas,context,texture;
 if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=2048;canvas.height=256;context=canvas.getContext('2d');}
 if(context){texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;}
 else{texture=new THREE.DataTexture(new Uint8Array(256*16*4),256,16,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;}
 texture.name='Arena source-pixel display on reconstructed surface';texture.userData.attribution={...attribution};return{canvas,context,texture};
}
function encodeMediaPixels(ctx,w,h){
 // Attribution remains metadata / non-visible provenance, never architectural
 // lettering painted onto the developer's media image or the white roof.
 const rows=Math.min(4,h),pixels=ctx.getImageData(0,h-rows,w,rows);
 embedPixelSignature(pixels.data,{label:'arena-source-surface-frame'});ctx.putImageData(pixels,0,h-rows);
}

export function createReferenceArena(root,{whiteMaterial}){
 const group=new THREE.Group();group.name='Circular arena with rounded white shoulders and a capsule media facade';root.add(group);
 const [x,z]=arenaCenter,radius=arenaGroundRadius;
 const add=(geometry,material,name)=>{const o=new THREE.Mesh(geometry,material);o.name=name;o.castShadow=o.receiveShadow=true;group.add(o);return o;};
 const glassMaterial=new THREE.MeshStandardMaterial({color:0x556362,roughness:.27,metalness:.08,envMapIntensity:.45}),jointMaterial=new THREE.MeshStandardMaterial({color:0x737975,roughness:.76,metalness:.06});
 // The common white retail fascia fills the interval between these two cores.
 // A full-height dark cylinder would coincide with it on the circular side.
 const arena=add(new THREE.CylinderGeometry(radius,radius,retailLevels.dividerBottom,192,1,false),glassMaterial,'Circular arena ground floor projecting from the unchanged podium');arena.position.set(x,retailLevels.dividerBottom/2,z);
 const upperCore=add(new THREE.CylinderGeometry(radius,radius,7.10-retailLevels.dividerTop,192,1,false),glassMaterial,'Arena upper core behind the capsule and above the white retail band');upperCore.position.set(x,(7.10+retailLevels.dividerTop)/2,z);
 const shellProfile=arenaShoulderProfile(radius),shell=add(new THREE.LatheGeometry(shellProfile,192),whiteMaterial,'Soft white rolled shoulders framing the arena display');shell.position.set(x,0,z);
 const arenaRoof=add(createArenaCrownGeometry(radius),whiteMaterial,'Arena roof with three concentric steps and a softly crowned surface');arenaRoof.position.set(x,0,z);
 const roofJoints=[];
 for(const [scale,y] of [[.944,7.848],[.811,8.118]]){const g=new THREE.RingGeometry(radius*scale-.045,radius*scale+.035,192);g.rotateX(-Math.PI/2);const joint=add(g,jointMaterial,'Narrow recessed circular arena roof seam');joint.position.set(x,y,z);roofJoints.push(joint);}
 const {canvas,context,texture}=arenaMediaTexture(),geometry=createArenaScreenGeometry(radius),screen=add(geometry,new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.FrontSide,transparent:true,depthWrite:false}),'Rounded street-facing arena media screen');screen.position.set(x,0,z);screen.castShadow=false;screen.receiveShadow=false;
 let last=-Infinity,frames=0,preset='reference',paintedPreset=null,referenceImage=null,referenceReady=false,referenceError=null,dead=false;
 function update(t){
  if(dead||!context||!Number.isFinite(t)||Math.abs(t-last)<1/15||(preset==='reference'&&paintedPreset===preset))return;last=t;frames++;
  if(preset==='reference'){
   // Reprojection of original node1 JPEG pixels: observed white/gold artwork
   // and its actual glyphs. Only the registered visible U=.42..84 sector is
   // covered; the unobserved sector remains the neutral physical white shell.
   const w=canvas.width,h=canvas.height,ctx=context;ctx.clearRect(0,0,w,h);
   if(referenceReady)ctx.drawImage(referenceImage,0,0,w,h);
   encodeMediaPixels(ctx,w,h);texture.needsUpdate=true;paintedPreset=preset;return;
  }
  const w=canvas.width,h=canvas.height,ctx=context,bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#67bedb');bg.addColorStop(.42,'#31a7d2');bg.addColorStop(1,'#268fbf');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Gentle, broad light strokes match the supplied daytime promotional panel.
  for(let i=0;i<3;i++){const offset=(Math.sin(t*.045+i)*.12+i*.30)*w;ctx.fillStyle=i===1?'#d4f5ff0d':'#f0fbff12';ctx.beginPath();ctx.moveTo(offset-330,h);ctx.lineTo(offset+170,0);ctx.lineTo(offset+430,0);ctx.lineTo(offset-100,h);ctx.closePath();ctx.fill();}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f8ffff';ctx.font='700 76px Arial, sans-serif';ctx.fillText('ДО ВСТРЕЧИ',w/2,91);ctx.fillText('В ПЕРЕДЕЛКИНО!',w/2,176);
  encodeMediaPixels(ctx,w,h);texture.needsUpdate=true;paintedPreset=preset;
 }
 const arenaMedia={mesh:screen,texture,geometry,height:3.08,perimeter:2*Math.PI*radius,screenProfile:geometry.userData.arenaScreen,update,
  sampleEmission(t){return preset==='reference'?{color:new THREE.Color(0xe7d7aa),power:.28}:{color:new THREE.Color(0x5dbddb),power:.77+.035*Math.sin(t*.32)};},get frames(){return frames;},get referenceReady(){return referenceReady;},get referenceError(){return referenceError;},get preset(){return preset;},setPreset(value){
   if(value!=='reference'&&value!=='promo')throw new RangeError('Unknown arena media source preset');
   if(value===preset)return;preset=value;last=-Infinity;paintedPreset=null;
   if(!context){const {data,width,height}=texture.image;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const f=value==='reference'?x/(width-1):y/(height-1),i=(y*width+x)*4;data.set(value==='reference'?[0,0,0,0]:[Math.round(38+f*62),Math.round(155+f*28),Math.round(203+f*14),255],i);}embedPixelSignature(data,{label:'arena-'+value+'-screen-fallback'});texture.needsUpdate=true;}
   update(.5);
  },dispose(){dead=true;if(referenceImage){referenceImage.onload=referenceImage.onerror=null;referenceImage=null;}texture.dispose();}};
 update(.5);
 if(context&&typeof Image!=='undefined'){
  referenceImage=new Image();
  referenceImage.onload=()=>{if(dead)return;referenceReady=true;last=-Infinity;paintedPreset=null;if(preset==='reference')update(.5);};
  referenceImage.onerror=()=>{if(!dead)referenceError='Source-derived arena media texture unavailable';};
  referenceImage.src=new URL('./assets/reference/arena-visible-media.png',import.meta.url).href;
 }
 const metadata={version:35,sourceViews:['promo_new.jpg','12.03.33','12.03.36','2026-10-11 23.50.18'],centre:[x,z],groundRadius:radius,sourceGroundFootprintUnchanged:true,placement:arenaPlacement,
  maxShoulderProjection:Math.max(...shellProfile.map(p=>p.x-radius)),screen:geometry.userData.arenaScreen,roofTop:8.66,storeys:2,glazedStoreys:1,
  mediaSources:{default:'reference',reference:['2026-10-11 09.29.19','2026-10-11 09.29.22','2026-10-11 09.29.28'],promo:'promo_new.jpg',artworkStatus:'Visible sector reprojected from original node1 JPEG tiles; actual lettering pixels retained, not redrawn. This is not the original developer material.',sourceTexture:'assets/reference/arena-visible-media.png',coveredMeshURange:[.42,.84],unknownSector:'Transparent over neutral white shell; no invented hidden artwork',screenGeometryUnchanged:true}};
 group.userData.referenceArena=metadata;
 return{group,metadata,arena,upperCore,arenaRoof,arenaMedia,shell,roofJoints,materials:{glass:glassMaterial,joint:jointMaterial,screen:screen.material,white:whiteMaterial},dispose(){
  arenaMedia.dispose();group.traverse(o=>o.geometry?.dispose());glassMaterial.dispose();jointMaterial.dispose();screen.material.dispose();root.remove(group);
 }};
}
