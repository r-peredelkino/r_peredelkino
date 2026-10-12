import {residentialFloorBase} from './building-levels.js';
import {complexFootprints} from './complex-footprints.js';
import {additionalApartmentPlans} from './apartment-catalog-v37.js';
import {resolveApartmentRegistration} from './apartment-registration-v37.js';
// @r_peredelkino · pixel traces of the two personally accessible demo plans.
export const apartmentPlans={
'1-59':{area:24.7,outline:[[327,290],[1047,550],[984,750],[1035,782],[1060,850],[956,961],[181,699]],rooms:[{name:'Жилая зона',area:'13,5 м²',p:[[327,290],[640,403],[561,624],[230,550],[181,699],[484,802],[533,702],[737,774],[800,665],[642,607],[724,435]]},{name:'Кухня',area:'2,4 м²',p:[[640,403],[806,461],[736,670],[572,611]]},{name:'Санузел',area:'4,1 м²',p:[[814,466],[1047,550],[984,750],[745,670]]},{name:'Прихожая',area:'4,7 м²',p:[[737,672],[984,750],[1035,782],[1060,850],[956,961],[484,802],[533,702]]}],walls:[[327,290,1047,550],[1047,550,984,750],[984,750,1035,782],[1035,782,1060,850],[1060,850,1000,910],[956,961,181,699],[181,699,233,551],[307,335,327,290],[811,465,737,670],[737,670,799,692],[887,721,984,750]],windows:[[233,551,307,335]],doors:[[799,692,887,721],[1000,910,956,961]],furniture:[['sofa',463,406,245,92,.35],['table',529,607,82,82,0],['coffee',366,487,65,42,.35],['kitchen',703,471,146,57,.35],['sink',711,622,56,58,.35],['wardrobe',700,842,380,65,.35],['bath',974,650,68,169,.35],['vanity',918,535,63,40,.35],['toilet',831,580,46,55,.35],['washer',787,637,49,49,.35]],labels:[[444,564],[658,538],[881,622],[876,829]]},
'1-81':{area:82.7,outline:[[56,718],[56,677],[286,677],[286,718],[360,718],[360,666],[430,637],[455,666],[497,666],[497,710],[526,710],[526,557],[679,557],[679,567],[1055,426],[1096,466],[1137,593],[1189,719],[1204,793],[1190,856],[1153,903],[1096,938],[1032,960],[932,993],[57,962]],rooms:[{name:'Спальня 1',area:'14,7 м²',p:[[57,718],[307,718],[307,962],[57,962]]},{name:'Кухня',area:'9,1 м²',p:[[307,782],[588,782],[588,962],[307,962]]},{name:'Гостиная',area:'13,9 м²',p:[[588,710],[902,710],[902,790],[832,790],[832,962],[588,962]]},{name:'Спальня 2',area:'13,9 м²',p:[[786,526],[1055,426],[1096,466],[1137,636],[900,710],[810,710],[810,648]]},{name:'Спальня 3',area:'15,8 м²',p:[[900,710],[1137,636],[1189,719],[1204,793],[1190,856],[1153,903],[1096,938],[1032,960],[932,993],[832,962],[832,790],[902,790]]},{name:'Ванная',area:'5,5 м²',p:[[526,557],[679,557],[679,652],[731,652],[731,710],[526,710]]},{name:'Санузел',area:'3,3 м²',p:[[689,567],[786,526],[810,648],[799,710],[731,710],[731,652],[689,652]]},{name:'Холл',area:'6,5 м²',p:[[307,718],[360,718],[360,666],[430,637],[455,666],[497,666],[497,710],[588,710],[588,782],[307,782]]}],walls:[[56,718,56,962],[56,677,286,677],[286,677,286,718],[286,718,360,718],[360,718,360,666],[360,666,391,654],[458,668,497,666],[497,666,497,710],[497,710,526,710],[526,710,526,557],[526,557,679,557],[679,557,679,567],[679,567,1055,426],[1055,426,1070,467],[1110,589,1137,636],[1137,636,1160,717],[1190,857,1153,903],[1153,903,1096,938],[1096,938,1032,960],[1032,960,932,993],[932,993,914,962],[56,962,164,962],[296,962,392,962],[523,962,678,962],[749,962,832,962],[307,782,307,962],[307,782,582,782],[526,710,575,710],[626,710,811,710],[681,557,681,654],[681,654,799,654],[732,654,732,710],[799,654,811,710],[786,526,805,600],[867,710,903,710],[903,780,832,790],[832,790,832,962]],windows:[[164,962,296,962],[392,962,523,962],[678,962,749,962],[832,962,914,962],[1070,467,1110,589],[1160,717,1204,793],[1204,793,1190,857]],doors:[[257,718,307,782],[575,710,626,710],[805,600,849,648],[811,710,867,710],[849,720,903,780],[391,654,458,668]],furniture:[['bed',160,841,174,126,0],['wardrobe',173,698,230,39,0],['kitchen',333,863,45,169,0],['sink',364,807,42,40,0],['wardrobe',510,805,137,43,0],['table',507,868,95,58,0],['sofa',695,867,70,157,0],['coffee',741,831,42,34,0],['bed',939,552,135,153,-.35],['wardrobe',1036,674,180,38,-.35],['bed',929,875,159,137,0],['table',1110,756,68,92,-.2],['bath',590,582,128,42,0],['vanity',545,655,35,51,0],['toilet',652,636,36,40,0],['washer',704,686,42,42,0],['shower',764,684,58,53,0],['toilet',749,574,34,40,-.3],['vanity',705,622,34,51,0]],labels:[[181,930],[438,931],[710,746],[900,663],[1045,882],[602,660],[767,623],[453,749]]}
};

