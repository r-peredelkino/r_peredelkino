// @r_peredelkino · panorama-traced public forecourt landscape, revision 29.
// Source contours and fixed object positions are passed in world XZ coordinates.
// The cyan/magenta objects are rigid light columns, not inferred water jets.
import * as THREE from './vendor/three.module.js';
import {crownGeometry,branchingTrunk,moundedShrubGeometry,perennialSprigGeometry} from './botanical-geometry.js?v=references37';
import {createFoliageMaterial,createMineralMaterial,disposeOwnedMaterials} from './landscape-materials.js?v=references37';
import {createLightField} from './light-fields.js?v=references37';
import {spatiallyPartitionInstances} from './spatial-instances.js?v=references37';
import {moundedShrubLODGeometry,perennialSprigLODGeometry} from './botanical-lod.js?v=references37';

const TAU=Math.PI*2;
const clamp01=value=>THREE.MathUtils.clamp(Number(value)||0,0,1);
function finite(value,label){if(!Number.isFinite(value))throw new TypeError(`Forecourt landscape ${label} must be finite`);return value;}
function point(value,label='point'){
 const p=Array.isArray(value)?value:[value?.x,value?.z];
 return[finite(p?.[0],`${label}.x`),finite(p?.[1],`${label}.z`)];
}
function points(values,label,minimum=3){
 if(!Array.isArray(values)||values.length<minimum)throw new TypeError(`Forecourt landscape ${label} needs ${minimum} points`);
 const p=values.map(v=>point(v,label));
 if(minimum>2&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-7)p.pop();
 if(minimum>2){let signed=0;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length];signed+=p[i][0]*b[1]-b[0]*p[i][1];}if(signed>0)p.reverse();}
 return p;
}
function area(p){let a=0;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length];a+=p[i][0]*b[1]-b[0]*p[i][1];}return Math.abs(a)/2;}
function bounds(p){return{minX:Math.min(...p.map(q=>q[0])),maxX:Math.max(...p.map(q=>q[0])),minZ:Math.min(...p.map(q=>q[1])),maxZ:Math.max(...p.map(q=>q[1]))};}
function mean(p){return[p.reduce((v,q)=>v+q[0],0)/p.length,p.reduce((v,q)=>v+q[1],0)/p.length];}
function inPolygon(x,z,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
 const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function edgeDistance(x,z,poly){let d=Infinity;for(let i=0;i<poly.length;i++)d=Math.min(d,segmentDistance(x,z,poly[i],poly[(i+1)%poly.length]));return d;}
function contracted(poly,c,scale){return poly.map(p=>[c[0]+(p[0]-c[0])*scale,c[1]+(p[1]-c[1])*scale]);}
function shape(outer,holes=[]){const s=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));for(const h of holes)s.holes.push(new THREE.Path(h.map(([x,z])=>new THREE.Vector2(x,-z))));return s;}
function randomSource(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function hash(text){let value=2166136261;for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;return value;}
function lineLength(p){let length=0;for(let i=1;i<p.length;i++)length+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return length;}
function sampleLine(p,spacing){const out=[];let travel=0,next=0;for(let i=1;i<p.length;i++){
 const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-8)continue;
 while(next<=travel+len){const t=(next-travel)/len;if(t>=-1e-6)out.push({x:a[0]+dx*t,z:a[1]+dz*t,tx:dx/len,tz:dz/len});next+=spacing;}travel+=len;
}return out;}
function ribbon(p,width){const left=[],right=[];for(let i=0;i<p.length;i++){
 const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
 left.push([p[i][0]-dz/l*width/2,p[i][1]+dx/l*width/2]);right.push([p[i][0]+dz/l*width/2,p[i][1]-dx/l*width/2]);
}return[...left,...right.reverse()];}

/**
 * All geometry consumes caller-projected world contours. Layout arrays:
 * islands:{id,outer,holes,kind,patches,canopyHeightMeters};
 * lines:{id,points,color,widthMeters,closed}; benches:{id,points,widthMeters,heightMeters};
 * planters:{id,outer,center,kind,heightMeters,planting}; pebbles:{id,outer,center,heightMeters};
 * mediaColumns:{id,base,heightMeters,cyanRatio}; trees:{id,base,heightMeters,crownRadiusMeters}.
 * Heights are reconstruction estimates from the declared source planes.
 */
