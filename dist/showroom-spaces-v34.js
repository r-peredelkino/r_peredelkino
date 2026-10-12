// @r_peredelkino · RP-CONCEPT-2026-10-07 · authored interior proposals, revision 34.
// Lobby/office fit-outs are concepts. They are not developer-issued interior plans.
import * as T from './vendor/three.module.js';

/** CPU-only construction: the showroom owns and disposes every geometry/material/texture. */
export function createConceptInterior(kind,{root,mats,ownedGeometries,ownedMaterials,box,mesh,luminous,makeLabel,building=1}={}){
 const obstacles=[],poi=[],animated=[];
 const solid=(w,h,d,x,y,z,mat,name)=>{const o=box(w,h,d,x,y,z,mat,name);obstacles.push({type:'box',x,z,width:w,depth:d});return o;};
 const cylinder=(r,h,x,y,z,mat,name)=>{const o=mesh(new T.CylinderGeometry(r,r,h,16),mat,name);o.position.set(x,y+h/2,z);return o;};
 const material=(color,roughness=.75,metalness=0)=>{const mat=new T.MeshStandardMaterial({color,roughness,metalness});ownedMaterials.add(mat);return mat;};
 const green=material(0x56654a),bronze=material(0x84775d,.38,.65),fabric=material(0x697987),leaf=material(0x627a4f);
 const label=(text,x,y,z,w=2.4,h=.6)=>makeLabel(text,w,h,x,y,z);
 function plant(x,z,r=.42){
  cylinder(r,.52,x,0,z,mats.stone,'Concept mineral planter');cylinder(.055,1.35,x,.5,z,mats.wood,'Concept indoor tree trunk');
  const canopy=mesh(new T.IcosahedronGeometry(r*1.65,1),leaf,'Concept indoor tree crown');canopy.position.set(x,1.95,z);canopy.scale.set(1,1.24,1);
  obstacles.push({type:'circle',x,z,radius:r});
 }
 function chair(x,z,rotation=0){
  const group=new T.Group();group.name='Concept upholstered lounge chair';group.position.set(x,0,z);group.rotation.y=rotation;root.add(group);
  box(.78,.18,.74,0,.36,0,fabric,'Upholstered chair seat',group);box(.78,.7,.12,0,.42,.34,fabric,'Upholstered chair back',group);
  for(const sx of [-.3,.3])for(const sz of [-.27,.27])box(.045,.36,.045,sx,0,sz,bronze,'Chair support',group);
  obstacles.push({type:'circle',x,z,radius:.52});
 }
 function table(x,z,r=.5){cylinder(r,.08,x,.65,z,mats.wood,'Timber community table');cylinder(.06,.64,x,0,z,bronze,'Community table support');obstacles.push({type:'circle',x,z,radius:r});}
 function sofa(x,z){solid(3.2,.38,.88,x,.16,z,green,'Timber and fabric lobby bench');box(3.2,.55,.12,x,.48,z+.42,green,'Lobby bench back');}
 function lightGrid(width,depth,height){
  const geo=new T.BoxGeometry(width,.04,.055);ownedGeometries.add(geo);const lines=new T.InstancedMesh(geo,mats.neon,4),dummy=new T.Object3D();lines.name='Concept ceiling luminaires · four batched strips';
  for(let i=0;i<4;i++){dummy.position.set(0,height,-depth*.33+i*depth*.22);dummy.updateMatrix();lines.setMatrixAt(i,dummy.matrix);}root.add(lines);
 }
 function mailboxes(x,z){
  const geo=new T.BoxGeometry(.44,.29,.22);ownedGeometries.add(geo);const boxes=new T.InstancedMesh(geo,bronze,36),dummy=new T.Object3D();boxes.name='Concept parcel and letter wall · 36 batched fronts';
  for(let row=0;row<6;row++)for(let col=0;col<6;col++){dummy.position.set(x+(col-2.5)*.5,.48+row*.34,z);dummy.updateMatrix();boxes.setMatrixAt(row*6+col,dummy.matrix);}root.add(boxes);
 }
 const sales=kind==='sales',width=sales?14.2:kind==='office'?22:14,depth=sales?16.8:kind==='office'?18:13,h=sales?3.1:kind==='office'?4.7:5.2;
 const boundary=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]];
 box(width,.12,depth,0,-.12,0,mats.stone,'Concept mineral lobby floor');
 box(width,.2,depth,0,h,0,mats.white,'Concept interior ceiling');
 box(width,.12,.08,0,0,depth/2,mats.metal,'Entrance threshold');
 for(const x of [-width/2,width/2])box(.14,h,depth,x,0,0,x>0?mats.glass:mats.white,x>0?'Concept floor-to-ceiling side glazing':'Concept interior side wall');
 box(width,h,.08,0,0,depth/2,mats.glass,'Concept entrance glazing');
 box(width,h,.15,0,0,-depth/2,mats.white,'Concept rear interior wall');
 for(const x of [-1.1,1.1])box(.06,3,.08,x,0,depth/2-.04,bronze,'Entrance door slim mullion');
 label(sales?'ОФИС / ПРОДАЖИ':kind==='office'?'ОФИС / 0':`КОРПУС / ${building}`,0,sales?2.6:3.4,depth/2-.1,3.8,.72).rotation.y=Math.PI;
 lightGrid(width-2,depth,h-.04);
 if(kind==='lobby'){
  solid(2.8,.98,1.1,-4.7,0,-1.4,mats.wood,'Concept concierge reception');label('РЕСЕПШЕН',-4.7,1.55,-2.02,2,.4);
  makeLabel(`ДОМ / ${building}`,2.3,1.1,-4.7,2.5,-depth/2+.12);
  sofa(3.65,1.25);table(3.1,-.3,.55);chair(4.8,-.6,.4);plant(5.8,4.7,.46);plant(-5.8,4.7,.46);
  mailboxes(-4.45,-depth/2+.25);label('ПОЧТА / ПОСЫЛКИ',-4.5,2.85,-depth/2+.13,2.8,.5);
  solid(1.15,.88,1.05,5.4,0,-4.3,mats.wood,'Concept parcel pick-up counter');
  label('E / ИНФО',-4.7,1.16,-.83,1.55,.35);
  const doors=new T.Group();doors.name='Concept lift doors · illustrative lift only';doors.position.set(1.4,0,-depth/2+.12);root.add(doors);
  const left=box(1.02,2.75,.07,-.53,0,0,mats.metal,'Concept left lift door',doors),right=box(1.02,2.75,.07,.53,0,0,mats.metal,'Concept right lift door',doors);
  for(const x of [-1.15,1.15])box(.12,2.94,.17,x,0,.03,bronze,'Lift portal jamb',doors);box(2.4,.14,.17,0,2.8,.03,bronze,'Lift portal header',doors);
  label('ЛИФТ',1.4,3.22,-depth/2+.24,1.7,.42);
  solid(.25,1.15,.16,2.93,.8,-depth/2+.16,bronze,'Concept lift call panel');
  poi.push({id:'concierge',name:'Консьерж / навигация',x:-4.7,z:.3,description:`Входная группа корпуса ${building}: стойка, зона ожидания, почтовые ячейки и лифтовой холл. Это авторская расстановка, не опубликованный интерьер застройщика.`,action:'info'});
  poi.push({id:'lift',name:'Лифт / обзор этажей',x:1.4,z:-4.4,description:building===1?'Выберите 2 или 30 этаж: откроется прежний обзорный контур корпуса 1 с оригинальным планом. Лифт показан как навигация, скорость и устройство не моделируются.':'Лифтовой холл — авторская концепция. Интерактивные обзорные этажи в этой версии реализованы для корпуса 1.',action:'lift'});
  poi.push({id:'parcel',name:'Получение посылок',x:-4.45,z:-4.5,description:'Пример места для безопасной выдачи посылок и хранения почты. Здесь нет подключения к настоящей системе доставки.',action:'info'});
  poi.push({id:'exit',name:'Вход / вернуться во двор',x:0,z:depth/2-1.3,description:'Вернуться к той же двери снаружи и продолжить прогулку по комплексу.',action:'exit'});
  animated.push({type:'lift',left,right});
  return{boundary,obstacles,poi,animated,walker:{x:0,z:3.5},overview:{position:[16,12,18],target:[0,2,0]},focus:{x:1.4,z:-3.7},metadata:{concept:true,sourceInteriorPlan:false,building,kind,mailboxes:36}};
 }
 if(sales){
  solid(3,.98,.95,-3.7,0,-1.4,mats.wood,'Concept sales pavilion reception desk');label('РЕСЕПШЕН / ВСТРЕЧА',-3.7,1.55,-1.92,2.65,.42);
  label('RODINA / ПЕРЕДЕЛКИНО',-3.7,2.1,-depth/2+.1,4.5,.76);
  sofa(3.1,5);table(3.1,3.1,.55);chair(4.9,3.05,-.5);plant(-5.7,6.9,.45);plant(5.7,6.9,.45);
  solid(2.8,.12,1.15,2.6,.75,-4.8,mats.wood,'Concept sales consultation table');chair(2.6,-6.05,0);chair(2.6,-3.58,Math.PI);
  label('КОНСУЛЬТАЦИЯ',2.6,2.1,-depth/2+.1,3.8,.62);
  solid(.8,1.18,.6,-5.6,0,2.7,mats.metal,'Concept source information terminal');label('ПРОЕКТ / ИСТОЧНИК',-5.6,1.53,2.37,1.28,.55).rotation.y=Math.PI;
  poi.push({id:'sales-reception',name:'Офис продаж / ресепшен',x:-3.7,z:.3,description:'Компактное пространство встречи гостей внутри существующего павильона: ресепшен, ожидание и консультация. Расстановка — авторская концепция, внутреннего рабочего плана павильона нет.',action:'info'});
  poi.push({id:'sales-consultation',name:'Стол консультации',x:2.6,z:-2.1,description:'Пример места для обсуждения квартиры и проекта. Можно сесть за стол; настоящая запись на встречу и передача данных сотрудникам здесь не подключены.',action:'meeting',view:{position:[2.6,1.22,-3.58],target:[2.6,1.4,-6.0]}});
  poi.push({id:'sales-project',name:'Проект / официальные источники',x:-5.6,z:1.5,description:'Генплан, планы этажей и актуальные предложения следует сверять с исходными материалами застройщика. Терминал в этом лобби — интерфейс концепта, не публичная оферта.',action:'project-source'});
  poi.push({id:'exit',name:'Вход / вернуться к павильону',x:0,z:depth/2-1.3,description:'Вернуться к той же входной группе офиса продаж снаружи.',action:'exit'});
  return{boundary,obstacles,poi,animated,walker:{x:0,z:5.5},overview:{position:[17,12,21],target:[0,1.4,0]},focus:{x:2.6,z:-2.1},metadata:{concept:true,sourceInteriorPlan:false,building:'sales-office',kind,officePurpose:'sales',interiorBounds:[14.2,16.8],exteriorPavilionUnchanged:true}};
 }
 // Office reception: clear central accessible circulation, glazed meeting booth and coworking.
 solid(3.8,1,1.05,-6,0,2,mats.wood,'Concept office reception desk');label('РЕСЕПШЕН / 0',-6,2,depth/2- .1,3.5,.65).rotation.y=Math.PI;
 makeLabel('PEREDELKINO / WORK',5.4,1.25,0,3.35,-depth/2+.1);
 sofa(-6,5);table(-5.4,3.5);plant(-9.5,6.8,.6);plant(9.5,6.8,.6);plant(-9.5,-6.8,.6);
 // Meeting room wall has a real 1.8 m opening on its front face.
 const meetingX=6.4,meetingZ=-5.35;
 box(7,.1,5.8,meetingX,.01,meetingZ,mats.wood,'Concept meeting booth timber floor');
 for(const x of [2.8,10]){box(.045,2.8,5.8,x,0,meetingZ,mats.glass,'Concept meeting booth glass side');obstacles.push({type:'segment',a:[x,-8.25],b:[x,-2.45],radius:.03});}
 box(2.55,2.8,.045,4.07,0,-2.45,mats.glass,'Meeting booth front glazing left');box(2.55,2.8,.045,8.73,0,-2.45,mats.glass,'Meeting booth front glazing right');
 obstacles.push({type:'segment',a:[2.8,-2.45],b:[5.35,-2.45],radius:.03},{type:'segment',a:[7.45,-2.45],b:[10,-2.45],radius:.03});
 solid(3.1,.12,1.2,meetingX,.75,meetingZ,mats.wood,'Concept meeting table');
 for(const x of [5.25,6.4,7.55]){chair(x,-6.55,0);chair(x,-4.1,Math.PI);}
 label('ПЕРЕГОВОРНАЯ',meetingX,3.25,-2.36,3,.5);
 for(const z of [-4.9,-1.7]){solid(3,.12,1.15,-6.15,.75,z,mats.wood,'Concept shared coworking table');for(const x of [-7.2,-5.1])chair(x,z+1.05,Math.PI);}
 label('КОВОРКИНГ',-6.1,3,-depth/2+.1,3.4,.6);
 solid(2.7,.65,.85,6,0,4.9,green,'Concept office quiet lounge');table(6.1,3.5,.55);chair(8,3.5,-.5);
 poi.push({id:'reception',name:'Ресепшен офиса',x:-6,z:3,description:'Стойка встречи гостей, зона ожидания, коворкинг и стеклянная переговорная. Это авторский шоурум входного пространства: реальная планировка оператора ещё не подтверждена.',action:'info'});
 poi.push({id:'meeting',name:'Переговорная / 6 мест',x:6.4,z:-1.3,description:'Шесть мест за общим столом. Пройдите через открытый проём в стеклянной перегородке. Кнопка покажет пространство с уровня глаз сидящего человека.',action:'meeting',view:{position:[6.4,1.22,-4.08],target:[6.4,1.4,-8.0]}});
 poi.push({id:'cowork',name:'Коворкинг / рабочее место',x:-6.1,z:.2,description:'Два общих стола и четыре рабочих места. Предложение для общественного офисного лобби, без заявления о будущем составе арендаторов.',action:'cowork',view:{position:[-6.1,1.22,-.68],target:[-6.1,1.4,-4.5]}});
 poi.push({id:'exit',name:'Вход / вернуться на променад',x:0,z:depth/2-1.3,description:'Вернуться к входу снаружи. Внешняя позиция и направление камеры сохраняются.',action:'exit'});
 return{boundary,obstacles,poi,animated,walker:{x:0,z:5},overview:{position:[25,17,24],target:[0,1.8,0]},focus:{x:6.4,z:-.8},metadata:{concept:true,sourceInteriorPlan:false,building:0,kind,meetingSeats:6,coworkSeats:4}};
}

