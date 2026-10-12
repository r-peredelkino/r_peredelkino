// @r_peredelkino · courtyard architecture traced from the October reference panoramas.
import * as THREE from './vendor/three.module.js';
import {smoothWallNormals} from './facade-detail.js?v=publication371';
import {createWalkSurfaceSampler} from './play-bridge-walk.js?v=publication371';

const TAU=Math.PI*2;
const area=points=>points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0);
function offsetRing(points,distance){
 const sign=area(points)>0?1:-1;
 return points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;return[p[0]+sign*dz/length*distance,p[1]-sign*dx/length*distance]});
}
function contourShape(outer,holes=[]){
 const shape=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const hole of holes)shape.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
 return shape;
}
function ellipsePoints(x,z,rx,rz,count=96,phase=0){
 return Array.from({length:count},(_,i)=>{const a=i/count*TAU;return[x+Math.cos(a)*rx*(1+.026*Math.sin(3*a+phase)),z+Math.sin(a)*rz*(1+.025*Math.sin(2*a+phase))]});
}

// The main arch is broad and flat at its crown. Both unequal loops remain open
// to the sky, with clear upper guards and a real stepped route onto the bridge.
export function addSculpturalPlayPavilion(group,m,play){
 const meshes=[],colliders=[],archClearance=2.03,deckThickness=.18,wallThickness=.35;
 const sx=play.rx/12.6,sz=play.rz/9.5;
 function add(geometry,material,name){const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.noAutomaticCollider=true;group.add(mesh);meshes.push(mesh);return mesh;}
 const roofHeight=(x,z)=>{const t=THREE.MathUtils.smoothstep((x-play.x)/sx,-1.4,4.5);return 2.67+t*.69+.045*Math.sin((z-play.z)/sz*.42);};
 function slab(outer,holes,base,height,material,name,followRoof=false){
  const geometry=new THREE.ExtrudeGeometry(contourShape(outer,holes),{depth:height,bevelEnabled:false,curveSegments:32});geometry.rotateX(-Math.PI/2);
  if(followRoof){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+roofHeight(p.getX(i),p.getZ(i))+base);p.needsUpdate=true;geometry.computeVertexNormals();}else geometry.translate(0,base,0);
  smoothWallNormals(geometry);return add(geometry,material,name);
 }
 function tube(points,radius,material,name){return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),Math.max(24,points.length*10),radius,7,false),material,name);}
 const control=[[-10,0],[-9.3,-4.1],[-6.3,-6.1],[-2.7,-5.95],[.2,-4.15],[3.1,-6.0],[6.45,-5.9],[8.8,-3.5],[9.45,-.1],[8.25,3.1],[5.4,5.25],[1.7,4.55],[-.35,5.55],[-4.4,6.25],[-8.1,4.55]];
 const curve=new THREE.CatmullRomCurve3(control.map(([x,z])=>new THREE.Vector3(play.x+x*sx,0,play.z+z*sz)),true,'centripetal');
 const perimeter=curve.getLength(),samples=400;
 const outer=Array.from({length:samples},(_,i)=>{const p=curve.getPointAt(i/samples);return[p.x,p.z]});
 const inner=offsetRing(outer,-wallThickness),wallCenters=outer.map((p,i)=>[(p[0]+inner[i][0])/2,(p[1]+inner[i][1])/2]);
 const holes=[ellipsePoints(play.x-4.0*sx,play.z+.35*sz,4.48*sx,4.05*sz,112,.2),ellipsePoints(play.x+4.62*sx,play.z-.7*sz,3.02*sx,3.88*sz,112,.8)];
 function nearestT(x,z){let best=0,d=Infinity;outer.forEach((p,i)=>{const v=(p[0]-play.x-x*sx)**2+(p[1]-play.z-z*sz)**2;if(v<d){d=v;best=i/samples;}});return best;}
 const openings=[{at:[-10,0],width:6.1,height:2.38},{at:[-5.4,-6.1],width:3.65,height:2.27},{at:[7.8,-4.6],width:3.6,height:2.36},{at:[6.1,4.95],width:4.7,height:2.43},{at:[-5.2,6.1],width:4.0,height:2.29}].map(o=>({...o,t:nearestT(...o.at)}));
 function distanceAlong(a,b){const d=Math.abs(a-b);return Math.min(d,1-d)*perimeter;}
 function lowerEdge(t){let lower=0;for(const gate of openings){const delta=distanceAlong(t,gate.t),half=gate.width/2;if(delta<half)lower=Math.max(lower,gate.height*Math.sqrt(Math.max(0,1-(delta/half)**4)));}return lower;}
 const ordered=openings.map(o=>({...o})).sort((a,b)=>a.t-b.t),gaps=ordered.map((o,i)=>{const next=ordered[(i+1)%ordered.length],start=o.t+o.width/perimeter/2,end=(next.t<=o.t?next.t+1:next.t)-next.width/perimeter/2;return{t:(start+end)/2%1,length:(end-start)*perimeter};}).sort((a,b)=>b.length-a.length);
 const oculi=gaps.slice(0,3).map((g,i)=>({t:g.t,width:.9+i*.12,height:.74+i*.05})),oculusY=1.15;
 function roundOpening(t){for(const o of oculi){const delta=distanceAlong(t,o.t),half=o.width/2;if(delta<half){const r=o.height/2*Math.sqrt(Math.max(0,1-(delta/half)**2));return[oculusY-r,oculusY+r];}}return[oculusY,oculusY];}
 const lows=outer.map((_,i)=>lowerEdge(i/samples)),cuts=outer.map((_,i)=>roundOpening(i/samples).map(y=>Math.max(lows[i],y))),positions=[],uv=[],indices=[];
 function strip(a,b,reverse){const start=positions.length/3;for(let i=0;i<=samples;i++){const j=i%samples;positions.push(...a(j),...b(j));uv.push(i/samples*perimeter,0,i/samples*perimeter,1);}for(let i=0;i<samples;i++){const p=start+i*2,q=p+2;if(reverse)indices.push(p,q+1,q,p,p+1,q+1);else indices.push(p,q,q+1,p,q+1,p+1);}}
 const positive=area(outer)>0,top=i=>roofHeight(...outer[i]);
 strip(i=>[outer[i][0],lows[i],outer[i][1]],i=>[outer[i][0],cuts[i][0],outer[i][1]],positive);
 strip(i=>[outer[i][0],cuts[i][1],outer[i][1]],i=>[outer[i][0],top(i),outer[i][1]],positive);
 strip(i=>[inner[i][0],lows[i],inner[i][1]],i=>[inner[i][0],cuts[i][0],inner[i][1]],!positive);
 strip(i=>[inner[i][0],cuts[i][1],inner[i][1]],i=>[inner[i][0],top(i),inner[i][1]],!positive);
 strip(i=>[outer[i][0],top(i),outer[i][1]],i=>[inner[i][0],top(i),inner[i][1]],positive);
 strip(i=>[outer[i][0],lows[i],outer[i][1]],i=>[inner[i][0],lows[i],inner[i][1]],!positive);
 strip(i=>[outer[i][0],cuts[i][0],outer[i][1]],i=>[inner[i][0],cuts[i][0],inner[i][1]],positive);
 strip(i=>[outer[i][0],cuts[i][1],outer[i][1]],i=>[inner[i][0],cuts[i][1],inner[i][1]],!positive);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const walls=add(geometry,m.white,'Compact sculptural pavilion with broad flattened arches');
 const playBridge=slab(outer,holes,0,deckThickness,m.white,'Two unequal open courtyard loops',true);
 const outerParapet=slab(outer,[offsetRing(outer,-.18)],deckThickness,.10,m.white,'Low white curb below the clear upper guard',true);
 holes.forEach((hole,i)=>slab(offsetRing(hole,.15),[hole],deckThickness,.10,m.white,`Open sky loop ${i+1}: low inner curb`,true));
 // Clear rails in the official children's-space view replace the previous
 // solid waist-high white parapets. All panes share one geometry and draw.
 m.playGlass=new THREE.MeshStandardMaterial({color:0xbdd3d5,roughness:.12,metalness:.06,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide});
 const glassPositions=[],glassUV=[],guardSegments=[];
 const stairLandingAngle=-1.25;
 function landingGap(p,ringIndex){if(ringIndex!==1)return false;const a=Math.atan2((p[1]-play.z-.35*sz)/(4.05*sz),(p[0]-play.x+4*sx)/(4.48*sx));return Math.abs(a-stairLandingAngle)<.33;}
 for(const [ringIndex,ring] of [offsetRing(outer,-.09),...holes.map(h=>offsetRing(h,.075))].entries()){
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(landingGap(a,ringIndex)||landingGap(b,ringIndex))continue;
   const ya=roofHeight(...a)+deckThickness+.12,yb=roofHeight(...b)+deckThickness+.12,corners=[[a[0],ya,a[1]],[b[0],yb,b[1]],[b[0],yb+.83,b[1]],[a[0],ya+.83,a[1]]];
   for(const j of [0,2,1,0,3,2]){glassPositions.push(...corners[j]);glassUV.push(j===0||j===3?0:1,j<2?0:1);}guardSegments.push({a,b,radius:.045});
   if(i%8===0)tube([[a[0],ya,a[1]],[a[0],ya+.85,a[1]]],.011,m.white,'Slender bridge guard post');
  }
  let run=[];for(let i=0;i<=ring.length;i++){const p=ring[i%ring.length];if(landingGap(p,ringIndex)){if(run.length>1)tube(run,.017,m.white,'Upper bridge handrail');run=[];}else run.push([p[0],roofHeight(...p)+deckThickness+.96,p[1]]);}if(run.length>1)tube(run,.017,m.white,'Upper bridge handrail');
 }
 const glassGeometry=new THREE.BufferGeometry();glassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(glassPositions,3));glassGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(glassUV,2));glassGeometry.computeVertexNormals();const upperGuards=add(glassGeometry,m.playGlass,'Continuous transparent upper play-bridge guards');upperGuards.castShadow=false;
 let bridgeCollision=null;
 for(let i=0;i<samples;i++){const j=(i+1)%samples;if(Math.min(lows[i],lows[j])>=archClearance)continue;colliders.push({type:'segment',a:wallCenters[i],b:wallCenters[j],radius:wallThickness/2});if(!bridgeCollision&&lows[i]<.01&&lows[j]<.01)bridgeCollision={outer:[outer[i],outer[j],inner[j],inner[i]],holes:[]};}
 const archEntries=openings.map(g=>{const p=curve.getPointAt(g.t),t=curve.getTangentAt(g.t),sign=positive?1:-1,nx=sign*t.z,nz=-sign*t.x;return{point:[p.x-nx*wallThickness/2,p.z-nz*wallThickness/2],outside:[p.x+nx*1.1,p.z+nz*1.1],inside:[p.x-nx*1.15,p.z-nz*1.15],width:g.width,headroom:g.height};});

 // Ground inlays remain below the independently modelled play equipment.
 const floorShapes=[{c:[[-11,-2.1],[-8,-2.8],[-4.7,-1.4],[-1.7,.1],[1.7,.3],[5.4,1.2],[6.1,2.9],[2.8,3.6],[-.9,2.5],[-4.8,1.0],[-8,1.1],[-11,1.7]],mat:m.darkBlue},
  {c:[[-11,-5.8],[-8.8,-7.0],[-5.8,-7.2],[-5.3,-6.5],[-8,-5.8]],mat:m.darkBlue},
  {c:[[-1.5,-7.5],[2.4,-8.1],[5.6,-7.1],[3.9,-6.9],[1,-6.0]],mat:m.darkBlue},
  {c:[[-7.6,3.5],[-6.8,2.0],[-4.8,2.5],[-2.9,4.0],[-4.7,4.6]],mat:m.sand}];
 for(const [i,item] of floorShapes.entries()){const c=new THREE.CatmullRomCurve3(item.c.map(([x,z])=>new THREE.Vector3(play.x+x*sx,0,play.z+z*sz)),true,'centripetal'),points=c.getPoints(100).slice(0,-1).map(p=>[p.x,p.z]);slab(points,[],.042+i*.0005,.009,item.mat,'Organic blue and mineral play surface inlay');}
 for(const [i,[dx,dz,rx,rz]] of [[-10.8,3.5,.6,.9],[-8.9,-7,.75,.5],[7.7,5.9,.5,.85],[9.9,3,.62,.45]].entries())slab(ellipsePoints(play.x+dx*sx,play.z+dz*sz,rx,rz,36),[],.053,.008,i%2?m.darkBlue:m.white,'Flush coloured pebble motif in the rubber surface');
 for(const [i,[dx,dz]] of [[-10.9,-3.5],[-11.2,-5.0]].entries()){const ring=add(new THREE.TorusGeometry(.40+i*.06,.048,7,36),m.white,'Small low play loop visible beside the pavilion');ring.position.set(play.x+dx*sx,.56,play.z+dz*sz);ring.rotation.y=Math.PI/2;colliders.push({type:'circle',x:ring.position.x,z:ring.position.z,radius:.24});}
 // Curved solid treads climb inside the large sky opening and meet the bridge
 // at a gap in its inner glass rail. Ground passage under every arch survives.
 const stairCenter=[play.x-4*sx,play.z+.35*sz],stairWidth=.92,steps=22,stairPoints=[];
 function stairAt(t){const a=.40+(stairLandingAngle-.40)*t,r=.82+.26*THREE.MathUtils.smoothstep(t,.955,1);return[stairCenter[0]+Math.cos(a)*4.48*sx*r,stairCenter[1]+Math.sin(a)*4.05*sz*r];}
 const deckHeightAt=createWalkSurfaceSampler(playBridge.geometry),topPoint=stairAt(1),stairHeight=deckHeightAt(...topPoint)??roofHeight(...topPoint)+deckThickness,treads=[],stairPath=Array.from({length:steps+1},(_,i)=>stairAt(i/steps));
 const stairEdges=stairPath.map((p,i)=>{const a=stairPath[Math.max(0,i-1)],b=stairPath[Math.min(steps,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,nx=-dz/length*stairWidth/2,nz=dx/length*stairWidth/2;return{left:[p[0]+nx,p[1]+nz],right:[p[0]-nx,p[1]-nz]};});
 for(let i=0;i<steps;i++){const a=stairPath[i],b=stairPath[i+1],ring=[stairEdges[i].left,stairEdges[i+1].left,stairEdges[i+1].right,stairEdges[i].right],height=.055+(stairHeight-.055)*(i+1)/steps;
  slab(ring,[],.05,height-.05,m.white,'Curved stair tread to the play bridge');treads.push({outer:ring,holes:[],height,index:i});stairPoints.push([a[0],height,a[1]]);
  // Solids below a tread are ground obstacles; the separate upper route API
  // allows the walking controller to climb them rather than entering a block.
  if(height>.30)colliders.push({type:'segment',a,b,radius:stairWidth*.48,playStair:true});
 }
 stairPoints.push([topPoint[0],stairHeight,topPoint[1]]);
 const stairRails=[];for(const side of [-1,1]){const points=stairPoints.map((p,i)=>{const a=stairPoints[Math.max(0,i-1)],b=stairPoints[Math.min(stairPoints.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz)||1;return[p[0]-dz/len*stairWidth/2*side,p[1]+.83,p[2]+dx/len*stairWidth/2*side];});tube(points,.026,m.white,'Curved child-height stair handrail');stairRails.push(points);for(let i=0;i<points.length;i+=4)tube([[points[i][0],stairPoints[i][1],points[i][2]],points[i]],.017,m.white,'Stair guard support');}
 const roundWindows=oculi.map(o=>{const p=curve.getPointAt(o.t),t=curve.getTangentAt(o.t),sign=positive?1:-1;return{point:[p.x,oculusY,p.z],normal:[sign*t.z,0,-sign*t.x],width:o.width,height:o.height};});
 const upperRoute={outer,holes,treads,stairWidth,stairPoints,guardSegments,entry:stairAt(0),landing:topPoint,heightAt:deckHeightAt};
 return{playBridge,bridgeCollision,colliders,meshes,walls,outerParapet,upperGuards,upperRoute,metadata:{version:25,roofLoops:2,archedOpenings:openings.length,roundedOculi:oculi.length,roundWindows,openToSky:true,outer,holes,archEntries,wallThickness,deckHeight:3.54,minDeckHeight:2.62,maxHeight:4.52,collisionHeadroom:archClearance,wallSegments:colliders.length,sourceViews:['12.03.04','12.03.07'],sourcePages:[33],stairSteps:steps,glassGuardHeight:.95,unsupportedEquipment:[]}};
}

// Jittered cellular apertures reproduce the irregular leaf-like metal lace.
// The cells are true through-holes, including their thin cut edges.
export function addPerforatedLoungeCanopy(group,m,lounge){
 const outer=ellipsePoints(lounge.x,lounge.z,lounge.rx,lounge.rz,160),opening=ellipsePoints(lounge.x,lounge.z,lounge.rx*.64,lounge.rz*.69,144,.2),shape=contourShape(outer,[opening]);
 let state=241008;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const seeds=[],holes=[],inside=(x,z,margin=.012)=>{const dx=x-lounge.x,dz=z-lounge.z;return(dx/(lounge.rx*(1-margin)))**2+(dz/(lounge.rz*(1-margin)))**2<1&&(dx/(lounge.rx*(.64+margin)))**2+(dz/(lounge.rz*(.69+margin)))**2>1;};
 for(let x=-lounge.rx;x<=lounge.rx;x+=.53)for(let z=-lounge.rz;z<=lounge.rz;z+=.53){const px=lounge.x+x+(random()-.5)*.40,pz=lounge.z+z+(random()-.5)*.40;if(inside(px,pz,.018))seeds.push([px,pz]);}
 function clip(poly,nx,nz,k){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*nz-k,db=b[0]*nx+b[1]*nz-k;if(da<=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
 for(const seed of seeds){let poly=[[seed[0]-.7,seed[1]-.7],[seed[0]+.7,seed[1]-.7],[seed[0]+.7,seed[1]+.7],[seed[0]-.7,seed[1]+.7]];
  for(const other of seeds){const dx=other[0]-seed[0],dz=other[1]-seed[1],d=dx*dx+dz*dz;if(d<.0001||d>3.4)continue;poly=clip(poly,dx,dz,(other[0]**2+other[1]**2-seed[0]**2-seed[1]**2)/2);if(poly.length<3)break;}
  if(poly.length<3)continue;const inset=.70+random()*.08;poly=poly.map(p=>[seed[0]+(p[0]-seed[0])*inset,seed[1]+(p[1]-seed[1])*inset]);if(poly.some(p=>!inside(...p,.015)))continue;
  const path=new THREE.Path();for(let i=0;i<poly.length;i++){const a=poly[(i+poly.length-1)%poly.length],p=poly[i],b=poly[(i+1)%poly.length],before=[p[0]+(a[0]-p[0])*.22,p[1]+(a[1]-p[1])*.22],after=[p[0]+(b[0]-p[0])*.22,p[1]+(b[1]-p[1])*.22];if(i===0)path.moveTo(before[0],-before[1]);else path.lineTo(before[0],-before[1]);path.quadraticCurveTo(p[0],-p[1],after[0],-after[1]);}path.closePath();shape.holes.push(path);holes.push({center:seed,contour:poly});
 }
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:false,curveSegments:4});geometry.rotateX(-Math.PI/2);smoothWallNormals(geometry);
 const p=geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),blue=z<lounge.z-lounge.rz*.32+.35*Math.sin(x*1.4),tone=.74+.24*(.5+.5*Math.sin(x*13.1+Math.sin(z*17.4)*2.6)),c=new THREE.Color(blue?0x246b86:0x889391).multiplyScalar(tone);colors.push(c.r,c.g,c.b);}geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 m.canopy=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.53,metalness:.42});
 const canopy=new THREE.Mesh(geometry,m.canopy);canopy.name='Thin elongated canopy with irregular cellular perforations and blue sector';canopy.position.y=3.36;canopy.castShadow=canopy.receiveShadow=true;canopy.userData.noAutomaticCollider=true;canopy.userData.dynamic=true;group.add(canopy);
 for(const points of [outer,opening]){const edge=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,3.39,z)),true,'centripetal'),200,.030,6,true),m.white);edge.castShadow=edge.receiveShadow=true;edge.userData.noAutomaticCollider=true;group.add(edge);}
 return{canopy,perforations:holes.length,holes,centralOpening:{x:lounge.x,z:lounge.z,rx:lounge.rx*.64,rz:lounge.rz*.69},height:3.425,sourceViews:['21.59.31','21.51.47']};
}
