// Read-only geographic and shadow-frame audit. No browser or model mutation.
// Usage: node alignment-audit.mjs [dist-directory] [output-json]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const own=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(process.argv[2]||path.join(own,'../../dist'));
const out=path.resolve(process.argv[3]||path.join(own,'alignment-audit.json'));
const load=name=>import(pathToFileURL(path.join(dist,name)).href);
const [T,{geoFrame,geoToWorld,worldToGeo},{complexFootprints:f},{location,solarPosition,direction,moscowDate},{resolveNeighborBuildingLayout}]=await Promise.all([
 load('vendor/three.module.js'),load('geo-reference.js'),load('complex-footprints.js'),load('solar.js'),load('neighbor-building-layout.js')
]);
const rounded=value=>Number(value.toFixed(9));
const mapRound=values=>values.map(rounded);
const radians=Math.PI/180;
const metric=geoFrame.scale.metersPerFixedWorldUnit;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const north=geoFrame.northWorld,east=geoFrame.eastWorld;
const legacyNorth=location.north;
const angle=Math.acos(Math.max(-1,Math.min(1,dot(north,legacyNorth)/Math.hypot(...legacyNorth))))/radians;

function topProjection(basis){
 const camera=new T.OrthographicCamera(-110,110,125,-125,1,2000);
 camera.position.set(-basis[0]*.01,350,-basis[1]*.01);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const zero=new T.Vector3().project(camera),point=new T.Vector3(north[0]*20,0,north[1]*20).project(camera);
 const screen=[(point.x-zero.x)*110,(point.y-zero.y)*125];
 return{geographicNorthInScreenXY:mapRound(screen),clockwiseDegreesFromScreenUp:rounded(Math.atan2(screen[0],screen[1])/radians)};
}
const locations=[['model-origin',...geoFrame.worldOriginLonLat],['user-shademap',37.3521,55.63666],['user-suncalc',37.3525,55.6367]].map(([label,lon,lat])=>{
 const xyz=geoToWorld(lon,lat);
 return{label,longitude:lon,latitude:lat,worldXYZ:mapRound(xyz),distanceFromModelOriginMeters:rounded(Math.hypot(xyz[0],xyz[2])*metric)};
});
const buildings=f.buildings.map(b=>{
 const xs=b.shape.map(p=>p[0]+b.x),zs=b.shape.map(p=>p[1]+b.z),top=b.id===0?b.h+1.55:b.h+1.835;
 return{id:b.id,floors:b.floors,worldCenterXZ:[b.x,b.z],lonLat:mapRound(worldToGeo(b.x,b.z)),wallHeightWorld:b.h,wallHeightMetersIfIsotropic:rounded(b.h*metric),upperRoofWorld:top,upperRoofMetersIfIsotropic:rounded(top*metric),footprintWorldBounds:mapRound([Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)]),source:'Traced engineering-layout.json; height is an estimate, not a verified real-metre input.'};
});
const neighbors=resolveNeighborBuildingLayout().map(b=>({
 id:b.id,address:b.address,osmWayId:b.osmWayId,floors:b.floors,tagTimestamp:b.osmTimestamp,
 baseWorldY:b.baseY,estimatedWallHeightMeters:b.height,actualWallHeightWorld:rounded(b.height*b.planUnit),
 actualWallHeightMeters:rounded(b.height*b.planUnit*metric),worldFootprint:b.coordinates.map(([lon,lat])=>{const [x,,z]=geoToWorld(lon,lat);return mapRound([x,z]);})
}));
const cardinal=[0,90,180,270].map(azimuth=>({azimuth,worldDirection:mapRound(direction(azimuth,0)),geographicEast:rounded(dot([direction(azimuth,0)[0],direction(azimuth,0)[2]],east)),geographicNorth:rounded(dot([direction(azimuth,0)[0],direction(azimuth,0)[2]],north))}));
const cases=[['2026-10-11',432],['2026-10-11',720],['2026-06-29',750],['2026-12-21',720],['2026-03-20',720],['2026-09-22',720]];
const samples=cases.map(([day,minutes])=>{
 const date=new Date(moscowDate(day,minutes)),sun=solarPosition(date),ray=direction(sun.azimuth,sun.elevation),tan=Math.tan(sun.elevation*radians);
 return{day,minutesMoscow:minutes,utc:date.toISOString(),azimuth:rounded(sun.azimuth),elevation:rounded(sun.elevation),direction:mapRound(ray),freeShadowOf94WorldUnits: sun.elevation>0?rounded(94/tan):null,freeShadowOf94WorldUnitsInMeters:sun.elevation>0?rounded(94/tan*metric):null,locationVariation:locations.map(l=>{
  const p=solarPosition(date,l.latitude,l.longitude);return{label:l.label,deltaAzimuth:rounded(p.azimuth-sun.azimuth),deltaElevation:rounded(p.elevation-sun.elevation)};
 })};
});

