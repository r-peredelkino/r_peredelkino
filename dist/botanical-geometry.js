// @r_peredelkino · reusable three-dimensional branch/crown geometry, no camera-facing forest cards.
import * as T from './vendor/three.module.js';
function combine(parts){let n=0;const gs=parts.map(g=>{const a=g.index?g.toNonIndexed():g;if(a!==g)g.dispose();n+=a.attributes.position.count;return a});const p=new Float32Array(n*3),normal=new Float32Array(n*3),uv=new Float32Array(n*2);let at=0;for(const g of gs){p.set(g.attributes.position.array,at*3);normal.set(g.attributes.normal.array,at*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,at*2);at+=g.attributes.position.count;g.dispose()}const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(p,3));out.setAttribute('normal',new T.BufferAttribute(normal,3));out.setAttribute('uv',new T.BufferAttribute(uv,2));out.computeBoundingSphere();return out;}
export function crownGeometry(radius=2,height=radius*2,pine=false,detail=1){
 const parts=[],count=detail?(pine?40:54):(pine?22:28);
 for(let i=0;i<count;i++){
  const a=i*2.399963,v=(i+.5)/count,vertical=pine?(v-.40)*height*.64:(v-.5)*height*.84;
  const envelope=Math.sqrt(Math.max(.05,1-(2*v-1)**2)),reach=radius*(.22+.56*((i*7)%17)/16)*envelope;
  const sx=radius*(pine?.23:.22)*(1+(i%4)*.11),sy=height*(pine?.11:.12)*(1+(i%3)*.11);
  const g=new T.SphereGeometry(1,detail||pine?8:6,detail||pine?5:4);g.scale(sx,sy,sx*(.76+(i%4)*.11));g.rotateY(a);
  g.translate(Math.cos(a)*reach,vertical,Math.sin(a)*reach);
  const p=g.attributes.position;for(let k=0;k<p.count;k++){
   const x=p.getX(k),y=p.getY(k),z=p.getZ(k),j=1+.065*Math.sin(x*19+z*13+y*11);
   p.setXYZ(k,x*j,y*j,z*j);
  }
  g.computeVertexNormals();parts.push(g);
 }
 const geometry=combine(parts),position=geometry.attributes.position,colors=new Float32Array(position.count*3);
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),light=.76+.16*(y/height+.5)+.08*Math.sin(x*7+z*9+y*11);
  colors[i*3]=light;colors[i*3+1]=Math.min(1,light*1.025);colors[i*3+2]=light*.89;
 }
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.userData.foliage={porous:true,clusters:count};return geometry;
}
export function branchingTrunk(radius=.2,height=4){const parts=[new T.CylinderGeometry(radius*.62,radius,height,9)];for(let i=0;i<9;i++){const angle=i*2.399,y=height*(.05+(i%3)*.1),length=height*(.27+(i%3)*.045),g=new T.CylinderGeometry(radius*.10,radius*.35,length,6);g.rotateZ(.65);g.rotateY(angle);g.translate(Math.cos(angle)*length*.28,y,Math.sin(angle)*length*.28);parts.push(g)}return combine(parts);}

// Rooted planting geometry for close pedestrian views. Unlike the older generic
// crown, its local lower extent is exactly zero: seasonal scaling cannot lift it
// out of the soil. Overlapping lobes retain volume behind the individual leaves.
export function moundedShrubGeometry(radius=.55,height=.76){
 const parts=[],count=17;
 for(let i=0;i<count;i++){
  const a=i*2.399963,ring=i===0?0:.22+.14*(i%5),r=radius*(.25+.045*(i%4));
  const g=new T.SphereGeometry(1,6,4);g.scale(r,height*(.17+.03*(i%3)),r*(.81+.09*(i%3)));
  g.rotateY(a);g.translate(Math.cos(a)*radius*ring,height*(.27+.095*(i%5)),Math.sin(a)*radius*ring);
  const p=g.attributes.position;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),noise=1+.11*Math.sin(x*17+z*13+y*9);p.setXYZ(j,x*noise,y,z*noise);}
  g.computeVertexNormals();parts.push(g);
 }
 const out=combine(parts);out.computeBoundingBox();const b=out.boundingBox,sy=height/(b.max.y-b.min.y);let rmax=0;for(let i=0;i<out.attributes.position.count;i++)rmax=Math.max(rmax,Math.hypot(out.attributes.position.getX(i),out.attributes.position.getZ(i)));const sr=radius/rmax;
 out.translate(0,-b.min.y,0);out.scale(sr,sy,sr);
 const p=out.attributes.position,colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const y=p.getY(i)/height,shade=.67+.26*y+.06*Math.sin(p.getX(i)*19+p.getZ(i)*23);colors.set([shade,Math.min(1,shade*1.015),shade*.97],i*3);}
 out.setAttribute('color',new T.BufferAttribute(colors,3));out.computeBoundingBox();out.computeBoundingSphere();out.userData.foliage={rooted:true,clusters:count,rootY:0,height,radius};return out;
}