export function addForecourtLandscape(parent,{materials:sharedMaterials={},layout={},groundHeight=null}={}){
 const group=new THREE.Group();group.name='Panorama-traced forecourt planting and light inlays · v30 material refinement';group.userData={type:'forecourt-landscape',referenceVersion:29,fidelityRevision:30};parent.add(group);
 const baseY=finite(layout.baseY??.025,'baseY'),colliders=[],solids=[],objects=[],sourceIds=new Set();
 const materials={
  soil:createMineralMaterial(0x50503b,{grain:.14,scale:5,name:'Traced garden planting soil'}),
  edge:createMineralMaterial(0xcecec5,{grain:.035,scale:3,name:'Thin pale garden edging'}),
  shrub:createFoliageMaterial(0xffffff,{dense:true}),tree:createFoliageMaterial(0xffffff,{dense:true}),
  bark:new THREE.MeshStandardMaterial({color:0x766454,roughness:1}),
  cream:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,vertexColors:true,side:THREE.DoubleSide}),
  burgundy:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,vertexColors:true,side:THREE.DoubleSide}),
  grass:new THREE.MeshStandardMaterial({color:0x7a865a,roughness:1,side:THREE.DoubleSide}),
  planter:createMineralMaterial(0xe8e7dd,{grain:.026,scale:2,name:'White formed promenade planters'}),
  potDark:new THREE.MeshStandardMaterial({color:0x515b5c,roughness:.73,metalness:.07}),
  pebble:createMineralMaterial(0xe9e8df,{grain:.019,scale:2,name:'Smooth low white promenade seats'}),
  timber:createMineralMaterial(0xbca073,{grain:.10,scale:6,name:'Warm timber edges of traced flowerbeds'}),
  frame:new THREE.MeshStandardMaterial({color:0x5b625d,roughness:.63,metalness:.21}),
  purple:new THREE.MeshStandardMaterial({color:0xc05ddd,emissive:0xc94eef,emissiveIntensity:.32,roughness:.69}),
  cyan:new THREE.MeshStandardMaterial({color:0x8dccd3,emissive:0x62d7ee,emissiveIntensity:.065,roughness:.56}),
  whiteLine:new THREE.MeshStandardMaterial({color:0xe6e7e3,roughness:.73,metalness:0}),
  mediaBase:new THREE.MeshStandardMaterial({color:0xb3bcb9,roughness:.71,metalness:.20}),
 };
 materials.shrub.name='Layered source garden shrub leaves';materials.tree.name='Source forecourt tree leaves';
 materials.purple.name='Thin magenta physical paving inlays and rigid rod tips';materials.cyan.name='Cyan rigid media columns';
 const metadata={version:29,fidelityRevision:30,source:layout.source??null,objects,islands:[],lines:[],benches:[],planters:[],pebbles:[],mediaColumns:[],trees:[],planting:{shrubs:0,creamFlowerHeads:0,redFlowerHeads:0,grassClumps:0},waterJets:0};
 const add=(geometry,material,id,type,name,castShadow=true)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.userData={sourceId:id,sourceIds:[id],type,referenceVersion:29,noAutomaticCollider:true};group.add(mesh);return mesh;
 };
 function register(value,type){if(!value.id||sourceIds.has(value.id))throw new TypeError(`Duplicate/empty forecourt landscape source id: ${value.id}`);sourceIds.add(value.id);const record={id:value.id,type};objects.push(record);return record;}
 function slab(outer,holes,bottom,height,material,id,type,name){const g=new THREE.ExtrudeGeometry(shape(outer,holes),{depth:height,bevelEnabled:false,curveSegments:16});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);return add(g,material,id,type,name);}
 function surface(outer,holes,y,material,id,type,name){const g=new THREE.ShapeGeometry(shape(outer,holes));g.rotateX(-Math.PI/2);g.translate(0,y,0);return add(g,material,id,type,name,false);}
 function walls(bottom,top,y0,y1,material,id,name){const pos=[];for(let i=0;i<bottom.length;i++){
  const j=(i+1)%bottom.length,a=[bottom[i][0],y0,bottom[i][1]],b=[bottom[j][0],y0,bottom[j][1]],c=[top[j][0],y1,top[j][1]],d=[top[i][0],y1,top[i][1]];
  for(const q of[a,b,c,a,c,d])pos.push(...q);
 }const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.computeVertexNormals();return add(g,material,id,'planter-wall',name);}
 // Indexed rings share normals across both the source contour and the vertical
 // profile. The former unindexed five-ring mesh could only produce flat facets.
 function profileMesh(outer,c,levels,bottom,height,material,id,type,name){
  const positions=[],uv=[],indices=[],n=outer.length;
  for(let k=0;k<levels.length;k++){const [scale,y]=levels[k];for(let i=0;i<n;i++){positions.push(c[0]+(outer[i][0]-c[0])*scale,bottom+height*y,c[1]+(outer[i][1]-c[1])*scale);uv.push(i/n,y);}}
  for(let k=1;k<levels.length;k++)for(let i=0;i<n;i++){const j=(i+1)%n,a=(k-1)*n+i,b=(k-1)*n+j,cc=k*n+j,d=k*n+i;indices.push(a,b,cc,a,cc,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return add(g,material,id,type,name);
 }
 function roundCollider(p,width=.05){const closed=[...p,p[0]];for(const a of sampleLine(closed,.5)){
  const b=[a.x+a.tx*.5,a.z+a.tz*.5];colliders.push({type:'segment',a:[a.x,a.z],b,radius:width});
 }}
 const shrubPoints=[],creamPoints=[],redPoints=[],grassPoints=[],treePoints=[];
 const shrubGeometry=moundedShrubGeometry(.55,.76);shrubGeometry.computeBoundingBox();const shrubRadius=shrubGeometry.userData.foliage.radius;
 function fillGarden(outer,holes,options){
  const b=bounds(outer),random=randomSource(hash(options.id)),special=options.kind==='flowerbed',spacing=special?.37:.66,canopy=options.canopyHeightMeters??.85,soilY=baseY+.009;
  const valid=(x,z)=>inPolygon(x,z,outer)&&!holes.some(h=>inPolygon(x,z,h));
  const patches=(options.patches??[]).map(p=>({...p,outer:points(p.outer,p.id)}));
  let accepted=0;
  for(let x=b.minX+spacing*.45;x<b.maxX;x+=spacing)for(let z=b.minZ+spacing*.45;z<b.maxZ;z+=spacing){
   const px=x+(random()-.5)*spacing*.66,pz=z+(random()-.5)*spacing*.66;if(!valid(px,pz))continue;
   let clear=edgeDistance(px,pz,outer);for(const h of holes)clear=Math.min(clear,edgeDistance(px,pz,h));if(clear<.08)continue;
   const wide=Math.min(special?.64:.93+random()*.35,clear/shrubRadius*.94),height=(special?.38+random()*.14:.43+random()*.29)*canopy;
   const patchTone=Math.min(4,Math.floor((.5+.25*Math.sin(px*.71)+.25*Math.sin(pz*.63))*4.999));
   const redPatch=special&&patches.some(p=>inPolygon(px,pz,p.outer));
   // The source's burgundy shapes are continuous low planted masses, not a
   // handful of pink dots sprinkled over an otherwise green bed.
   const colour=special?(redPatch?0x622438:0x98977f):[0x49653e,0x506f44,0x597347,0x405d3c,0x4d6841][patchTone];
   shrubPoints.push({x:px,z:pz,y:soilY,sx:wide,sy:height/.76,sz:wide*(.88+random()*.17),angle:random()*TAU,colour,sourceId:options.id});
   accepted++;
   const blossomCount=special?4:2+Math.floor(random()*3);
   for(let j=0;j<blossomCount;j++){
    const a=random()*TAU,reach=Math.sqrt(random())*wide*shrubRadius*.85,fx=px+Math.cos(a)*reach,fz=pz+Math.sin(a)*reach;
    if(!valid(fx,fz)||edgeDistance(fx,fz,outer)<.10)continue;
    const flower={x:fx,z:fz,y:soilY,stemHeight:height*(1.10+random()*.31),scale:special?.78+random()*.30:.94+random()*.44,angle:random()*TAU,sourceId:options.id};
    const red=special&&patches.some(p=>inPolygon(fx,fz,p.outer));(red?redPoints:creamPoints).push(flower);
   }
   if(!special&&accepted%2===0)grassPoints.push({x:px,z:pz,y:soilY+.001,scale:.8+random()*.7,angle:random()*TAU,sourceId:options.id});
  }
  return accepted;
 }

 for(const source of layout.islands??[]){
  const record=register(source,'planted-island'),outer=points(source.outer,source.id),holes=(source.holes??[]).map((h,i)=>points(h,`${source.id}.hole${i}`));
  const a=area(outer)-holes.reduce((sum,h)=>sum+area(h),0);if(a<=.01)throw new TypeError(`Traced garden ${source.id} has no positive area`);
  surface(outer,holes,baseY+.008,materials.soil,source.id,'garden-soil','Source-traced organic planting island');
  const c=mean(outer),inner=contracted(outer,c,.995);slab(outer,[inner],baseY-.006,.046,materials.edge,source.id,'garden-edge','Low fine pale edge of source-traced planting bed');
  for(const hole of holes){const hc=mean(hole),ho=contracted(hole,hc,1.008);slab(ho,[hole],baseY-.006,.046,materials.edge,source.id,'garden-edge','Low pale edge of pedestrian opening through planting');}
  const count=fillGarden(outer,holes,source);Object.assign(record,{outer,holes,area:a,kind:source.kind??'mixed',shrubs:count});metadata.islands.push(record);solids.push({outer,holes,type:'landscape',sourceId:source.id});
 }

 // Low formed vessels retain their source lip contours; their soil is visibly recessed.
 for(const source of layout.planters??[]){
  const record=register(source,'planter'),outer=points(source.outer,source.id),c=source.center?point(source.center):mean(outer),sourceHeight=finite(source.heightMeters??.65,`${source.id}.height`),dark=source.kind==='dark-topiary';
  const h=dark?sourceHeight*.86:THREE.MathUtils.clamp(sourceHeight*.80,.32,.55),inner=contracted(outer,c,.935),bottom=contracted(outer,c,dark?.78:.88),material=dark?materials.potDark:materials.planter;
  const profile=dark?[[.78,0],[.83,.2],[.94,.72],[1,.95],[1,1]]:[[.88,0],[.89,.10],[.925,.34],[.966,.66],[.992,.89],[1,1]];
  profileMesh(outer,c,profile,baseY+.008,h-.008,material,source.id,'planter-wall','Smooth thin-walled low planter');surface(outer,[inner],baseY+h,material,source.id,'planter-rim','Narrow formed lip of source planter');
  walls(inner,contracted(inner,c,.97),baseY+h,baseY+h-.055,material,source.id,'Recessed planter inner rim');surface(contracted(inner,c,.985),[],baseY+h-.052,materials.soil,source.id,'planter-soil','Visible recessed planter fill');
  const b=bounds(inner),random=randomSource(hash(source.id)),r=Math.min(b.maxX-b.minX,b.maxZ-b.minZ)/2;
  if(dark){
   const crown={x:c[0],z:c[1],y:baseY+h-.050,sx:Math.max(.48,r*1.75),sy:1.28,sz:Math.max(.45,r*1.68),angle:random()*TAU,colour:0x688645,sourceId:source.id};shrubPoints.push(crown);
  }else{
   for(let x=b.minX+.10;x<b.maxX;x+=.29)for(let z=b.minZ+.10;z<b.maxZ;z+=.29){
    const px=x+(random()-.5)*.15,pz=z+(random()-.5)*.15;if(!inPolygon(px,pz,inner))continue;
    const green=source.planting==='green',rootY=baseY+h-.050,height=.20+random()*.14,scale=Math.min(.56,edgeDistance(px,pz,inner)/.55+.10);shrubPoints.push({x:px,z:pz,y:rootY,sx:scale,sy:height/.76,sz:scale*.95,angle:random()*TAU,colour:green?0x8b9b58:0x7c8b5b,sourceId:source.id});
    if(!green){const red=source.planting==='red-cream'&&random()<.58;for(let j=0;j<2;j++)(red?redPoints:creamPoints).push({x:px,z:pz,y:rootY,stemHeight:height*(1.15+random()*.30),scale:.66+random()*.27,angle:random()*TAU,sourceId:source.id});}
   }
  }
  Object.assign(record,{outer,center:c,height:h,sourceHeightEstimate:sourceHeight,wallProfile:'smooth low formed vessel',rimScale:.935,kind:source.kind??'white',planting:source.planting??'green'});metadata.planters.push(record);solids.push({outer,holes:[],sourceId:source.id,type:'planter'});roundCollider(bottom,.05);
 }

 // White pebble seats are shallow asymmetric forms, never generic full spheres.
 for(const source of layout.pebbles??[]){
  const record=register(source,'pebble-seat'),outer=points(source.outer,source.id),c=source.center?point(source.center):mean(outer),h=finite(source.heightMeters??.38,`${source.id}.height`),levels=[],start=-.25,den=1-Math.sin(start);
  for(let i=0;i<=28;i++){const a=start+(Math.PI/2-start)*i/28;levels.push([Math.max(.00015,Math.cos(a)),(Math.sin(a)-Math.sin(start))/den]);}
  profileMesh(outer,c,levels,baseY+.003,h,materials.pebble,source.id,'pebble-seat','Continuous organic white seat with smooth shared normals');
  Object.assign(record,{outer,center:c,height:h,profileRings:29,smoothNormals:true});metadata.pebbles.push(record);solids.push({outer,holes:[],sourceId:source.id,type:'seat'});roundCollider(outer,.045);
 }

 // Timber edge seats use the observed line, including the straight side of the signature bed.
 for(const source of layout.benches??[]){
  const record=register(source,'timber-bench'),p=points(source.points,source.id,2),width=finite(source.widthMeters??.46,`${source.id}.width`),height=finite(source.heightMeters??.43,`${source.id}.height`);
  const outline=ribbon(p,width);slab(outline,[],baseY+height-.09,.09,materials.timber,source.id,'timber-bench','Warm timber seat along traced bed edge');
  for(const a of sampleLine(p,1.6)){const g=new THREE.BoxGeometry(.08,Math.max(.05,height-.09),width*.65);g.rotateY(-Math.atan2(a.tz,a.tx));g.translate(a.x,baseY+(height-.09)/2,a.z);add(g,materials.frame,source.id,'bench-support','Slender dark support below timber edge seat');}
  for(let i=1;i<p.length;i++)colliders.push({type:'segment',a:p[i-1],b:p[i],radius:width/2+.045});
  Object.assign(record,{points:p,width,height,length:lineLength(p)});metadata.benches.push(record);
 }

 // Real inlay ribbons are flush with the paving; hidden reference endpoints stay open.
 const spill=[];
 for(const source of layout.lines??[]){
  const record=register(source,'paving-inlay'),p=points(source.points,source.id,2),closed=!!source.closed;if(closed)p.push(p[0]);
  const width=finite(source.widthMeters??.065,`${source.id}.width`),color=source.color??'purple',material=color==='white'?materials.whiteLine:color==='cyan'?materials.cyan:materials.purple;
  const positions=[];for(let i=1;i<p.length;i++){
   const a=p[i-1],b=p[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<1e-7)continue;
   const nx=-dz/l*width/2,nz=dx/l*width/2,lineY=(x,z)=>groundHeight?groundHeight(x,z)+.012:baseY+.014,corners=[[a[0]+nx,lineY(a[0]+nx,a[1]+nz),a[1]+nz],[a[0]-nx,lineY(a[0]-nx,a[1]-nz),a[1]-nz],[b[0]+nx,lineY(b[0]+nx,b[1]+nz),b[1]+nz],[b[0]-nx,lineY(b[0]-nx,b[1]-nz),b[1]-nz]];
   for(const k of[0,2,1,1,2,3])positions.push(...corners[k]);
  }
  if(positions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));g.computeVertexNormals();add(g,material,source.id,'paving-inlay',`${color} source-traced physical paving inlay`,false);}
  if(color!=='white')for(const a of sampleLine(p,1.35))spill.push({...a,color,power:.13});
  Object.assign(record,{points:p,width,color,closed,length:lineLength(p),sourceHiddenConnections:source.hiddenConnections??null});metadata.lines.push(record);
 }

 const mediaLow=[],mediaTop=[],mediaBase=[];
 for(const source of layout.mediaColumns??[]){
  const record=register(source,'rigid-luminous-column'),[x,z]=point(source.base,source.id),height=finite(source.heightMeters??2.12,`${source.id}.height`),ratio=THREE.MathUtils.clamp(source.cyanRatio??.67,.2,.85),bottom=.075,usable=height-bottom;
  mediaBase.push({x,z,y:baseY+.0375,sx:.076,sy:.075,sz:.076,sourceId:source.id});
  mediaLow.push({x,z,y:baseY+bottom+usable*ratio/2,sx:.028,sy:usable*ratio,sz:.028,sourceId:source.id});
  mediaTop.push({x,z,y:baseY+bottom+usable*ratio+usable*(1-ratio)/2,sx:.028,sy:usable*(1-ratio),sz:.028,sourceId:source.id});
  Object.assign(record,{x,z,height,cyanRatio:ratio,kind:'rigid-luminous-column',water:false});metadata.mediaColumns.push(record);colliders.push({type:'circle',x,z,radius:.085});spill.push({x,z,tx:0,tz:1,color:'cyan',power:.07});
 }

 for(const source of layout.trees??[]){
  const record=register(source,'tree'),[x,z]=point(source.base,source.id),height=finite(source.heightMeters??5,`${source.id}.height`),radius=finite(source.crownRadiusMeters??1.8,`${source.id}.crownRadius`);
  const inBed=metadata.islands.find(b=>inPolygon(x,z,b.outer)&&!b.holes.some(h=>inPolygon(x,z,h)));
  if(!inBed)throw new TypeError(`Traced tree ${source.id} foot lies outside the supplied planted islands`);
  treePoints.push({x,z,y:baseY,height,radius,sourceId:source.id,colour:[0x53763d,0x59812f,0x4f7437,0x63823b][treePoints.length%4]});colliders.push({type:'circle',x,z,radius:.17});
  Object.assign(record,{x,z,height,crownRadius:radius,islandId:inBed.id,anchorConfidence:source.anchorConfidence??'source'});metadata.trees.push(record);
 }

 const dummy=new THREE.Object3D(),seasonal=[];
 function instances(geometry,material,list,name,type,place){
  if(!list.length){geometry.dispose();return null;}
  const mesh=new THREE.InstancedMesh(geometry,material,list.length);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={type,sourceIds:[...new Set(list.map(p=>p.sourceId))],referenceVersion:29,noAutomaticCollider:true};
  list.forEach((p,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);place(dummy,p,i);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(p.colour!==undefined)mesh.setColorAt(i,new THREE.Color(p.colour));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
 }
 const shrubs=instances(shrubGeometry,materials.shrub,shrubPoints,'Layered shrubs clipped to traced planting islands and vessels','garden-shrub',(d,p)=>{d.position.set(p.x,p.y,p.z);d.rotation.y=p.angle;d.scale.set(p.sx,p.sy,p.sz);});
 if(shrubs)seasonal.push({mesh:shrubs,original:shrubs.instanceMatrix.array.slice(),winterScale:.76});
 const cream=instances(perennialSprigGeometry(0xe6e3d3),materials.cream,creamPoints,'Fine cream-flowering perennial stems rooted in their planting surface','garden-flower',(d,p)=>{d.position.set(p.x,p.y,p.z);d.rotation.y=p.angle;d.scale.set(p.scale,p.stemHeight,p.scale);});
 const red=instances(perennialSprigGeometry(0x702139),materials.burgundy,redPoints,'Rooted burgundy perennial stems in source-traced colour patches','garden-flower',(d,p)=>{d.position.set(p.x,p.y,p.z);d.rotation.y=p.angle;d.scale.set(p.scale,p.stemHeight,p.scale);});
 // Broad shrub masses retain cast shadows. Individual fine petals still receive
 // those shadows, but no longer repeat millions of triangles in the shadow pass.
 if(cream)cream.castShadow=false;if(red)red.castShadow=false;
 const grassPositions=[];for(let i=0;i<12;i++){
  const a=i*2.399,dx=Math.cos(a),dz=Math.sin(a),h=.32+(i%4)*.054,w=.012;
  for(let j=0;j<2;j++){const vertex=(t,s)=>[dx*(.055+.14*t*t)-dz*w*(1-t*.8)*s,h*t,dz*(.055+.14*t*t)+dx*w*(1-t*.8)*s],aa=vertex(j/2,-1),b=vertex((j+1)/2,-1),c=vertex((j+1)/2,1),d=vertex(j/2,1);for(const p of[aa,b,c,aa,c,d])grassPositions.push(...p);}
 }
 const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassPositions,3));grassGeo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(grassPositions.length/3*2),2));grassGeo.computeVertexNormals();
 instances(grassGeo,materials.grass,grassPoints,'Fine grass blades below the flowering shrub layer','garden-grass',(d,p)=>{d.position.set(p.x,p.y,p.z);d.rotation.y=p.angle;d.scale.setScalar(p.scale);});
 const treeTrunks=instances(branchingTrunk(.18,1),materials.bark,treePoints,'Branching trunks at source forecourt tree anchors','garden-tree-trunk',(d,p)=>{d.position.set(p.x,baseY+p.height*.27,p.z);d.scale.set(1,p.height*.54,1);});
 const crowns=instances(crownGeometry(1,1.9,false,1),materials.tree,treePoints,'Layered porous forecourt tree crowns','garden-tree-crown',(d,p,i)=>{d.position.set(p.x,baseY+p.height*.72,p.z);d.rotation.y=i*2.399;d.scale.set(p.radius,p.height*.50/1.9,p.radius);});
 if(crowns)seasonal.push({mesh:crowns,original:crowns.instanceMatrix.array.slice(),winterScale:.57});
 for(const [list,material,name]of[[mediaBase,materials.mediaBase,'Small structural feet of 18 source light columns'],[mediaLow,materials.cyan,'Cyan lower segments of rigid source light columns'],[mediaTop,materials.purple,'Magenta upper segments of rigid source light columns']])instances(new THREE.CylinderGeometry(1,1,1,8),material,list,name,'rigid-luminous-column',(d,p)=>{d.position.set(p.x,p.y,p.z);d.scale.set(p.sx,p.sy,p.sz);});
 metadata.planting={shrubs:shrubPoints.length,creamFlowerHeads:creamPoints.length,redFlowerHeads:redPoints.length,grassClumps:grassPoints.length,flowerPrimitive:'rooted three-stem perennial sprig with nine small petalled blooms',creamSprigs:creamPoints.length,redSprigs:redPoints.length,rooted:true};
 // Distant tessellation keeps every rooted plant and every colour-patch anchor.
 // The complete original remains within 18 optical metres of any shrub cell,
 // or 8 optical metres of any flower cell, with an ordered transition after it.
 const spatialInstances=[
  shrubs&&spatiallyPartitionInstances(shrubs,{cellSize:20,lod:{geometry:moundedShrubLODGeometry(.55,.76),distance:24,fade:12}}),
  cream&&spatiallyPartitionInstances(cream,{cellSize:20,lod:{geometry:perennialSprigLODGeometry(0xe6e3d3),distance:12,fade:8}}),
  red&&spatiallyPartitionInstances(red,{cellSize:20,lod:{geometry:perennialSprigLODGeometry(0x702139),distance:12,fade:8}}),
 ].filter(Boolean);

 const field=spill.length?createLightField(group,spill.length,{color:0xd082ed}):null;
 if(field){spill.forEach((p,i)=>field.set(i,p.x,groundHeight?groundHeight(p.x,p.z)+.017:baseY+.018,p.z,.20,.85,Math.atan2(p.tx,p.tz),new THREE.Color(p.color==='cyan'?0x83dcea:0xd67bed),p.power));field.commit();field.mesh.name='Soft night spill beside traced forecourt light inlays';field.mesh.userData={type:'forecourt-light-spill',referenceVersion:29};}

 // Merge opaque static parts by material/shadow flags, retaining source IDs for QA.
 const batches=new Map();for(const mesh of [...group.children]){
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.material.transparent)continue;
  const key=`${mesh.material.uuid}:${Number(mesh.castShadow)}`;let batch=batches.get(key);if(!batch){batch={material:mesh.material,shadow:mesh.castShadow,geometry:[],sourceIds:new Set(),types:new Set()};batches.set(key,batch);}
  mesh.updateMatrix();const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);batch.geometry.push(geo);for(const id of mesh.userData.sourceIds??[])batch.sourceIds.add(id);batch.types.add(mesh.userData.type);mesh.geometry.dispose();group.remove(mesh);
 }
 for(const batch of batches.values()){
  const n=batch.geometry.reduce((sum,g)=>sum+g.attributes.position.count,0),p=new Float32Array(n*3),normal=new Float32Array(n*3),uv=new Float32Array(n*2);let offset=0;
  for(const g of batch.geometry){p.set(g.attributes.position.array,offset*3);normal.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;g.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,batch.material);mesh.name=`Source forecourt · ${[...batch.types].join(', ')}`;mesh.castShadow=batch.shadow;mesh.receiveShadow=true;mesh.userData={sourceIds:[...batch.sourceIds],types:[...batch.types],referenceVersion:29,noAutomaticCollider:true};group.add(mesh);
 }
 const matrix=new THREE.Matrix4();let disposed=false;
 function setNight(value){const n=clamp01(value);materials.purple.emissiveIntensity=.32+n*2.08;materials.cyan.emissiveIntensity=.065+n*1.845;if(field)field.strength.value=n;}
 function setWetness(value){const wet=clamp01(value);materials.pebble.roughness=.92-wet*.35;materials.planter.roughness=.91-wet*.35;materials.timber.roughness=.88-wet*.35;if(field)field.wetness.value=wet;}
 function setSeason(winter,month){
  materials.shrub.color.set(winter?0xb8c2b1:0xffffff);materials.tree.color.set(winter?0xc5cbbf:[8,9,10].includes(month)?0xd7c292:0xffffff);materials.soil.color.set(winter?0xd3ddd4:0x50503b);materials.grass.color.set(winter?0xa2ae97:0x7a865a);
  if(cream)cream.visible=!winter;if(red)red.visible=!winter;
  for(const s of seasonal){for(let i=0;i<s.mesh.count;i++){matrix.fromArray(s.original,i*16);if(winter)matrix.scale(new THREE.Vector3(s.winterScale,s.winterScale,s.winterScale));s.mesh.setMatrixAt(i,matrix);}s.mesh.instanceMatrix.needsUpdate=true;s.mesh.computeBoundingSphere();}
  for(const batch of spatialInstances)batch.sync();
 }
 return{group,materials,metadata,colliders,solids,field,shrubs,spatialInstances,flowers:{cream,red},trees:{trunks:treeTrunks,crowns},setNight,setWetness,setSeason,update(t){if(field)field.clock.value=Number.isFinite(t)?t:0;},dispose(){
  if(disposed)return;disposed=true;field?.mesh.dispose();field?.dispose();parent.remove(group);for(const batch of spatialInstances)batch.dispose();const geometries=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});for(const geometry of geometries)geometry.dispose();disposeOwnedMaterials(materials);
 }};
}