// Reproduce only the old v30 directional shadow camera for diagnosis.
// A shadow-map frustum is not the physical shadow test; its clipping can discard
// casters/receivers even while they remain visible in the main camera.
function oldShadowFrame(sun,center,radius){
 const camera=new T.OrthographicCamera(-radius,radius,radius,-radius,1,1100);
 camera.position.copy(center).addScaledVector(new T.Vector3(...sun.direction),520);camera.lookAt(center);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 const records=buildings.map(b=>{
  const original=f.buildings.find(v=>v.id===b.id),points=original.shape.flatMap(([x,z])=>[new T.Vector3(x+b.worldCenterXZ[0],0,z+b.worldCenterXZ[1]),new T.Vector3(x+b.worldCenterXZ[0],original.h,z+b.worldCenterXZ[1])]);
  const local=points.map(p=>p.applyMatrix4(camera.matrixWorldInverse)),bounds=[Math.min(...local.map(p=>p.x)),Math.max(...local.map(p=>p.x)),Math.min(...local.map(p=>p.y)),Math.max(...local.map(p=>p.y)),Math.min(...local.map(p=>-p.z)),Math.max(...local.map(p=>-p.z))];
  const verticesOutside=local.filter(p=>Math.abs(p.x)>radius||Math.abs(p.y)>radius||-p.z<1||-p.z>1100).length;
  return{building:b.id,lightSpaceBounds:mapRound(bounds),verticesOutside,totalVertices:points.length};
 });
 return{center:mapRound(center.toArray()),radiusWorld:radius,widthMeters:rounded(2*radius*metric),worldTexelAt4096:rounded(2*radius/4096),buildings:records};
}
const walkLocation=new T.Vector3(14,1.7,-102),walkLook=new T.Vector3(3,1.7,-86),walkForward=walkLook.clone().sub(walkLocation).normalize();
const walkCenter=new T.Vector3(walkLocation.x+walkForward.x*16,22,walkLocation.z+walkForward.z*16);
const oldShadowFrusta=samples.map(s=>({day:s.day,minutesMoscow:s.minutesMoscow,overview:oldShadowFrame(s,new T.Vector3(0,40,-5),190),promenadeWalk:oldShadowFrame(s,walkCenter,66)}));
const files=['geo-reference.js','solar.js','complex-footprints.js','building-levels.js','neighbor-building-layout.js','neighbor-buildings.js','architectural-lighting.js','environment.js','cluster-map.js','onboarding.js','apartment3d.js'];
const result={createdAt:new Date().toISOString(),distSource:path.basename(path.dirname(dist)),threeRevision:T.REVISION,inputSHA256:Object.fromEntries(files.map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')])),geo:{frameVersion:geoFrame.version,geographicNorth:north,geographicEast:east,axisNorms:[Math.hypot(...north),Math.hypot(...east)],axisDot:dot(north,east),clockwiseWorldNorthFromMinusZDegrees:rounded(Math.atan2(north[0],-north[1])/radians),legacyNorthAngleToTrueNorthDegrees:rounded(angle),metersPerWorldUnit:metric,worldUnitsPerMeter:geoFrame.scale.fixedWorldUnitsPerMeter,accuracyMetersApproximate:geoFrame.accuracyMetersApproximate,locations,maximumRoundTripDegrees:Math.max(...locations.flatMap(l=>{const [lon,lat]=worldToGeo(l.worldXYZ[0],l.worldXYZ[2]);return[Math.abs(lon-l.longitude),Math.abs(lat-l.latitude)];}))},topView:{old:topProjection(legacyNorth),corrected:topProjection(north)},cardinal,buildings,neighbors,solarSamples:samples,oldShadowFrusta,notes:[
 'This report distinguishes verified coordinate transforms from unverified geometry dimensions.',
 'The 5 m figure is a prior visual registration tolerance, not a surveying accuracy certificate.',
 'World XZ and correctly scaled neighbor Y share one isotropic 1.1099621 m/unit metric. Main model height inputs are historical estimates in scene units.',
 'Ground mesh is locally level; no terrain DSM/DTM, absolute surveyed datum, or measured tree-height inventory is included.',
 'Solar/shadow results must not silently stretch the light vector to compensate for uncertain model height.',
 'Old-shadow-frustum vertex clipping is a diagnostic of map coverage, not proof that a particular visible pixel loses a shadow.'
]};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({out,geo:result.geo,topView:result.topView,buildings:buildings.map(({footprintWorldBounds,...b})=>b),neighbors:neighbors.length,solarSamples:samples.map(({locationVariation,...s})=>s),oldShadowClipping:oldShadowFrusta.map(s=>({day:s.day,minutes:s.minutesMoscow,overview:s.overview.buildings.filter(b=>b.verticesOutside).map(b=>b.building),walk:s.promenadeWalk.buildings.filter(b=>b.verticesOutside).map(b=>b.building)}))},null,2));
