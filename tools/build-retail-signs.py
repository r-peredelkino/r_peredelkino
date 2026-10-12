"""@r_peredelkino: bake generic reference signage into an embedded pixel atlas."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
root=Path(__file__).resolve().parents[1];w=384;h=96;labels=['КОФЕЙНЯ','ПЕКАРНЯ','РЕСТОРАН','МАГАЗИН'];im=Image.new('L',(w*4,h));d=ImageDraw.Draw(im)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',37);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
for i,t in enumerate(labels):d.text((i*w+w/2,42),t,font=f,fill=255,anchor='mm');d.text((i*w+w/2,79),'@r_peredelkino',font=small,fill=165,anchor='mm')
values=list(im.getdata());runs=[];prev=values[0];count=0
for v in values:
 if v==prev and count<255:count+=1
 else:runs.extend([count,prev]);prev=v;count=1
runs.extend([count,prev])
(root/'dist/retail-signs.js').write_text('''// @r_peredelkino · embedded generic signs; no actual tenant is implied.
import * as THREE from './vendor/three.module.js';
import {attribution} from './attribution.js?v=tour15';
export const retailLabels='''+json.dumps(labels,ensure_ascii=False)+''';
const runs='''+json.dumps(runs,separators=(',',':'))+''';
export function createRetailSignAtlas(){const bytes=new Uint8Array(1536*96*4);let at=0;for(let r=0;r<runs.length;r+=2)for(let j=0;j<runs[r];j++){bytes.set([255,244,217,runs[r+1]],at);at+=4}const t=new THREE.DataTexture(bytes,1536,96,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.flipY=true;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.name='@r_peredelkino | retail lettering';t.userData.attribution={...attribution};return t}
''')
print('Retail atlas:',len(runs)//2,'runs')
