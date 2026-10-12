// @r_peredelkino · geographic registration of the existing fixed project model.
// Legacy e/n are diagram coordinates used by old facade modules, not geographic ENU.
// Only geoToWorld()/worldToGeo() represent geographic East/North.
export const geoFrame={"version":28,"originLonLat":[37.35316185,55.63841785],"worldOriginLonLat":[37.35292368617269,55.636552730942945],"metersPerDegree":{"east":62830.237112730676,"north":111319.49079327358},"enuToWorldXZ":{"matrix":[[0.9009260240311945,-0.003186666186893002],[-0.0031866661868929997,-0.9009260240311948]],"translation":[12.819728978036249,-187.10164316156158],"formula":"[x,z] = matrix * [east_m,north_m] + translation"},"scale":{"metersPerFixedWorldUnit":1.1099621032624687,"fixedWorldUnitsPerMeter":0.9009316597933738},"eastWorld":[0.9999937445175582,-0.0035370787031991455],"northWorld":[-0.0035370787031991464,-0.9999937445175582],"accuracyMetersApproximate":5,"fitRMSMeters":{"mapControlsMeters":2.3083339121725928,"modelControlsMeters":3.019232278155656},"source":"https://www.mos.ru/upload/documents/files/8583/Aktsprilojeniyami_Borovskoesh51%281%29.pdf","sourcePage":40,"drawingDate":"2023-10","registrationDate":"2026-10-10","method":"Rigid similarities from five persistent OSM building centres and six unchanged project-plan centres; image registration, not a survey."};

const legacyEast=[-.69716,.71691],legacyNorth=[.71691,.69716];
const legacyNorm=legacyEast[0]**2+legacyEast[1]**2;
const [[a,b],[c,d]]=geoFrame.enuToWorldXZ.matrix,[tx,tz]=geoFrame.enuToWorldXZ.translation,det=a*d-b*c;
const [lon0,lat0]=geoFrame.originLonLat;
export const metersToModel=value=>value*geoFrame.scale.fixedWorldUnitsPerMeter;
export function geoToWorld(lon,lat,y=0){
 const east=(lon-lon0)*geoFrame.metersPerDegree.east,north=(lat-lat0)*geoFrame.metersPerDegree.north;
 return[a*east+b*north+tx,y,c*east+d*north+tz];
}
export function worldToGeo(x,z){
 const dx=x-tx,dz=z-tz,east=(d*dx-b*dz)/det,north=(-c*dx+a*dz)/det;
 return[lon0+east/geoFrame.metersPerDegree.east,lat0+north/geoFrame.metersPerDegree.north];
}
export function worldToModel(x,z){return[(x*legacyEast[0]+z*legacyEast[1])/legacyNorm,(x*legacyNorth[0]+z*legacyNorth[1])/legacyNorm];}
export function geoToModel(lon,lat){const [x,,z]=geoToWorld(lon,lat);return worldToModel(x,z);}
export function modelToGeo(e,n){return worldToGeo(e*legacyEast[0]+n*legacyNorth[0],e*legacyEast[1]+n*legacyNorth[1]);}
