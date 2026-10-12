// @r_peredelkino · RP-CONCEPT-2026-10-07 · source-inspired resident spaces, revision 36.
// Room adjacency follows the supplied renders/brochure. Dimensions and registration
// are an author proposal, since a measured ground-floor fit-out plan was not supplied.
const rect=(xmin,xmax,zmin,zmax)=>({xmin,xmax,zmin,zmax,outer:[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]],centre:{x:(xmin+xmax)/2,z:(zmin+zmax)/2}});
export const residentSourceMapping={
 concept:true,measuredPlan:false,sourceFloor:null,adaptedFloor:1,
 adjacencyEvidence:'Brochure: children enter through the coffee/coworking room; stroller/bicycle storage, guest WC and pawwash at the entrance',
 lobby:['1_lobby.webp','3_lobby.webp','4_lobby.webp','5_lobby.webp'],
 wash:['8_lobby.jpg','10_lobby.webp'],stroller:['11_kolysochnaya.webp'],
 lift:['01.webp','02.webp','06.webp','07.webp'],apartmentHall:['09.webp','10.webp','12.webp'],
 materials:'Cream mineral flooring, timber panels, brushed metal, navy rug, suspended wave of point lights',
 limitation:'Source images establish visible finishes and room functions, not exact room dimensions or a verified floor allocation.'
};
const lobby=rect(-11,11,-2,10),corridor=rect(-1.7,1.7,-22,-2),yoga=rect(-11,-1.7,-22,-15),kids=rect(-11,-1.7,-15,-8),coffee=rect(-11,-1.7,-8,-2),lift=rect(1.7,11,-22,-15),washStroller=rect(1.7,11,-15,-8),lounge=rect(1.7,11,-8,-2);
const guestWC=rect(8.15,10.75,-14.8,-12.1);
const zones={lobby,corridor,yoga,kids,coffee,lift,washStroller,lounge,guestWC};
const names={lobby:'Лобби / ожидание',corridor:'Галерея резидентов',yoga:'Йога / тихая тренировка',kids:'Детская игровая',coffee:'Кофейня / коворкинг',lift:'Лифтовой холл',washStroller:'Сервис / колясочная',lounge:'Лаунж / чилл-комната'};
const doors=[
 {id:'door-yoga',axis:'x',coordinate:-1.7,centre:-18.5,width:2.2,rooms:['corridor','yoga']},
 {id:'door-coffee',axis:'x',coordinate:-1.7,centre:-4.8,width:2.2,rooms:['corridor','coffee']},
 {id:'door-kids',axis:'z',coordinate:-8,centre:-6.3,width:2.2,rooms:['coffee','kids']},
 {id:'door-lift',axis:'x',coordinate:1.7,centre:-18.5,width:2.2,rooms:['corridor','lift']},
 {id:'door-service',axis:'x',coordinate:1.7,centre:-11.5,width:2.2,rooms:['corridor','washStroller']},
 {id:'door-lounge',axis:'x',coordinate:1.7,centre:-4.8,width:2.2,rooms:['corridor','lounge']},
 {id:'door-corridor',axis:'z',coordinate:-2,centre:0,width:3.4,rooms:['lobby','corridor']},
 {id:'door-entrance',axis:'z',coordinate:10,centre:0,width:2.4,rooms:['lobby','outside']}
];
export const residentLayout={kind:'lobby',floor:1,floorY:0,ceilingHeight:3.3,lobbyHeight:5.2,
 outerBoundary:rect(-11,11,-22,10).outer,boundary:rect(-11,11,-22,10).outer,zones,zoneRects:zones,doors,names,
 roomSpawn:{lobby:{x:0,z:7.4},corridor:{x:0,z:-3.1},yoga:{x:-3.4,z:-18.5},kids:{x:-6.3,z:-9.4},coffee:{x:-3.4,z:-4.8},lift:{x:3.4,z:-18.5},washStroller:{x:3.4,z:-11.5},lounge:{x:3.4,z:-4.8},guestWC:{x:9.45,z:-12.7}},
 lookAt:{lobby:{x:-5.3,y:1.4,z:3},corridor:{x:0,y:1.4,z:-18},yoga:{x:-8,y:1.4,z:-18.5},kids:{x:-6.3,y:1,z:-12},coffee:{x:-8,y:1.3,z:-5},lift:{x:7.5,y:1.5,z:-19.8},washStroller:{x:6,y:1.4,z:-13},lounge:{x:7.5,y:1.2,z:-5},guestWC:{x:9.6,y:1.1,z:-14}},
 sourceMapping:residentSourceMapping,metadata:{concept:true,measuredPlan:false,floor:1,childrenEntryViaCoffee:true,duplicatedDeveloperPlan:false}
};
export const apartmentHallLayout={kind:'apartment-hall',floorY:0,ceilingHeight:3.05,
 outerBoundary:rect(-3.3,3.3,-16,7).outer,boundary:rect(-3.3,3.3,-16,7).outer,
 zones:{apartmentHall:rect(-3.3,3.3,-16,7)},zoneRects:{apartmentHall:rect(-3.3,3.3,-16,7)},
 doors:[],roomSpawn:{apartmentHall:{x:0,z:5}},lookAt:{apartmentHall:{x:0,y:1.3,z:-12}},
 sourceMapping:residentSourceMapping,metadata:{concept:true,measuredPlan:false,originalApartmentPlansUnchanged:true}
};
export function getResidentLayout(kind='lobby'){return kind==='apartment-hall'?apartmentHallLayout:residentLayout;}
