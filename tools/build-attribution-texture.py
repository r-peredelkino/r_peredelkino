"""Rebuild the embedded, offline attribution alpha mask from the supplied author handle."""
from pathlib import Path
from PIL import Image,ImageFont,ImageDraw
import base64
root=Path(__file__).resolve().parents[1]
w,h=512,128
mask=Image.new('L',(w,h));font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',53)
d=ImageDraw.Draw(mask);text='@r_peredelkino';bbox=d.textbbox((0,0),text,font=font);d.text(((w-(bbox[2]-bbox[0]))/2,(h-(bbox[3]-bbox[1]))/2-bbox[1]),text,font=font,fill=255)
# A compact monochrome glyph mask; linear filtering handles its edges on the GPU.
pixels=[v>=110 for v in mask.getdata()];packed=bytearray(w*h//8)
for i,v in enumerate(pixels):
 if v:packed[i//8]|=1<<(7-i%8)
encoded=base64.b64encode(packed).decode()
module="""import * as THREE from './vendor/three.module.js';
// Embedded @r_peredelkino glyphs: independent of fonts, image requests, and external CDNs.
export const attribution=Object.freeze({handle:'@r_peredelkino',modelId:'RP-CONCEPT-2026-10-07',scope:'Concept application and reference-based 3D reconstruction',architecturalProject:'Родина Переделкино · Группа Родина'});
const packed='"""+encoded+"""';
export function createAttributionTexture(){const raw=atob(packed),rgba=new Uint8Array(512*128*4);for(let i=0;i<512*128;i++){const alpha=(raw.charCodeAt(i>>3)>>(7-(i&7)))&1;rgba.set([255,255,255,alpha?255:0],((127-(i>>9))*512+(i&511))*4)}const texture=new THREE.DataTexture(rgba,512,128,THREE.RGBAFormat);texture.name=attribution.handle+' · embedded author mark';texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.flipY=false;texture.needsUpdate=true;texture.userData.attribution={...attribution};return texture}
export function mountSceneAttribution(host){const label=document.createElement('div');label.className='scene-attribution';label.textContent=attribution.handle+' · 3D-концепт';label.setAttribute('aria-label','Авторская отметка модели: '+attribution.handle);host.append(label);return label}
"""
(root/'dist/attribution.js').write_text(module)
preview=Image.new('RGBA',(w,h),(255,255,255,0));preview.putalpha(mask);preview.save('/tmp/rodina-watermark-texture.png')
print('Embedded glyph mask:',len(packed),'bytes')