export function addArenaCluster({root,mats,ownedGeometries,box,mesh,makeLabel,radius=15}={}){
 const poi=[],obstacles=[],sides=[];
 const r=Math.max(10,Math.min(24,radius));
 for(const side of [-1,1]){
  const x=side*r*.72,z=-r*.16;
  box(2.6,.12,1.35,x,.72,z,mats.wood,'Cybercluster strategy and caster desk');
  for(const dx of [-.7,.7]){box(.52,.14,.54,x+dx,.37,z+.95,mats.dark,'Cybercluster caster chair');box(.52,.6,.07,x+dx,.47,z+1.2,mats.dark,'Cybercluster chair back');}
  const o=mesh(new T.PlaneGeometry(2.45,1.25),mats.neon,'Cybercluster luminous tactical wall');o.position.set(x,2.08,z-.65);o.rotation.y=-side*.25;sides.push(o);
  makeLabel(side<0?'АНАЛИТИКА / 02':'КОММЕНТАТОРЫ / 02',2.45,.46,x,2.16,z-.59);
  obstacles.push({type:'box',x,z,width:2.6,depth:1.35});
  poi.push({id:side<0?'analysts':'casters',name:side<0?'Штаб команды':'Комментаторская',x,z:z+2,description:side<0?'Место для разбора матчей, тренера и аналитика. У игровых столов — две команды по пять игроков; здесь показана дополнительная авторская функция киберкластера.':'Два места для комментаторов и обозревателей. Экран показывает локальную постановочную графику; реальной трансляции и подключения к турниру здесь нет.',action:'info'});
 }
 poi.push({id:'arena-stage',name:'Режиссёр арены / сцена',x:0,z:0,description:'Выберите «Матч», «Презентация» или «Встреча»: графика главного экрана и сценический свет меняются вместе. Всё работает локально и не имитирует настоящую трансляцию.',action:'arena-control'});
 poi.push({id:'arena-seat',name:'Место зрителя / игрока',x:0,z:r*.48,description:'Посмотрите сцену с места зрителя или с одного из игровых столов. Реконструкция служит шоурумом и не подтверждает будущую расстановку оператора.',action:'arena-view'});
 poi.push({id:'exit',name:'Вход / вернуться к арене',x:0,z:r*.83,description:'Вернуться к входу арены снаружи и продолжить прогулку по променаду.',action:'exit'});
 return{poi,obstacles,sides,metadata:{concept:true,players:10,teams:2,coachPlaces:2,casterPlaces:2,modes:['match','presentation','welcome']}};
}
