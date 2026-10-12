// @r_peredelkino · cafe terraces and organic furniture from the supplied
// 09 October retail promenade views 12.03.36 / 39 / 41.
import * as T from './vendor/three.module.js';
const TAU=Math.PI*2;
export function addPromenadeFurniture(group,m,data){
 const colliders=[],cafes=[],planters=[],pebbles=[],meshes=[];
 m.terracotta??=new T.MeshStandardMaterial({color:0xb26d52,roughness:.77});
 m.cafeFabric??=new T.MeshStandardMaterial({color:0xf4f1e8,roughness:.94});
 m.cafePaving??=new T.MeshStandardMaterial({color:0x606a6b,roughness:.92});
 const add=(geo,mat,name)=>{const o=new T.Mesh(geo,mat);o.name=name;o.castShadow=o.receiveShadow=true;o.userData.noAutomaticCollider=true;group.add(o);meshes.push(o);return o;};
 const box=(w,h,d,x,y,z,mat,angle=0)=>{const o=add(new T.BoxGeometry(w,h,d),mat,'Cafe furniture');o.position.set(x,y+h/2,z);o.rotation.y=angle;return o;};
 const cylinder=(x,z,r,h,y,mat)=>{const o=add(new T.CylinderGeometry(r,r,h,20),mat,'Cafe table or umbrella support');o.position.set(x,y+h/2,z);return o;};
 const tube=(points,r,mat,closed=false)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed,'centripetal'),Math.max(20,points.length*3),r,6,closed),mat,'Flowing promenade furniture edge');
 const shape=(points,holes=[])=>{const s=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));for(const hole of holes)s.holes.push(new T.Path(hole.map(([x,z])=>new T.Vector2(x,-z))));return s;};
 const slab=(points,holes,y,h,mat,name)=>{const g=new T.ExtrudeGeometry(shape(points,holes),{depth:h,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);g.translate(0,y,0);return add(g,mat,name);};
 function umbrella(cx,cz,angle){
  const co=Math.cos(angle),si=Math.sin(angle),world=(x,z,y)=>[cx+co*x+si*z,y,cz-si*x+co*z],corners=[[-1.3,-1.3],[1.3,-1.3],[1.3,1.3],[-1.3,1.3]],positions=[],uv=[];
  const center=[cx,2.86,cz],low=[cx,2.83,cz];
  for(let i=0;i<4;i++){const a=world(...corners[i],2.47),b=world(...corners[(i+1)%4],2.47),aa=[a[0],2.44,a[2]],bb=[b[0],2.44,b[2]];for(const p of [center,b,a,low,aa,bb,a,b,bb,a,bb,aa]){positions.push(...p);uv.push(0,0);}tube([center,a],.015,m.white);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();add(g,m.cafeFabric,'White square cafe umbrella with a shallow pitched canopy');cylinder(cx,cz,.035,2.83,.03,m.white);cylinder(cx,cz,.21,.045,.025,m.white);
 }
 function chair(cx,cz,angle){
  const co=Math.cos(angle),si=Math.sin(angle),p=(x,z)=>[cx+co*x+si*z,cz-si*x+co*z];
  box(.50,.060,.50,cx,.43,cz,m.terracotta,angle);const back=p(0,.225);box(.50,.38,.047,back[0],.48,back[1],m.terracotta,angle);
  for(const dx of [-.205,.205])for(const dz of [-.205,.205]){const q=p(dx,dz);box(.025,.43,.025,q[0],.025,q[1],m.dark,angle);}
  colliders.push({type:'box',x:cx,z:cz,width:.54,depth:.57,angle});
 }
 for(const c of data.cafes){
  const co=Math.cos(c.angle),si=Math.sin(c.angle),world=(x,z)=>[c.x+co*x+si*z,c.z-si*x+co*z],pad=c.apron?.outer??Array.from({length:80},(_,i)=>{const a=i/80*TAU;return world(Math.cos(a)*3.2,Math.sin(a)*1.62);});
  slab(pad,c.apron?.holes??[],.018,.010,m.cafePaving,'Dark cafe terrace aligned with the commercial shopfront');tube(pad.map(([x,z])=>[x,.042,z]),.026,m.white,true);
  const tables=[];for(const u of [-1.48,1.48]){const p=world(u,0);cylinder(...p,.53,.055,.735,m.white);cylinder(...p,.075,.685,.05,m.dark);cylinder(...p,.25,.055,.025,m.dark);umbrella(...p,c.angle);colliders.push({type:'circle',x:p[0],z:p[1],radius:.55});
   for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,q=world(u+Math.cos(a)*.91,Math.sin(a)*.91);chair(...q,c.angle+Math.PI/2-a);}
   tables.push({x:p[0],z:p[1],radius:.53,umbrella:2.6});
  }
  cafes.push({id:c.id,x:c.x,z:c.z,angle:c.angle,frontagePoint:c.frontagePoint,setback:c.setback,apron:c.apron,tables,seats:8});
 }
 // The white, low boat forms and flattened pebble seats flank the cafe islands.
 // Their planting is real foliage, using the same alpha-cut material as the
 // promenade's dense underplanting rather than opaque spherical topiary.
 for(const [index,c] of data.cafes.entries()){
  if(index%2)continue;const co=Math.cos(c.angle),si=Math.sin(c.angle),world=(u,v)=>[c.x+co*u+si*v,c.z-si*u+co*v],center=world(4.70,-.05),rx=1.65,rz=.69;
  const outer=Array.from({length:72},(_,i)=>{const a=i/72*TAU,r=1+.09*Math.sin(3*a);return[center[0]+co*Math.cos(a)*rx*r+si*Math.sin(a)*rz*r,center[1]-si*Math.cos(a)*rx*r+co*Math.sin(a)*rz*r];}),inner=outer.map(p=>[center[0]+(p[0]-center[0])*.84,center[1]+(p[1]-center[1])*.78]);
  slab(outer,[inner],.025,.56,m.white,'Organic white boat planter beside the shop promenade');slab(inner,[],.47,.025,m.soil,'Recessed planter soil');
  for(let i=0;i<17;i++){const a=i*2.399,r=Math.sqrt((i+.5)/17),p=[center[0]+co*Math.cos(a)*rx*.7*r+si*Math.sin(a)*rz*.6*r,center[1]-si*Math.cos(a)*rx*.7*r+co*Math.sin(a)*rz*.6*r],o=add(new T.IcosahedronGeometry(.29,1),i%5===0?m.flower:m.shrub,'Mixed planting within the white boat');o.position.set(p[0],.62,p[1]);o.scale.set(1.2,.88,.85);}
  colliders.push({type:'box',x:center[0],z:center[1],width:rx*2,depth:rz*2,angle:c.angle});planters.push({center,outer});
  const q=world(-4.05,.15),stone=add(new T.SphereGeometry(1,24,12),m.white,'Flattened white pebble seat beside the cafe');stone.position.set(q[0],.265,q[1]);stone.scale.set(.90,.30,.52);stone.rotation.y=c.angle;colliders.push({type:'box',x:q[0],z:q[1],width:1.7,depth:.95,angle:c.angle});pebbles.push(q);
 }
 // Fine grasses fill the gaps beneath the shrubs without changing any traced
 // planting island. Their actual crossed leaves remain legible at walking height.
 const grassPositions=[],grassColors=[],grassUV=[];
 for(let blade=0;blade<9;blade++){const a=blade*2.399,dx=Math.cos(a),dz=Math.sin(a),height=.34+(blade%4)*.085,width=.032,green=new T.Color(blade%3===0?0x9b9d77:0x6c7f53);for(let part=0;part<3;part++){
  const edge=(t,side)=>[dx*(.12+.19*t*t)-dz*width*(1-t*.78)*side,height*t,dz*(.12+.19*t*t)+dx*width*(1-t*.78)*side],a=edge(part/3,-1),b=edge((part+1)/3,-1),c=edge((part+1)/3,1),d=edge(part/3,1);
  for(const p of [a,b,c,a,c,d,c,b,a,d,c,a]){grassPositions.push(...p);grassColors.push(green.r,green.g,green.b);grassUV.push(0,0);}
 }}
 const grassGeometry=new T.BufferGeometry();grassGeometry.setAttribute('position',new T.Float32BufferAttribute(grassPositions,3));grassGeometry.setAttribute('color',new T.Float32BufferAttribute(grassColors,3));grassGeometry.setAttribute('uv',new T.Float32BufferAttribute(grassUV,2));grassGeometry.computeVertexNormals();m.lowMeadow=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});
 const meadow=new T.InstancedMesh(grassGeometry,m.lowMeadow,data.shrubs.length*2),dummy=new T.Object3D();meadow.name='Continuous fine underplanting in the shop promenade islands';meadow.receiveShadow=true;
 data.shrubs.forEach(([x,z,s],i)=>{for(let j=0;j<2;j++){const a=i*2.399+j*Math.PI;dummy.position.set(x+Math.cos(a)*.26,.031,z+Math.sin(a)*.26);dummy.rotation.y=a;dummy.scale.setScalar(.76+s*.36);dummy.updateMatrix();meadow.setMatrixAt(i*2+j,dummy.matrix);}});meadow.instanceMatrix.needsUpdate=true;group.add(meadow);
 return{cafes,planters,pebbles,colliders,meshes,meadow,umbrellaCount:cafes.length*2,tableCount:cafes.length*2,chairCount:cafes.length*8,setSeason(winter){m.lowMeadow.color.set(winter?0xb5c1b3:0xffffff);}};
}