// A connected mature-woodland crown with a deep, irregular branch envelope.
// The geometry is normalised so callers can reserve its entire true footprint.
export function woodlandCrownGeometry(radius=1,height=1,pine=true,distant=false){
 const parts=[],count=pine?28:16;
 for(let i=0;i<count;i++){
  const level=Math.floor(i/(pine?4:3)),v=(level+.55)/(Math.ceil(count/(pine?4:3))+.1),a=i*2.399963;
  const envelope=pine?.27+.73*Math.pow(Math.sin(v*Math.PI),.72):.60+.32*Math.sin(v*Math.PI),reach=radius*(pine?.30+.09*(i%4):.38+.09*(i%3))*envelope;
  const g=new T.SphereGeometry(1,distant?4:pine?6:7,distant?3:pine?4:5),sx=radius*(pine?.44:.44+.045*(i%3))*envelope;
  // Mature Scots-pine needles sit on flattened lateral boughs in staggered
  // whorls. Narrow branch fans replace the previous stacked round leaf balls.
  g.scale(sx,height*(pine?.047+.009*(i%3):.17+.022*(i%3)),sx*(pine?.37+.05*(i%3):.81+.08*(i%3)));g.rotateY(-a);
  g.translate(Math.cos(a)*reach,(v-.5)*height*.89+(pine?Math.sin(i*4.2)*height*.018:0),Math.sin(a)*reach);
  const p=g.attributes.position;
  for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),noise=1+(pine?.13:.065)*Math.sin(x*13+z*17+y*11);p.setXYZ(j,x*noise,y,z*noise);}
  g.computeVertexNormals();parts.push(g);
 }
 const out=combine(parts);out.computeBoundingBox();const b=out.boundingBox,mid=(b.min.y+b.max.y)/2,sy=height/(b.max.y-b.min.y);let rmax=0;for(let i=0;i<out.attributes.position.count;i++)rmax=Math.max(rmax,Math.hypot(out.attributes.position.getX(i),out.attributes.position.getZ(i)));const sr=radius/rmax;
 out.translate(0,-mid,0);out.scale(sr,sy,sr);
 const p=out.attributes.position,colors=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const y=p.getY(i)/height+.5,shade=.76+.17*y+.045*Math.sin(p.getX(i)*11+p.getZ(i)*9);colors.set([shade,Math.min(1,shade*1.03),shade*.91],i*3);}
 out.setAttribute('color',new T.BufferAttribute(colors,3));out.computeBoundingBox();out.computeBoundingSphere();out.userData.foliage={connected:true,clusters:count,height,radius,branchWhorls:pine?7:null,flattenedNeedleBoughs:pine};return out;
}

// Small perennial umbels on actual green stems. No sphere is used for a flower
// head; the fine petals read as a flowering texture instead of white golf balls.
export function perennialSprigGeometry(blossom=0xe6e3d3){
 const parts=[],petalColor=new T.Color(blossom),stemColor=new T.Color(0x617049),leafColor=new T.Color(0x778451);
 function colored(g,color){const c=new Float32Array(g.attributes.position.count*3);for(let i=0;i<c.length;i+=3)color.toArray(c,i);g.setAttribute('color',new T.BufferAttribute(c,3));parts.push(g);}
 function leaflet(width,length,bend){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,bend,0,0,0,-length,-width,0,-length*.16,0,0,length,width,0,-length*.16],3));g.setIndex([0,1,2,0,2,3,0,3,4,0,4,1]);g.setAttribute('uv',new T.Float32BufferAttribute([.5,.5,.5,0,0,.42,.5,1,1,.42],2));g.computeVertexNormals();return g;}
 const up=new T.Vector3(0,1,0),q=new T.Quaternion();
 for(let branch=0;branch<3;branch++){
  const angle=branch*2.399963,h=[1,.79,.91][branch],tip=new T.Vector3(Math.cos(angle)*.09,h,Math.sin(angle)*.09),length=tip.length();
  const stem=new T.CylinderGeometry(.0035,.006,length,5);q.setFromUnitVectors(up,tip.clone().normalize());stem.applyQuaternion(q);stem.translate(tip.x/2,tip.y/2,tip.z/2);colored(stem,stemColor);
  for(let leaf=0;leaf<2;leaf++){
   const t=.25+leaf*.25,a=angle+leaf*2.4,g=leaflet(.025,.08,.008);g.rotateZ(.55);g.rotateY(a);g.translate(tip.x*t+Math.cos(a)*.033,h*t,tip.z*t+Math.sin(a)*.033);colored(g,leafColor);
  }
  for(let bloom=0;bloom<3;bloom++){
   const a=angle+bloom*2.0944,bx=tip.x+Math.cos(a)*.04,bz=tip.z+Math.sin(a)*.04,by=h-bloom*.026;
   for(let petal=0;petal<5;petal++){
    const pa=petal*Math.PI*.4,g=leaflet(.012,.023,.004);g.rotateY(pa);g.translate(bx+Math.sin(pa)*.017,by,bz+Math.cos(pa)*.017);colored(g,petalColor);
   }
  }
 }
 const gs=parts.map(g=>g.index?g.toNonIndexed():g),n=gs.reduce((sum,g)=>sum+g.attributes.position.count,0),pos=new Float32Array(n*3),normal=new Float32Array(n*3),colors=new Float32Array(n*3),uv=new Float32Array(n*2);let offset=0;
 for(let i=0;i<gs.length;i++){const g=gs[i];pos.set(g.attributes.position.array,offset*3);normal.set(g.attributes.normal.array,offset*3);colors.set(g.attributes.color.array,offset*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;g.dispose();if(parts[i]!==g)parts[i].dispose();}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(normal,3));out.setAttribute('color',new T.BufferAttribute(colors,3));out.setAttribute('uv',new T.BufferAttribute(uv,2));out.computeBoundingBox();out.computeBoundingSphere();out.userData.planting={rooted:true,stemCount:3,smallBlooms:9,rootY:0,height:1.004};return out;
}
