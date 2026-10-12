// Reduced tessellation for distant planted beds. Close views retain the exact
// original geometry from botanical-geometry.js. No planting anchor is removed.
import * as T from './vendor/three.module.js';

function combine(parts){
 const geometries=parts.map(g=>g.index?g.toNonIndexed():g),count=geometries.reduce((sum,g)=>sum+g.attributes.position.count,0),out=new T.BufferGeometry();
 for(const [name,itemSize] of [['position',3],['normal',3],['uv',2],['color',3]]){
  if(!geometries.every(g=>g.attributes[name]))continue;
  const array=new Float32Array(count*itemSize);let offset=0;
  for(const g of geometries){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
  out.setAttribute(name,new T.BufferAttribute(array,itemSize));
 }
 geometries.forEach((g,i)=>{g.dispose();if(g!==parts[i])parts[i].dispose();});
 out.computeBoundingBox();out.computeBoundingSphere();return out;
}

// All seventeen original lobes and their positions remain. Their surfaces use
// 4 × 3 segments instead of 6 × 4, where individual lobes are only a few pixels.
export function moundedShrubLODGeometry(radius=.55,height=.76){
 const parts=[],count=17;
 for(let i=0;i<count;i++){
  const a=i*2.399963,ring=i===0?0:.22+.14*(i%5),r=radius*(.25+.045*(i%4));
  const g=new T.SphereGeometry(1,4,3);g.scale(r,height*(.17+.03*(i%3)),r*(.81+.09*(i%3)));
  g.rotateY(a);g.translate(Math.cos(a)*radius*ring,height*(.27+.095*(i%5)),Math.sin(a)*radius*ring);
  const p=g.attributes.position;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),noise=1+.11*Math.sin(x*17+z*13+y*9);p.setXYZ(j,x*noise,y,z*noise);}
  g.computeVertexNormals();parts.push(g);
 }
 const out=combine(parts),b=out.boundingBox,sy=height/(b.max.y-b.min.y);let radiusMax=0;
 for(let i=0;i<out.attributes.position.count;i++)radiusMax=Math.max(radiusMax,Math.hypot(out.attributes.position.getX(i),out.attributes.position.getZ(i)));
 out.translate(0,-b.min.y,0);out.scale(radius/radiusMax,sy,radius/radiusMax);
 const p=out.attributes.position,colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const y=p.getY(i)/height,shade=.67+.26*y+.06*Math.sin(p.getX(i)*19+p.getZ(i)*23);colors.set([shade,Math.min(1,shade*1.015),shade*.97],i*3);}
 out.setAttribute('color',new T.BufferAttribute(colors,3));out.computeBoundingBox();out.computeBoundingSphere();
 out.userData.foliage={rooted:true,clusters:count,rootY:0,height,radius,lod:'distant-tessellation',sourceLobesRetained:true};return out;
}

// Keep all three stems, six leaves, nine flowers and forty-five petals. Only
// the subpixel surface bending and hidden stem caps are removed at distance.
export function perennialSprigLODGeometry(blossom=0xe6e3d3){
 const parts=[],petalColor=new T.Color(blossom),stemColor=new T.Color(0x617049),leafColor=new T.Color(0x778451);
 function colored(g,color){const c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<c.length;i+=3)color.toArray(c,i);g.setAttribute('color',new T.BufferAttribute(c,3));parts.push(g);}
 function leaflet(width,length){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,-length,-width,0,-length*.16,0,0,length,width,0,-length*.16],3));g.setIndex([0,1,2,0,2,3]);
  g.setAttribute('uv',new T.Float32BufferAttribute([.5,0,0,.42,.5,1,1,.42],2));g.computeVertexNormals();return g;
 }
 const up=new T.Vector3(0,1,0),q=new T.Quaternion();
 for(let branch=0;branch<3;branch++){
  const angle=branch*2.399963,h=[1,.79,.91][branch],tip=new T.Vector3(Math.cos(angle)*.09,h,Math.sin(angle)*.09),length=tip.length();
  const stem=new T.CylinderGeometry(.0035,.006,length,3,1,true);q.setFromUnitVectors(up,tip.clone().normalize());stem.applyQuaternion(q);stem.translate(tip.x/2,tip.y/2,tip.z/2);colored(stem,stemColor);
  for(let leaf=0;leaf<2;leaf++){
   const t=.25+leaf*.25,a=angle+leaf*2.4,g=leaflet(.025,.08);g.rotateZ(.55);g.rotateY(a);g.translate(tip.x*t+Math.cos(a)*.033,h*t,tip.z*t+Math.sin(a)*.033);colored(g,leafColor);
  }
  for(let bloom=0;bloom<3;bloom++){
   const a=angle+bloom*2.0944,bx=tip.x+Math.cos(a)*.04,bz=tip.z+Math.sin(a)*.04,by=h-bloom*.026;
   for(let petal=0;petal<5;petal++){
    const pa=petal*Math.PI*.4,g=leaflet(.012,.023);g.rotateY(pa);g.translate(bx+Math.sin(pa)*.017,by,bz+Math.cos(pa)*.017);colored(g,petalColor);
   }
  }
 }
 const out=combine(parts);out.userData.planting={rooted:true,stemCount:3,smallBlooms:9,petals:45,rootY:0,height:1,lod:'distant-tessellation',sourceStemsLeavesAndBloomsRetained:true};return out;
}
