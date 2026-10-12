// Fine mineral pavers, expressed in model coordinates; no photographic texture is invented.
export function applyPaving(material,{width=.36,depth=.18}={}){
 material.color.set(0xaeb7bd);
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vMineralPaving;').replace('#include <begin_vertex>','#include <begin_vertex>\nvMineralPaving=(modelMatrix*vec4(transformed,1.)).xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vMineralPaving;').replace('#include <color_fragment>',`#include <color_fragment>
   vec2 pavingSize=vec2(${width.toFixed(4)},${depth.toFixed(4)});
   vec2 pavingTile=vMineralPaving/pavingSize;pavingTile.x+=mod(floor(pavingTile.y),2.)*.5;
   vec2 pavingEdge=min(fract(pavingTile),1.-fract(pavingTile))*pavingSize;
   float pavingDistance=min(pavingEdge.x,pavingEdge.y);
   float pavingAA=max(length(fwidth(vMineralPaving))*.30,.0005);
   float pavingJoint=smoothstep(.0015,.003+pavingAA,pavingDistance);
   float pavingTone=fract(sin(dot(floor(pavingTile),vec2(12.9898,78.233)))*43758.5453);
   float pavingGrain=fract(sin(dot(floor(vMineralPaving*75.),vec2(53.12,17.31)))*19272.238);
   diffuseColor.rgb*=mix(.67,.84+pavingTone*.12,pavingJoint)*(.978+pavingGrain*.044);`);
 };
 material.customProgramCacheKey=()=>`mineral-paving-30-${width}-${depth}`;
 material.userData.paving={width,depth,source:'Visual estimate from developer renders',revision:30};
 return material;
}
