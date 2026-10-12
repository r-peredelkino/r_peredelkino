// @r_peredelkino · broad cafe interiors shared by several adjacent panes.
// Furniture and finishes are indicative; no actual tenant fit-out is asserted.
import * as THREE from './vendor/three.module.js';
import {embedPixelSignature} from './baked-authorship.js?v=publication371';
import {attribution} from './attribution.js?v=publication371';

export function createShopInteriorTexture(brand){
 const w=512,h=320,variants=4,tiers=2,W=w*variants,H=h*tiers,pixels=new Uint8Array(W*H*4);
 const wallColours=[[153,136,113],[142,147,139],[151,141,132],[155,136,117]];
 for(let tier=0;tier<tiers;tier++)for(let variant=0;variant<variants;variant++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/(w-1),v=y/(h-1),edge=Math.abs(u-.5),base=wallColours[variant];let tone=.67,colour=base;
  const backTop=.22+edge*.10,backBottom=.77-edge*.12;
  if(v<backTop){tone=.49+v*.35;colour=[160,160,149]}
  else if(v>backBottom){tone=.70-(v-backBottom)*.52;colour=[156,143,122];
   const perspective=(u-.5)/(1.08-v),seam=Math.abs((perspective*.9+.5)%1);
   if(seam<.016||Math.abs((1/(1.06-v))%1-.5)<.018)tone*=.79;
  }else tone=.66-edge*.13;
  // Quiet side walls and one deep entrance keep the room open across the glass.
  if(u<.075||u>.925){tone*=.70;colour=[137,144,138]}
  if(u>.77&&u<.89&&v>.28&&v<.75){tone=.33;colour=[102,123,125]}
  const shelfLeft=variant===0?.14:variant===3?.51:.09,shelfRight=variant===0?.51:variant===3?.76:.29;
  if(u>shelfLeft&&u<shelfRight&&v>.35&&v<.60){
   const row=(v-.35)/.085,col=(u-shelfLeft)/.045,fy=row%1,fx=col%1;
   if(fy>.88){tone=.31;colour=[112,103,89]}
   else if(fy>.77){tone=.86;colour=[192,172,139]}
   else if(fy>.33&&fx>.27&&fx<.70){tone=.53+((Math.floor(col)+Math.floor(row)+variant)%4)*.067;colour=variant===2?[123,141,124]:base}
  }
  // Lower shopfronts carry a single counter; the upper gallery is quieter.
  if(tier===0&&(variant===0||variant===3)&&u>.11&&u<.65&&v>.64&&v<.81){
   tone=v<.659?.93:.49;colour=v<.659?[190,178,155]:[133,105,79];
   if(variant===0&&v>.671&&v<.73){tone=.75;colour=[167,148,116]}
  }
  const tables=variant===0?[[.68,.81],[.87,.87]]:[[.36,.76],[.57,.86],[.79,.80]];
  for(const [tx,ty] of tables){
   const d=((u-tx)/.075)**2+((v-ty)/.022)**2;
   if(d<1){tone=.84;colour=[177,151,119]}
   if(Math.abs(u-tx)<.004&&v>ty&&v<ty+.085){tone=.32;colour=[91,91,82]}
   for(const side of [-1,1])if(Math.abs(u-tx-side*.064)<.007&&v>ty-.03&&v<ty+.045){tone=.50;colour=[137,115,89]}
  }
  // Three modest pendants for a whole shop, instead of two in every glass bay.
  for(const lx of [.22,.48,.73]){
   if(Math.abs(u-lx)<.002&&v<.19){tone=.27;colour=[107,111,105]}
   if(Math.abs(u-lx)<.025&&v>.184&&v<.205){tone=.91;colour=[217,201,167]}
   const glow=Math.exp(-((u-lx)**2/.0009+(v-.215)**2/.00025));
   if(glow>.025){tone+=glow*.34;colour=[208,189,151]}
  }
  // A few taller plants break up the interior without painting a shelf in every bay.
  for(const px of [.085,.90]){
   if(Math.abs(u-px)<.018&&v>.66&&v<.77){tone=.70;colour=[180,177,158]}
   if(((u-px)/.038)**2+((v-.56)/.13)**2<1){tone=.58+.08*Math.sin(v*107+u*49);colour=[100,123,98]}
  }
  const grain=(((x*17+y*31+variant*29)%13)-6)*.08,upper=tier?.84:1,offset=((tier*h+y)*W+variant*w+x)*4;
  for(let c=0;c<3;c++)pixels[offset+c]=Math.max(0,Math.min(255,Math.round((colour[c]*tone+grain)*upper)));
  pixels[offset+3]=255;
 }
 // Application authorship is retained below as non-visible pixel provenance.
 embedPixelSignature(pixels,{label:'continuous-shop-interiors-two-tiers'});
 const texture=new THREE.DataTexture(pixels,W,H,THREE.RGBAFormat);texture.flipY=true;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 texture.name='@r_peredelkino | continuous cafe rooms and quieter upper galleries';texture.userData.attribution={...attribution};texture.userData.reference={views:['12.03.36','12.03.39','12.03.41'],variants,tiers,tenantDesigns:false,sharedAcrossAdjacentPanes:true};return texture;
}
