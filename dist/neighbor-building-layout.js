// Addressed surroundings: published OSM polygons replace the v27 rectangular placeholders.
// Footprint data © OpenStreetMap contributors, ODbL 1.0; facade interpretation @r_peredelkino.
import {neighborFootprints,neighborFootprintSource} from './neighbor-footprints-data.js?v=community38';
import {geoToModel,metersToModel} from './geo-reference.js?v=community38';

const pink={wall:0xbf91a6,alternate:0xcba9b5,accent:0x98576e,end:0xe0e4de,frame:0xe9ece5,balcony:0x955068,glass:0x56616a};
const ochre={wall:0xdce0d8,alternate:0xe6e6dd,accent:0xc6b07d,end:0xe2e5de,frame:0xf0f0e7,balcony:0xc9b88f,glass:0x57626a};
const grey={wall:0xd1d6d2,alternate:0xc2c9c5,accent:0xaeb8b3,end:0xdde1da,frame:0xe7eae2,balcony:0xd7dcd6,glass:0x5c666e};
const mapViews=['2026-10-10 22.38.34','2026-10-10 22.38.43','2026-10-10 22.38.48'];

// Edge numbers refer to the untouched, closed OSM rings in neighbor-footprints-data.js.
// Ends are the actual transverse closing edges. Short polygon jogs remain walls;
// none is replaced by a fabricated join, chord, circular arc or courtyard roof.
const profiles={
 41278293:{profile:'pink-white-panel',shape:'two-wing bent open block',endEdges:[0,3],roofEdges:[1,2],entryEdges:[1,2],
  palette:pink,sourceViews:[...mapViews,'2026-10-10 22.40.12','2026-10-10 22.40.01'],facadeConfidence:'strong visible street faces',balconyPitch:3},
 41278310:{profile:'grey-taupe-slab',shape:'separate two-wing bent open block',endEdges:[0,7],roofEdges:[1,6],entryEdges:[8,9],loggiaEdges:[8,9],
  palette:{...grey,wall:0xc6c9bf,accent:0xb2ac9d,balcony:0xd6d6ca},sourceViews:[...mapViews,'2026-10-10 22.40.12'],facadeConfidence:'wide street-facing loggia bands visible behind47; reverse side estimated',balconyPitch:4},
 41278378:{profile:'pink-white-panel',shape:'two-wing bent open block',endEdges:[6,9],roofEdges:[0,5],entryEdges:[7,8],
  palette:{...pink,wall:0xc191a7},sourceViews:[...mapViews,'2026-10-10 22.40.01','2026-10-09 12.03.14'],facadeConfidence:'strong visible street faces',balconyPitch:3},
 41277643:{profile:'white-ochre-panel',shape:'five-wing open C-shaped block',endEdges:[23,31],roofEdges:[0,5,6,11,16,17,22],entryEdges:[24,25,26,27,28,29,30],
  palette:{...ochre,wall:0xd9ddd4,accent:0xc2b18b,balcony:0xcfc4a8},sourceViews:[...mapViews,'2026-10-10 22.40.17','2026-10-10 22.40.21'],facadeConfidence:'visible ends and part of the street facade; far side estimated',balconyPitch:3,accentPitch:4},
 27791393:{profile:'white-grey-highrise',shape:'separate 22-storey slab with stepped rear facade',endEdges:[1,19],roofEdges:[0],entryEdges:[0],
  palette:{...grey,wall:0xd7d8cf,accent:0xb6af99,balcony:0xc8c9be},sourceViews:[...mapViews,'2026-10-10 22.40.17','2026-10-10 22.40.21'],facadeConfidence:'visible street side and plain end; rear details estimated',balconyPitch:2},
 41277477:{profile:'white-ochre-panel',shape:'straight long slab with stepped rear facade',endEdges:[2,24],roofEdges:[0,1],entryEdges:[0,1],
  palette:ochre,sourceViews:[...mapViews,'2026-10-10 22.40.12','2026-10-10 22.40.17'],facadeConfidence:'strong visible street faces',balconyPitch:3,accentPitch:4},
 41277322:{profile:'white-ochre-panel',shape:'straight slab',endEdges:[1,3],roofEdges:[0],entryEdges:[2],
  palette:{...ochre,accent:0xc5b78e,balcony:0xd1c6a6},sourceViews:[...mapViews,'2026-10-10 22.40.17'],facadeConfidence:'visible street side; reverse side estimated',balconyPitch:3,accentPitch:4},
 41277248:{profile:'white-ochre-panel',shape:'three linked angled wings',endEdges:[0,8],roofEdges:[1,2,7],entryEdges:[9,10,15],
  palette:{...ochre,accent:0xc7ad78,balcony:0xc9b890},sourceViews:[...mapViews,'2026-10-10 22.40.17'],facadeConfidence:'distant partial street facade',balconyPitch:3,accentPitch:4},
 41278780:{profile:'grey-white-panel',shape:'straight 14-storey slab',endEdges:[0,2],roofEdges:[1],entryEdges:[3],
  palette:grey,sourceViews:[...mapViews,'2026-10-10 22.40.01'],facadeConfidence:'visible distant facade and end',balconyPitch:4},
 41278786:{profile:'grey-taupe-slab',shape:'long straight 14-storey slab',endEdges:[1,3],roofEdges:[0],entryEdges:[2],loggiaEdges:[0],
  palette:{wall:0xb9bfba,alternate:0xc7ccc4,accent:0xaaa99b,end:0xb9bbaf,frame:0xe2e5db,balcony:0xd0d3c9,glass:0x5b666e},
  sourceViews:[...mapViews,'2026-10-10 22.40.01','2026-10-08 21.51.44'],facadeConfidence:'long street-facing loggias visible; reverse side estimated',balconyPitch:4},
 41277631:{profile:'white-grey-panel',shape:'straight 17-storey slab',endEdges:[1,3],roofEdges:[0],entryEdges:[2],
  palette:{...grey,wall:0xd9ded6,accent:0xc6c4b1,balcony:0xd9d9cd},sourceViews:[...mapViews,'2026-10-10 22.40.21'],facadeConfidence:'distant visible street facade only',balconyPitch:3}
};

