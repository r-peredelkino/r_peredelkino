// @r_peredelkino · source-ground reconstruction, 11 October 2026.
// Coordinates identify visible source features, not surveyed planting schedules.
import * as T from './vendor/three.module.js';
import {insideRing} from './walk-physics.js?v=community38';
export const courtyardSource = Object.freeze({
 revision:33,sourceURL:'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/',node:'node3',oppositeNode:'node1',
 camera:{longitude:37.355754,latitude:55.636534,altitude:130,northOffset:278.84},
 method:'Original cubemap pixels, ray/ground-plane projection, architectural footprint registration and opposite-view comparison.',
 accuracy:'Reference reconstruction. Tree heights, hidden edges and furniture dimensions remain inferred; no survey-level accuracy claimed.',
 officeReferences:['XXL_height.webp','orig.webp','i.webp'],masterplanReference:'novostroyka-novoperedelkino-2913438749-1.jpg.webp',
 views:['2026-10-11 13.38.21','2026-10-11 13.38.28','2026-10-11 13.38.16','2026-10-11 13.38.37','2026-10-11 19.30.22','2026-10-11 19.30.08','2026-10-11 19.31.39']
});
export const courtyardSourceBoundary=[[-28,-39],[-15,-51],[12,-50],[34,-50],[46,-42],[39,-26],[28,-8],[35,7],[48,22],[54,39],[43,49],[19,49],[3,43],[-15,34],[-22,13],[-24,-11]];
export const inSourceCourtyard=(x,z)=>insideRing(x,z,courtyardSourceBoundary);
export const sourceCourtyardZones=[
 {id:'lounge',x:.5,z:1.4,rx:6.8,rz:4.6,programme:'event cinema',referenceRevision:33},
 {id:'sport',x:16,z:-29,rx:10.2,rz:5.6,referenceRevision:33},
 {id:'play',x:25,z:25,rx:12.6,rz:9.5,referenceRevision:33},
 {id:'events',x:-7.0,z:-3.1,rx:2.8,rz:2.8,referenceRevision:33},
 {id:'fountain',x:-10.472389,z:5.082383,rx:2.7,rz:2.6,entranceId:3,referenceRevision:33}
];
// Ground boundaries are traced separately from elevated crowns/canopies.
export const sourceIslandAnchors=[
 {id:'north-central',points:[[0,-42],[5,-45],[15,-45],[23,-42],[23,-38],[18,-37],[13,-38],[7,-37],[3,-37]]},
 {id:'north-spine',points:[[-9,-35],[-4,-37],[1,-34],[5,-30],[6,-25],[3,-21],[-2,-19],[-7,-20],[-10,-25]]},
 {id:'north-entry-pocket',points:[[-22,-36],[-19,-40],[-15,-39],[-12,-35],[-14,-32],[-18,-32]]},
 {id:'sport-peninsula',points:[[5,-27],[8,-25],[10,-21],[7,-19],[2,-18],[-2,-19],[-2,-23]]},
 {id:'cinema-north',points:[[-10,-16],[-6,-18],[-1,-17],[3,-14],[4,-11],[3,-7],[-2,-6],[-8,-8],[-12,-12]]},
 {id:'east-spine-north',points:[[13,-21],[19,-24],[24,-23],[25,-20],[21,-16],[20,-13],[23,-10],[22,-5],[18,-4],[13,-8],[11,-14]]},
 {id:'cinema-south',points:[[-8,7],[-3,6],[1,9],[1,12],[-2,14],[-6,14],[-10,10]]},
 {id:'east-spine-middle',points:[[8,5],[13,4],[18,7],[21,11],[21,15],[18,18],[13,17],[9,14],[7,10]]},
 {id:'western-low-bed',points:[[-12,16],[-8,15],[-5,18],[-4,23],[-6,27],[-10,28],[-13,24]]},
 {id:'play-west',points:[[4,16],[9,16],[12,19],[12,24],[9,28],[5,27],[3,22]]},
 {id:'play-south',points:[[11,33],[19,32],[28,32],[35,34],[34,38],[27,40],[19,39],[14,37]]},
 {id:'play-east',points:[[38,17],[42,18],[47,22],[49,28],[47,34],[43,35],[39,30],[40,26],[37,22]]},
 {id:'office-plinth-pocket',points:[[23,-48],[29,-51],[37,-50],[39,-45],[36,-42],[31,-42],[28,-44]]},
 {id:'office-courtyard-pocket',points:[[35,-39],[40,-41],[43,-38],[42,-33],[38,-32],[34,-35]]}
];
export const sourceGardenPaths=[
 {id:'west-garden',width:2.15,points:[[-18,30],[-12,28],[-8,23],[-8,17],[-11,12],[-11,7],[-12,1],[-12,-5],[-9,-11],[-7,-19],[-11,-25],[-14,-29],[-10,-35],[-8,-40]]},
 {id:'east-garden',width:1.9,points:[[8,-44],[21,-42],[28,-38],[30,-33],[28,-27],[24,-23],[24,-17],[25,-12],[23,-7],[23,-2],[22,4],[25,9],[24,14],[28,18],[38,20],[45,27],[43,32],[41,38]]},
 {id:'cinema-to-play',width:1.85,points:[[1,7],[4,10],[8,12],[11,15],[12,20]]},
 {id:'sport-to-cinema',width:1.8,points:[[8,-21],[6,-17],[4,-13],[4,-9],[5,-4],[8,0],[11,3],[13,7]]},
 {id:'play-eastern-bypass',width:1.9,points:[[31,16],[38,16],[43,19],[46,24],[48,29],[46,34],[41,39]]}
];
export const sourcePlazaInlays=[
 [[-23,-38],[-19,-37],[-15,-35],[-14,-31],[-19,-28],[-20,-24],[-16,-20],[-10,-18],[-8,-13]],
 [[-25,-32],[-21,-30],[-22,-26],[-18,-23],[-14,-20],[-10,-17],[-11,-13],[-14,-10]],
 [[-22,-20],[-18,-16],[-19,-10],[-17,-5],[-13,-1],[-12,4],[-15,8],[-13,11]],
 [[-19,-18],[-16,-14],[-17,-10],[-14,-5],[-10,-2],[-9,2],[-11,7],[-9,11]],
 [[4,-45],[10,-44],[14,-40],[12,-36],[10,-32]],
 [[5,-44],[7,-41],[9,-37],[14,-35],[21,-36],[27,-40],[32,-40]],
 [[-14,29],[-10,31],[-5,32],[0,34],[5,38],[10,41],[16,42]],
 [[-12,30],[-7,30],[-4,33],[1,33],[6,36],[8,39],[16,40],[23,39]],
 [[33,34],[36,37],[35,40],[37,43],[42,44],[46,42]]
];
export const sourceGrassPaverWedges=[
 [[-14,-33],[-10,-36],[-4,-37],[1,-34],[1,-31],[-4,-31],[-10,-30]],
 [[15,-45],[20,-48],[25,-47],[28,-43],[29,-40],[23,-40],[18,-41]],
 [[-16,-8],[-12,-12],[-9,-10],[-9,-5],[-7,-2],[-8,2],[-13,-1]],
 [[-7,19],[-4,20],[2,24],[4,29],[2,32],[-3,29],[-6,25]],
 [[18,35],[23,34],[29,35],[33,38],[31,41],[26,42],[20,39]],
 [[40,31],[45,30],[48,32],[50,36],[48,39],[44,38]]
];
export function sampleSourcePath(route,count=180){return new T.CatmullRomCurve3(route.points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal').getPoints(count).map(p=>[p.x,p.z]);}
