// Export the actual marked geometry and pixel arrays used by the client, without third-party reference photos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {createComplex} from '../dist/complex-model.js';
import {attribution} from '../dist/attribution.js';
const target=path.resolve('exports/rodina-authored-v13');fs.mkdirSync(path.join(target,'textures'),{recursive:true});
const model=createComplex();model.root.updateMatrixWorld(true);
const manifest={...attribution,version:13,format:'Three.js scene JSON + RGBA pixel PNG',stats:model.bakedAuthorship.stats,textures:[],files:{}};
const write=(file,data)=>{fs.writeFileSync(path.join(target,file),data);manifest.files[file]=crypto.createHash('sha256').update(data).digest('hex')};
// Small dependency-free PNG encoder; the row order matches the runtime DataTexture exactly.
const table=Array.from({length:256},(_,v)=>{for(let i=0;i<8;i++)v=(v&1)?0xedb88320^(v>>>1):v>>>1;return v>>>0});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
const chunk=(type,data)=>{const name=Buffer.from(type),size=Buffer.alloc(4),end=Buffer.alloc(4);size.writeUInt32BE(data.length);end.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,end])};
function png(image){const {width:w,height:h,data}=image,header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)raw.set(data.subarray((h-1-y)*w*4,(h-y)*w*4),y*(w*4+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('tEXt',Buffer.from('Author\0@r_peredelkino')),chunk('tEXt',Buffer.from('ModelId\0RP-CONCEPT-2026-10-07')),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))])}
for(const [i,texture] of [...model.bakedAuthorship.textures].entries()){const image=texture.image;if(!(image?.data instanceof Uint8Array)||image.data.length!==image.width*image.height*4)continue;const file=`textures/${String(i+1).padStart(3,'0')}.png`,bytes=png(image);write(file,bytes);manifest.textures.push({file,name:texture.name,width:image.width,height:image.height,rawPixelSha256:crypto.createHash('sha256').update(image.data).digest('hex'),orientation:'PNG top row = runtime DataTexture last row; use normal TextureLoader flipY=true'})}
const scene=Buffer.from(JSON.stringify(model.root.toJSON()));write('scene.three.json.gz',zlib.gzipSync(scene,{level:9}));
write('README.md',Buffer.from('# РОДИНА · Переделкино — маркированный снимок\n\nАвторская отметка концепта: @r_peredelkino.\n\nscene.three.json.gz содержит снимок геометрий, материалов и пиксельных текстур Three.js. Распакуйте gzip и загрузите JSON через THREE.ObjectLoader. PNG — отдельные копии реальных RGBA-буферов, используемых сценой. Они содержат видимые мелкие надписи и RGB-сигнатуры. Геометрии сохраняют rpAuthor и сигнатуру статических координат.\n\nЭто статический снимок при начальном времени, а не весь работающий сайт: анимации, погодный сервис и специальные оконные шейдеры находятся в исходных модулях приложения. Здесь нет исходных фотографий и рендеров третьих лиц. Маркировку можно удалить при целенаправленной переработке данных.\n'));
fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');model.dispose();console.log('Exported',manifest.textures.length,'pixel PNGs and marked scene:',target);