// Vertical design dimensions below are in real metres. The builder applies
// metersToModel(1) to its complete vertical frame about baseY, matching the GIS
// plan scale while retaining exactly the tagged count of storeys.
export const neighborBuildingLayout={
 version:28,baseY:-.65,groundHeight:3.10,floorHeight:2.85,upperWallReserve:.50,
 source:neighborFootprintSource,
 buildings:neighborFootprints.map(source=>({...source,...profiles[source.osmWayId]})),
 accuracy:'Building identities, polygon vertices and storeys come from the cited OSM ways. Faceted open forms follow those polygons without bounding-box substitution. Colours and facade families are interpreted from the supplied 2024–2025 panoramas and other references. Floor-to-floor heights, window pitch, balcony details, entrances and roof equipment are estimates, not an as-built survey or a claim of 1:1 accuracy.'
};

export function neighborRingArea(ring){let value=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];value+=a[0]*b[1]-b[0]*a[1];}return value/2;}
export function neighborPointInside(e,n,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>n)!==(ring[j][1]>n)&&e<(ring[j][0]-ring[i][0])*(n-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])inside=!inside;return inside;}
export function neighborSegmentDistance(e,n,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy,t=length2?Math.max(0,Math.min(1,((e-a[0])*dx+(n-a[1])*dy)/length2)):0;return Math.hypot(e-a[0]-dx*t,n-a[1]-dy*t);}

// contextBuildings is deliberately ignored: v27's seven boxes had no reliable
// one-to-one address mapping and must not shift, scale or duplicate these houses.
export function resolveNeighborBuildingLayout(_contextBuildings){
 const planUnit=metersToModel(1);
 if(!Number.isFinite(planUnit)||planUnit<=0)throw new Error('Invalid neighbouring-building geographic scale');
 return neighborBuildingLayout.buildings.map(source=>{
  if(!source.profile)throw new Error(`Missing facade reference for ${source.address}`);
  const coordinates=source.coordinates.slice(0,-1),footprintEN=coordinates.map(([lon,lat])=>geoToModel(lon,lat));
  if(footprintEN.some(p=>p.length!==2||!p.every(Number.isFinite)))throw new Error(`Invalid geographic footprint: ${source.address}`);
  const area=neighborRingArea(footprintEN),winding=Math.sign(area);
  if(Math.abs(area)<20*planUnit*planUnit)throw new Error(`Degenerate geographic footprint: ${source.address}`);
  const boundsEN={minE:Math.min(...footprintEN.map(p=>p[0])),maxE:Math.max(...footprintEN.map(p=>p[0])),minN:Math.min(...footprintEN.map(p=>p[1])),maxN:Math.max(...footprintEN.map(p=>p[1]))};
  const edges=footprintEN.map((a,index)=>{const b=footprintEN[(index+1)%footprintEN.length],de=b[0]-a[0],dn=b[1]-a[1],length=Math.hypot(de,dn);return{index,a,b,length,tangent:[de/length,dn/length],normal:[winding*dn/length,-winding*de/length],center:[(a[0]+b[0])/2,(a[1]+b[1])/2],end:source.endEdges.includes(index),continuousLoggia:source.loggiaEdges?.includes(index)||false};});
  const height=neighborBuildingLayout.groundHeight+(source.floors-1)*neighborBuildingLayout.floorHeight+neighborBuildingLayout.upperWallReserve;
  return{...source,baseY:neighborBuildingLayout.baseY,groundHeight:neighborBuildingLayout.groundHeight,floorHeight:neighborBuildingLayout.floorHeight,height,roofY:neighborBuildingLayout.baseY+height,planUnit,coordinates,footprintEN,edges,boundsEN,envelopeEN:boundsEN,footprintArea:Math.abs(area),footprintPerimeter:edges.reduce((sum,e)=>sum+e.length,0)};
 });
}
