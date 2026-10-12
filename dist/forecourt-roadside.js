// Reference v29 · static parking and street furniture traced from the public tour.
// Inputs are root-calibrated world XZ coordinates and dimensions in fixed model units.
// This module never moves the published road axes or creates animated traffic routes.
import * as THREE from './vendor/three.module.js';

const EPS = 1e-8;
const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
const validPoint = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const pointIn = (x, z, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const segmentDistance = (x, z, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = clamp01(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};

function polygonRecord(item) {
  const points = (item.points || []).filter(validPoint).map(p => [p[0], p[1]]);
  if (points.length > 2 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < EPS) points.pop();
  if (points.length < 3) return null;
  const holes = (item.holes || []).map(ring => ring.filter(validPoint).map(p => [p[0], p[1]])).filter(ring => ring.length >= 3);
  return { ...item, points, holes, bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] };
}

function intersectsPolygon(record, x, z, margin = 0) {
  const [x0, z0, x1, z1] = record.bounds;
  if (x < x0 - margin || x > x1 + margin || z < z0 - margin || z > z1 + margin) return false;
  if (pointIn(x, z, record.points) && !(record.holes || []).some(ring => pointIn(x, z, ring))) return true;
  return [record.points, ...(record.holes || [])].some(ring => ring.some((a, i) => segmentDistance(x, z, a, ring[(i + 1) % ring.length]) <= margin + EPS));
}

// Normalised rounded lower car body, with a shaped bonnet and tapered bumper ends.
function bodyShell() {
  const sections = [
    [-.50, .365, .235, .415], [-.465, .46, .16, .52], [-.35, .50, .14, .555],
    [-.16, .505, .14, .57], [.20, .505, .14, .555], [.36, .49, .16, .515],
    [.455, .445, .19, .46], [.50, .36, .25, .405],
  ];
  const points = [], indices = [], count = 12;
  for (const [z, w, bottom, top] of sections) {
    const h = top - bottom;
    const ring = [[-.84*w,bottom],[-w,bottom+.16*h],[-w,top-.21*h],[-.9*w,top-.04*h],[-.55*w,top],[0,top+.015],[.55*w,top],[.9*w,top-.04*h],[w,top-.21*h],[w,bottom+.16*h],[.84*w,bottom],[0,bottom]];
    for (const [x, y] of ring) points.push(x, y, z);
  }
  for (let s = 0; s < sections.length - 1; s++) for (let i = 0; i < count; i++) {
    const a = s * count + i, b = s * count + (i + 1) % count, c = b + count, d = a + count;
    indices.push(a, c, b, a, d, c);
  }
  for (const [s, flip] of [[0, false], [sections.length - 1, true]]) {
    const z = sections[s][0], center = points.length / 3;
    points.push(0, (sections[s][2] + sections[s][3]) / 2, z);
    for (let i = 0; i < count; i++) {
      const a = s * count + i, b = s * count + (i + 1) % count;
      indices.push(center, flip ? b : a, flip ? a : b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function mergeParts(parts) {
  const positions = [], normals = [];
  for (const part of parts) {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (part.matrix) geometry.applyMatrix4(part.matrix);
    positions.push(...geometry.attributes.position.array); normals.push(...geometry.attributes.normal.array);
    geometry.dispose(); part.geometry.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

function cabinParts(style) {
  const hatch = style !== 'sedan', van = style === 'van';
  const rearZ = hatch ? -.385 : -.29, rearRoofZ = hatch ? -.26 : -.14;
  const frontRoofZ = van ? .20 : .13, frontZ = van ? .335 : .30;
  const roofY = van ? .98 : .94, roofWidth = van ? .385 : .345;
  const rearWidth = hatch ? .43 : .415, frontWidth = .425, lowerY = .545;
  const quad = (a, b, c, d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3)); g.computeVertexNormals();
    return {geometry:g};
  };
  const glass = [
    quad([-frontWidth,lowerY,frontZ],[frontWidth,lowerY,frontZ],[roofWidth,roofY,frontRoofZ],[-roofWidth,roofY,frontRoofZ]),
    quad([rearWidth,lowerY,rearZ],[-rearWidth,lowerY,rearZ],[-roofWidth,roofY,rearRoofZ],[roofWidth,roofY,rearRoofZ]),
    quad([-rearWidth,lowerY,rearZ],[-frontWidth,lowerY,frontZ],[-roofWidth,roofY,frontRoofZ],[-roofWidth,roofY,rearRoofZ]),
    quad([frontWidth,lowerY,frontZ],[rearWidth,lowerY,rearZ],[roofWidth,roofY,rearRoofZ],[roofWidth,roofY,frontRoofZ]),
  ];
  const painted = [{geometry:bodyShell()}], trim = [];
  const matrix = (position, scale, rotation = [0,0,0]) => new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
  // Gently arched painted roof, connected to distinct sloping glass planes.
  const roof = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  painted.push({geometry:roof,matrix:matrix([0,roofY-.018,(rearRoofZ+frontRoofZ)/2],[roofWidth+.013,.064,(frontRoofZ-rearRoofZ)/2+.025])});
  const beam = (a,b,radius,target) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va);
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(1,1,1));
    target.push({geometry:new THREE.CylinderGeometry(radius,radius,delta.length(),6),matrix:m});
  };
  for (const side of [-1,1]) {
    beam([side*frontWidth,lowerY,frontZ],[side*roofWidth,roofY,frontRoofZ],.014,painted);
    beam([side*rearWidth,lowerY,rearZ],[side*roofWidth,roofY,rearRoofZ],.017,painted);
    beam([side*.427,lowerY,-.025],[side*roofWidth,roofY,-.025],.014,trim);
    painted.push({geometry:new THREE.SphereGeometry(1,8,6),matrix:matrix([side*.535,.625,.165],[.065,.038,.038])});
    trim.push({geometry:new THREE.BoxGeometry(1,1,1),matrix:matrix([side*.499,.462,.055],[.012,.021,.05])});
  }
  trim.push({geometry:new THREE.BoxGeometry(1,1,1),matrix:matrix([0,.335,.497],[.41,.098,.008])});
  trim.push({geometry:new THREE.BoxGeometry(1,1,1),matrix:matrix([0,.326,-.493],[.24,.063,.009])});
  return {painted:mergeParts(painted),glass:mergeParts(glass),trim:mergeParts(trim)};
}

export function createForecourtRoadside(parent, {data = {}} = {}) {
  const group = new THREE.Group(); group.name = 'Reference forecourt roadside · parking, islands and street furniture'; parent.add(group);
  const groundY = Number.isFinite(data.groundY) ? data.groundY : -.48;
  const raisedY = Number.isFinite(data.raisedY) ? data.raisedY : -.30;
  const materials = {
    asphalt:new THREE.MeshStandardMaterial({color:0x65645e,roughness:.95}),
    officeAsphalt:new THREE.MeshStandardMaterial({color:0x33383c,roughness:.9}),
    paving:new THREE.MeshStandardMaterial({color:0xaba99d,roughness:.93}),
    curb:new THREE.MeshStandardMaterial({color:0xc0bfb4,roughness:.88}),
    paint:new THREE.MeshStandardMaterial({color:0xf1eee3,roughness:.87}),
    body:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.33,metalness:.24}),
    glass:new THREE.MeshStandardMaterial({color:0x253c48,roughness:.18,metalness:.36,side:THREE.DoubleSide}),
    trim:new THREE.MeshStandardMaterial({color:0x171d20,roughness:.67}),
    tyre:new THREE.MeshStandardMaterial({color:0x1d2020,roughness:.94}),
    metal:new THREE.MeshStandardMaterial({color:0x899296,roughness:.38,metalness:.68}),
    frontLens:new THREE.MeshStandardMaterial({color:0xe8ebdf,roughness:.25,emissive:0xe9e3c6,emissiveIntensity:.025}),
    rearLens:new THREE.MeshStandardMaterial({color:0x9d1e24,roughness:.3,emissive:0xa81820,emissiveIntensity:.045}),
    lamp:new THREE.MeshStandardMaterial({color:0xf5efd5,roughness:.4,emissive:0xffd59b,emissiveIntensity:.22}),
  };
  const ownedGeometry = new Set(), meshes = [], batches = new Map();
  const addMesh = (geometry,material,name,{instanced=0,shadow=true}={}) => {
    ownedGeometry.add(geometry);
    const mesh = instanced ? new THREE.InstancedMesh(geometry,material,instanced) : new THREE.Mesh(geometry,material);
    mesh.name=name;mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.userData.noAutomaticCollider=true;group.add(mesh);meshes.push(mesh);return mesh;
  };
  const appendGeometry = (key,geometry,matrix=null) => {
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push({geometry,matrix});
  };
  const groundPolygon = (key,points,y,holes=[]) => {
    if(points.length<3)return;
    const shape = new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    for (const ring of holes) if (ring.length >= 3) shape.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI/2);geometry.translate(0,y,0);appendGeometry(key,geometry);
  };
  const matrix = (p,s=[1,1,1],yaw=0) => new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...s));
  const segmentBox = (key,a,b,bottom,height,width) => {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<EPS)return;
    appendGeometry(key,new THREE.BoxGeometry(length,height,width),matrix([(a[0]+b[0])/2,bottom+height/2,(a[1]+b[1])/2],[1,1,1],-Math.atan2(dz,dx)));
  };
  const areas=(data.areas||[]).map(polygonRecord).filter(Boolean),openings=(data.openings||[]).map(polygonRecord).filter(Boolean);
  for(const area of areas){
    const parking=area.kind==='parking',surfaceY=Number.isFinite(area.surfaceY)?area.surfaceY:parking?groundY:raisedY;
    area.surfaceY=surfaceY;
    groundPolygon(parking?(area.id.includes('office')?'officeAsphalt':'asphalt'):'paving',area.points,surfaceY,area.holes);
  }
  for(const curb of data.curbs||[]){
    const points=(curb.points||[]).filter(validPoint),closed=!!curb.closed,count=closed?points.length:points.length-1;
    const top=Number.isFinite(curb.topY)?curb.topY:raisedY+.018,bottom=Number.isFinite(curb.bottomY)?curb.bottomY:groundY;
    for(let i=0;i<count;i++){
      const j=(i+1)%points.length;if((curb.omitEdges||[]).some(p=>p[0]===i&&p[1]===j||p[0]===j&&p[1]===i))continue;
      segmentBox('curb',points[i],points[j],bottom,Math.max(.02,top-bottom),curb.width??.13);
    }
  }
  for(const marking of data.markings||[]){
    const points=(marking.points||[]).filter(validPoint),y=Number.isFinite(marking.surfaceY)?marking.surfaceY:groundY+.014;
    if(marking.closed||marking.kind==='zebra'||marking.kind==='polygon')groundPolygon('paint',points,y);
    else for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<EPS)continue;
      const r=(marking.width??.09)/2,nx=-dz/l*r,nz=dx/l*r;
      groundPolygon('paint',[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],y);
    }
  }
  const lamps=[];
  for(const input of data.lamps||[]){
    if(!Number.isFinite(input.x)||!Number.isFinite(input.z))continue;
    const x=input.x,z=input.z,base=Number.isFinite(input.baseY)?input.baseY:-.013,h=input.height??9,angle=input.angle??0,dx=Math.sin(angle),dz=Math.cos(angle);
    const start=new THREE.Vector3(x,base,z),end=new THREE.Vector3(x,base+h*.88,z);
    appendGeometry('metal',new THREE.CylinderGeometry(.056,.094,h*.88,10),matrix([x,base+h*.44,z]));
    appendGeometry('metal',new THREE.CylinderGeometry(.15,.18,.16,10),matrix([x,base+.08,z]));
    const curve=new THREE.CatmullRomCurve3([end,new THREE.Vector3(x+dx*.16,base+h*.955,z+dz*.16),new THREE.Vector3(x+dx*.66,base+h,z+dz*.66),new THREE.Vector3(x+dx*1.62,base+h+.015,z+dz*1.62)]);
    appendGeometry('metal',new THREE.TubeGeometry(curve,12,.047,6,false));
    const lx=x+dx*1.72,lz=z+dz*1.72,ly=base+h-.03;
    appendGeometry('metal',new THREE.SphereGeometry(1,10,6),matrix([lx,ly+.035,lz],[.18,.09,.43],angle));
    appendGeometry('lamp',new THREE.SphereGeometry(1,10,6),matrix([lx,ly-.04,lz],[.14,.021,.35],angle));
    lamps.push({id:input.id,x:lx,y:ly,z:lz,position:[lx,ly,lz],base:[x,base,z],sourceId:input.sourceId??input.id});
  }
  for(const [key,parts]of batches){
    const geometry=mergeParts(parts),mesh=addMesh(geometry,materials[key],`Forecourt roadside · ${key}`,{shadow:key!=='paint'&&key!=='asphalt'&&key!=='officeAsphalt'&&key!=='paving'});
    mesh.userData.surfaceKind=key==='asphalt'||key==='officeAsphalt'?'forecourt-parking-asphalt':key==='paving'?'forecourt-roadside-paving':key==='paint'?'forecourt-parking-markings':'forecourt-roadside-detail';
  }

  const cars=(data.cars||[]).filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.angle??0));
  const dummy=new THREE.Object3D(),color=new THREE.Color(),carGroups=new Map(),bodyMetadata=[];
  for(const car of cars){const style=car.bodyStyle==='van'?'van':car.bodyStyle==='hatch'?'hatch':'sedan';if(!carGroups.has(style))carGroups.set(style,[]);carGroups.get(style).push(car);}
  for(const [style,items]of carGroups){
    const geometry=cabinParts(style),painted=addMesh(geometry.painted,materials.body,`Parked ${style} · curved body and roof`,{instanced:items.length});
    const panes=addMesh(geometry.glass,materials.glass,`Parked ${style} · sloping front, side and rear glass`,{instanced:items.length});
    const trim=addMesh(geometry.trim,materials.trim,`Parked ${style} · pillars, grille and handles`,{instanced:items.length});
    items.forEach((car,i)=>{
      const width=car.width??1.68,height=car.height??1.38,length=car.length??4.1,y=car.y??groundY;
      dummy.position.set(car.x,y,car.z);dummy.rotation.set(0,car.angle??0,0);dummy.scale.set(width,height,length);dummy.updateMatrix();
      for(const mesh of [painted,panes,trim])mesh.setMatrixAt(i,dummy.matrix);
      painted.setColorAt(i,color.set(car.color??0xb8bdba));
      bodyMetadata.push({id:car.id,bodyStyle:style,x:car.x,y,z:car.z,angle:car.angle??0,length,width,height,sourceId:car.sourceId??car.id,bayNumber:car.bayNumber??null,sourcePose:car.sourcePose??null,boundedPlacement:car.boundedPlacement??null});
    });
    for(const mesh of [painted,panes,trim]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
    painted.instanceColor.needsUpdate=true;
  }
  if(cars.length){
    const wheelGeometry=new THREE.CylinderGeometry(1,1,1,12);wheelGeometry.rotateZ(Math.PI/2);
    const tyre=addMesh(wheelGeometry,materials.tyre,'Parked cars · four rubber wheels each',{instanced:cars.length*4});
    const rimGeometry=new THREE.CylinderGeometry(1,1,1,10);rimGeometry.rotateZ(Math.PI/2);
    const rim=addMesh(rimGeometry,materials.metal,'Parked cars · inset alloy wheel faces',{instanced:cars.length*4});
    const head=addMesh(new THREE.SphereGeometry(1,10,6),materials.frontLens,'Parked cars · shaped headlamp lenses',{instanced:cars.length*2});
    const tail=addMesh(new THREE.SphereGeometry(1,10,6),materials.rearLens,'Parked cars · rear lamp lenses',{instanced:cars.length*2});
    const place=(mesh,index,car,x,y,z,sx,sy,sz)=>{
      const a=car.angle??0,c=Math.cos(a),s=Math.sin(a);
      dummy.position.set(car.x+c*x+s*z,(car.y??groundY)+y,car.z-s*x+c*z);dummy.rotation.set(0,a,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    };
    cars.forEach((car,i)=>{
      const w=car.width??1.68,h=car.height??1.38,l=car.length??4.1,r=Math.min(w*.188,h*.23),wheelWidth=w*.117;
      let wi=0;for(const side of [-1,1])for(const axle of [-1,1]){
        const x=side*w*.485,z=axle*l*.31;
        place(tyre,i*4+wi,car,x,r,z,wheelWidth,r,r);
        place(rim,i*4+wi,car,x+side*wheelWidth*.37,r,z,wheelWidth*.35,r*.62,r*.62);wi++;
      }
      for(let j=0;j<2;j++){const side=j?1:-1;place(head,i*2+j,car,side*w*.305,h*.44,l*.484,w*.122,h*.054,l*.018);place(tail,i*2+j,car,side*w*.329,h*.44,-l*.484,w*.102,h*.049,l*.017);}
    });
    for(const mesh of [tyre,rim,head,tail]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  }
  const reservations=[...areas,...openings];
  const reserved=(x,z,margin=0)=>Number.isFinite(x)&&Number.isFinite(z)&&reservations.some(r=>intersectsPolygon(r,x,z,Math.max(0,Number(margin)||0)));
  const openingReserved=(x,z,margin=0)=>openings.some(r=>intersectsPolygon(r,x,z,Math.max(0,Number(margin)||0)));
  let season='summer',wetness=0;
  const updateMaterials=()=>{
    const winter=season===true||season==='winter';
    materials.asphalt.color.setHex(winter?0x7e8481:0x65645e).multiplyScalar(1-wetness*.16);
    materials.officeAsphalt.color.setHex(winter?0x727b7b:0x33383c).multiplyScalar(1-wetness*.15);
    materials.paving.color.setHex(winter?0xcad2cf:0xaba99d).multiplyScalar(1-wetness*.1);
    materials.asphalt.roughness=.95-wetness*.44;materials.officeAsphalt.roughness=.90-wetness*.39;materials.paving.roughness=.93-wetness*.27;
  };
  const setSeason=value=>{season=value;updateMaterials();};
  const setWetness=value=>{wetness=clamp01(value);updateMaterials();};
  const officeBayCount=data.officeParking?.bayCount??(areas.some(a=>a.id==='office-nine-bay-pad')?9:0);
  const occupiedBays=bodyMetadata.filter(c=>Number.isInteger(c.bayNumber)).map(c=>c.bayNumber).sort((a,b)=>a-b);
  const metadata={version:29,source:data.source??null,coordinateUnits:'Fixed model units; root-projected and calibrated to the unchanged road axes.',
    registration:data.fitMetadata??null,
    areaCount:areas.length,curbPathCount:(data.curbs||[]).length,markingCount:(data.markings||[]).length,parkedCarCount:cars.length,wheelCount:cars.length*4,
    streetLampCount:lamps.length,openingCount:openings.length,animatedVehicleCount:0,roadAxisChanges:0,
    officeParking:officeBayCount?{bayCount:officeBayCount,occupiedBayNumbers:occupiedBays,emptyBayNumbers:Array.from({length:officeBayCount},(_,i)=>i+1).filter(i=>!occupiedBays.includes(i))}:null,
    areas:areas.map(a=>({id:a.id,kind:a.kind,points:a.points,holes:a.holes,surfaceY:a.surfaceY})),cars:bodyMetadata,lamps,
    sourceIds:[...new Set([...(data.areas||[]),...(data.cars||[]),...(data.lamps||[])].map(x=>x.sourceId??x.id))],
    drawCalls:meshes.length,triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0),
    reservationMethod:'Actual parking, sidewalk, refuge-island and driveway polygons with radial edge distance. No filled bounding-box reservations.',
  };
  group.userData.forecourtRoadside=metadata;
  let disposed=false;
  function dispose(){if(disposed)return;disposed=true;parent.remove(group);for(const geometry of ownedGeometry)geometry.dispose();for(const material of Object.values(materials))material.dispose();}
  return {group,metadata,areas,openings,lamps,materials,reserved,openingReserved,setSeason,setWetness,dispose};
}