// Dimensions in the source raster. Furniture is reconstructed individually, never copied between layouts.
const studio=apartmentPlans['1-59'];
studio.rooms[0].p=[[327,290],[640,403],[572,611],[736,670],[737,672],[533,702],[484,802],[181,699],[230,550]];
studio.spawn=[885,819];studio.look=[560,570];studio.floor=6;studio.slot=7;
studio.furniture=[
 ['sofa',463,406,245,92,.35],['tv',323,732,116,10,Math.PI+.35],['coffee',366,487,68,62,.35],
 ['roundTable',529,607,82,82,0],['chair',589,622,40,42,1.92],['chair',516,662,40,42,3.35],
 ['kitchen',690,466,132,62,.35],['fridge',815,512,48,62,.35],['sink',711,622,58,59,.35],
 ['wardrobe',561,797,146,66,.35],['wardrobe',800,885,174,66,.35],['utility',665,835,67,66,.35],['bench',921,927,73,46,.35],
 ['chair',289,659,38,38,.35],
 ['bath',974,650,68,169,.35],['vanity',918,535,63,40,.35],['toilet',831,580,46,55,.35],['washer',787,637,49,49,.35]
];
studio.roomSpawns=[[421,561],[671,562],[901,655],[876,829]];
studio.roomLooks=[[463,406],[690,466],[974,650],[560,570]];
const family=apartmentPlans['1-81'];family.spawn=[441,745];family.look=[704,751];family.floor=8;family.slot=3;
// The left bedroom door is a horizontal opening. Its diagonal in the drawing is the open door leaf, not a partition.
family.walls=family.walls.filter(w=>!([[1190,857,1153,903],[1153,903,1096,938],[1096,938,1032,960],[1032,960,932,993]].some(a=>a.every((v,i)=>w[i]===v))));
family.walls.push([57,718,257,718],[307,718,307,724],[903,710,903,722],[903,710,1137,636]);
family.doors=[[257,718,307,718],[575,710,626,710],[805,600,822,648],[811,710,867,710],[903,722,903,780],[391,654,458,668]];
family.windows=family.windows.filter(w=>w[0]!==1160&&w[0]!==1204);
family.windows.push([1160,717,1191,773],[1191,773,1198,808],[1198,808,1186,851],[1186,851,1153,899],[1153,899,1096,934],[1096,934,1032,957],[1032,957,978,976],[978,976,932,993]);
// The curved glazed corner stops at the opaque pier after the small bedroom's straight window.
// The old final diagonal glass segment crossed that pier and did not exist in the source plan.
family.windows.pop();family.windows[family.windows.length-1]=[1032,957,984,962];
family.walls=family.walls.filter(w=>!(w[0]===932&&w[1]===993));family.walls.push([914,962,984,962]);
family.outline=family.outline.slice(0,17).concat([[1160,717],[1191,773],[1198,808],[1186,851],[1153,899],[1096,934],[1032,957],[984,962],[57,962]]);
family.rooms[4].p=[[900,710],[1137,636],...family.outline.slice(17,-1),[832,962],[832,790],[902,790]];
family.furniture=[
 ['bed',160,841,126,174,-Math.PI/2],['nightstand',72,761,31,31,0],['nightstand',72,914,31,31,0],['wardrobe',173,698,230,39,0],['plant',278,930,38,38,0],['tv',299,847,70,8,Math.PI/2],
 ['kitchen',333,880,110,45,-Math.PI/2],['fridge',333,930,45,46,-Math.PI/2],['sink',378,807,136,41,0],['wardrobe',510,805,137,43,0],
 ['rectTable',507,857,95,62,0],['chair',451,857,36,37,-Math.PI/2],['chair',564,857,36,37,Math.PI/2],['chair',483,902,36,37,Math.PI],['chair',530,902,36,37,Math.PI],
 ['lsofa',702,865,118,164,0],['coffee',739,833,51,54,0],['tv',822,866,80,10,Math.PI/2],
 ['bed',939,552,135,153,-.35],['nightstand',837,517,29,29,-.35],['nightstand',991,462,30,30,-.35],['wardrobe',1036,674,180,38,-.35],['plant',1043,460,36,36,0],
 ['bed',929,875,137,159,-Math.PI/2],['nightstand',849,801,30,30,0],['nightstand',849,948,30,24,0],['wardrobe',1051,700,180,34,-.35],
 ['desk',1110,756,59,87,-.2],['chair',1080,763,34,35,-Math.PI/2],['plant',1138,836,36,36,0],['plant',1134,882,35,35,0],
 ['bath',590,582,128,42,0],['vanity',545,655,35,51,-Math.PI/2],['toilet',652,636,36,40,Math.PI/2],['washer',704,686,42,42,0],
 ['shower',764,684,58,53,0],['toilet',749,574,34,40,-.3],['vanity',705,622,34,51,-Math.PI/2]
];
family.roomSpawns=[[258,818],[418,878],[790,818],[895,616],[1040,830],[595,639],[768,623],[453,749]];
family.roomLooks=[[160,841],[507,857],[702,865],[939,552],[929,875],[590,582],[749,574],[704,751]];
// Registration follows the inverted floor SVG slots and the rounded engineering envelope.
export function apartmentMetrics(data){
 const area=Math.abs(data.outline.reduce((s,p,i)=>{const q=data.outline[(i+1)%data.outline.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2);
 const spec=complexFootprints.buildings.find(b=>b.id===(data.building||1));
 const xs=data.outline.map(p=>p[0]),zs=data.outline.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,scale=Math.sqrt(data.area/area);
 const coord=(x,z)=>[(x-cx)*scale,(z-cz)*scale];
 // Register window-bearing facades, not the bounding-box centre. Rigid transforms preserve area and furniture.
 // Studio unchanged. Family slot 3: transformed SVG lower-right = west/corpus-2 corner.
 // The long window row faces the city/Borovskoye edge, not the office/courtyard edge.
 // See tools/qa-v32/apartment81-registration.json; rigid transform only.
 const registered=data.registration||(data.id==='1-59'||data===studio?{x:-1.3865794507,z:-50.8697617760,angle:1.1961343558}:data.id==='1-81'||data===family?{x:-11.474947308697,z:-64.900292892738,angle:-2.656204764522}:resolveApartmentRegistration(data,{scale,cx,cz,coord}));
 const registration=[registered.x,registered.z,registered.angle];
 return{scale,cx,cz,coord,width:(Math.max(...xs)-Math.min(...xs))*scale,depth:(Math.max(...zs)-Math.min(...zs))*scale,
 placement:{x:registration[0],z:registration[1],y:residentialFloorBase(data.building||1,data.floor,spec?.h||94,spec?.floors||30)+.12,angle:registration[2],building:data.building||1,floor:data.floor,slot:data.slot}};
}

// Ceiling heights: declaration 77-003147, 07.09.2026, table 15.2, apartments 59 and 81.
// Window elevations are visual estimates from facade renders, NOT an opening schedule.
for(const data of Object.values(apartmentPlans)){data.ceilingHeight=2.9;data.windowProfile={sill:.36,head:2.70,frame:.035};}
studio.windowProfile.bays=[2];
family.windowProfile.bays=[2,2,1,1,2,1,1,1,1,1,1,1];

Object.assign(apartmentPlans,additionalApartmentPlans);
for(const [id,data] of Object.entries(apartmentPlans)){data.id=id;data.building??=1;}
