// @r_peredelkino · finite facade openings; never remove an entire storey.
import * as T from './vendor/three.module.js';
import {registerApartmentFacade} from './apartment-facade-v37.js?v=publication371';
export function apartmentApertures(data,metrics,registration=null){const facade=registration??registerApartmentFacade(data,metrics),apertures=[];for(const window of facade.windows)for(const pane of window.panes)for(const [a,b]of [[pane.points[0],pane.points[4]],[pane.points[4],pane.points[8]]])apertures.push(new T.Vector4(...a,...b));return apertures;}
export function apartmentApertureProfile(apartment){const p=(apartment.facadeRegistration??registerApartmentFacade(apartment.data,apartment.metrics)).profile;return{sill:p.sill-.025,head:p.head+.025,halfDepth:.28,edgeAllowance:.035};}
export function apertureContains(x,y,z,apertures,profile={sill:.795,head:2.725,halfDepth:.28,edgeAllowance:.035}){if(typeof profile==='number')profile={sill:.795,head:Math.min(profile-.06,2.725),halfDepth:.28,edgeAllowance:.035};if(y<profile.sill||y>profile.head)return false;return apertures.some(a=>{const dx=a.z-a.x,dz=a.w-a.y,length=Math.hypot(dx,dz),u=((x-a.x)*dx+(z-a.y)*dz)/length,v=(-(x-a.x)*dz+(z-a.y)*dx)/length;return u> -profile.edgeAllowance&&u<length+profile.edgeAllowance&&Math.abs(v)<profile.halfDepth;});}
export function cutApartmentOpenings(tower,apartment){if(tower.apartmentOpenings)return tower.apartmentOpenings;const {data,metrics}=apartment,p=metrics.placement,apertures=apartmentApertures(data,metrics,apartment.facadeRegistration),profile=apartmentApertureProfile(apartment),clones=new Map();
 tower.group.traverse(o=>{if(!o.material)return;const clone=m=>{if(clones.has(m))return clones.get(m);const out=m.clone(),previous=m.onBeforeCompile,previousKey=m.customProgramCacheKey.bind(m);out.onBeforeCompile=shader=>{previous.call(m,shader);shader.uniforms.rpApertures={value:apertures};shader.uniforms.rpApartment={value:new T.Vector4(p.x,p.y,p.z,p.angle)};
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rpOpeningWorld;').replace('#include <project_vertex>',`#include <project_vertex>
 vec4 rpOpeningP=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 rpOpeningP=instanceMatrix*rpOpeningP;
 #endif
 rpOpeningWorld=(modelMatrix*rpOpeningP).xyz;`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 rpOpeningWorld;uniform vec4 rpApartment;uniform vec4 rpApertures[${apertures.length}];`).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 vec3 rpDelta=rpOpeningWorld-rpApartment.xyz;float rpC=cos(rpApartment.w),rpS=sin(rpApartment.w);
 vec2 rpLocal=vec2(rpC*rpDelta.x-rpS*rpDelta.z,rpS*rpDelta.x+rpC*rpDelta.z);
 if(rpDelta.y>${profile.sill.toFixed(5)}&&rpDelta.y<${profile.head.toFixed(5)}){
 for(int rpI=0;rpI<${apertures.length};rpI++){vec4 rpA=rpApertures[rpI];vec2 rpD=rpA.zw-rpA.xy;float rpL=length(rpD);vec2 rpQ=rpLocal-rpA.xy;float rpU=dot(rpQ,rpD)/rpL;float rpV=dot(rpQ,vec2(-rpD.y,rpD.x))/rpL;if(rpU>-${profile.edgeAllowance.toFixed(5)}&&rpU<rpL+${profile.edgeAllowance.toFixed(5)}&&abs(rpV)<${profile.halfDepth.toFixed(5)})discard;}}
 `);};out.customProgramCacheKey=()=>previousKey()+'-registered-finite-apertures37-'+data.id+'-'+p.building+'-'+p.floor+'-'+data.slot;clones.set(m,out);return out;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});const assignments=[];tower.group.traverse(o=>{if(o.material){const source=Array.isArray(o.material)?o.material.map(m=>[...clones].find(([,v])=>v===m)?.[0]??m):[...clones].find(([,v])=>v===o.material)?.[0]??o.material;assignments.push({object:o,source});}});let disposed=false;tower.apartmentOpenings={apertures,profile,materials:[...clones.values()],dispose(){if(disposed)return;disposed=true;for(const {object,source}of assignments)object.material=source;for(const material of clones.values())material.dispose();delete tower.apartmentOpenings;}};return tower.apartmentOpenings;
}
