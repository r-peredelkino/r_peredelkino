// @r_peredelkino · resident amenities, revision 36.
// Render-guided finishes and furnishings; room positions are an authored
// first-floor fit-out, not a measured or approved developer floor plan.
import * as T from './vendor/three.module.js';
import {bakeSceneAuthorship,embedPixelSignature} from './baked-authorship.js?v=community38';
import {createAttributionTexture} from './attribution.js?v=community38';

const MODEL_ID='RP-CONCEPT-2026-10-07';
const rect=(xmin,xmax,zmin,zmax)=>({xmin,xmax,zmin,zmax,outer:[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]]});
const FALLBACK={yoga:rect(-11,-1.7,-22,-15),kids:rect(-11,-1.7,-15,-8),coffee:rect(-11,-1.7,-8,-2),lounge:rect(1.7,11,-8,-2)};
const Y_AXIS=new T.Vector3(0,1,0);
function roundedShape(w,d,r){
 const x=-w/2,z=-d/2,s=new T.Shape();r=Math.min(r,w/2,d/2);
 s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);s.lineTo(x+w,z+d-r);s.quadraticCurveTo(x+w,z+d,x+w-r,z+d);s.lineTo(x+r,z+d);s.quadraticCurveTo(x,z+d,x,z+d-r);s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);return s;
}
function mergedGeometry(source){
 const gs=source.map(g=>g.index?g.toNonIndexed():g),geo=new T.BufferGeometry();
 for(const [name,size]of [['position',3],['normal',3],['uv',2]]){const bytes=new Float32Array(gs.reduce((n,g)=>n+g.attributes[name].array.length,0));let at=0;for(const g of gs){bytes.set(g.attributes[name].array,at);at+=g.attributes[name].array.length;}geo.setAttribute(name,new T.BufferAttribute(bytes,size));}
 for(let i=0;i<gs.length;i++){if(gs[i]!==source[i])gs[i].dispose();source[i].dispose();}geo.computeBoundingBox();geo.computeBoundingSphere();return geo;
}

export function createResidentClub({root=null,layout=null,ownedGeometries:externalG=null,ownedMaterials:externalM=null,ownedTextures:externalT=null,makeLabel=null}={}){
 const group=new T.Group();group.name='Resident club · first-floor render-guided amenities';group.position.y=layout?.floorY??0;root?.add(group);
 const geos=new Set(),materials=new Set(),textures=new Set(),obstacles=[],pois=[],fittings=[],solids=[],labels=[],zones=layout?.zones||FALLBACK,dummy=new T.Object3D();let dead=false,clock=0;
 const ownG=g=>{geos.add(g);externalG?.add(g);return g;},ownM=m=>{materials.add(m);externalM?.add(m);return m;},ownT=t=>{textures.add(t);externalT?.add(t);return t;};
 function texture(kind){
  const size=256,bytes=new Uint8Array(size*size*4);let seed=360917;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296,grain=kind==='navy'?Math.sin(x*.20+Math.sin(y*.035)*7+Math.sin(y*.075)*2)*11+Math.sin(x*.057+y*.025)*6:kind==='wood'?Math.sin(x*.22+Math.sin(y*.019)*4)*6+Math.sin(x*.063)*4:kind==='linen'?((x+y)%3===0?-2:0)+noise*3:noise*3;const tone=Math.max(0,Math.min(255,Math.round(237+grain+noise*3)));bytes.set([tone,tone,tone,255],(y*size+x)*4);}
  embedPixelSignature(bytes,{label:'resident-club-v36/'+kind});const map=ownT(new T.DataTexture(bytes,size,size,T.RGBAFormat));map.name='Authored resident-club '+kind+' finish';map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(kind==='linen'||kind==='mineral'?2:1,kind==='linen'||kind==='mineral'?2:1);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=4;map.userData.attribution={handle:'@r_peredelkino',modelId:MODEL_ID};map.needsUpdate=true;return map;
 }
 const grain=texture('navy'),woodMap=texture('wood'),fabric=texture('linen'),stone=texture('mineral');
 const mat=(name,color,roughness=.8,metalness=0,map=null)=>{const m=ownM(new T.MeshStandardMaterial({color,roughness,metalness,map}));m.name=name;return m;};
 const m={cream:mat('Warm cream textured upholstery',0xe9dfc9,.95,0,fabric),navy:mat('Cobalt navy wave-grain cabinetry',0x1d2858,.72,0,grain),wood:mat('Warm natural wood',0xba8953,.86,0,woodMap),tan:mat('Tan training and play foam',0xbc8d55,.98,0,fabric),olive:mat('Olive soft-play seating',0x777650,.94,0,fabric),blue:mat('Navy blue organic play carpet',0x234369,.98,0,fabric),black:mat('Charcoal fixture coating',0x172027,.61,.18),silver:mat('Brushed stainless furniture',0xc1c8cb,.27,.82,stone),mirror:mat('Satin mirror finish approximation',0xd2dbdc,.13,.96,stone),amber:mat('Warm amber authored wall animals',0xca9b4e,.87),coral:mat('Rust red authored wall animals',0xa35237,.88),brown:mat('Cognac stool upholstery',0x80634c,.92,0,fabric),darkWood:mat('Dark wood coffee-table top',0x625745,.58,0,woodMap)};
 m.warm=mat('Warm globe and strip light',0xffefcc,.37);m.warm.emissive.set(0xffd394);m.warm.emissiveIntensity=.85;
 m.loungeWarm=ownM(m.warm.clone());m.loungeWarm.name='Independently controlled warm lounge light';
 m.cobaltLight=mat('Cobalt coffee alcove backlighting',0x6575d1,.45);m.cobaltLight.emissive.set(0x4862df);m.cobaltLight.emissiveIntensity=.7;
 m.violetLight=mat('Violet coffee counter backlighting',0x8a75db,.6);m.violetLight.emissive.set(0x7860c9);m.violetLight.emissiveIntensity=.6;
 m.tv=ownM(new T.MeshBasicMaterial({color:0x182734,toneMapped:false}));m.tv.name='Quiet training-room television';
 m.steam=ownM(new T.MeshStandardMaterial({color:0xfff7ee,transparent:true,opacity:.20,depthWrite:false,roughness:1}));m.steam.name='Local animated drink steam';
 m.drink=mat('Selected demonstration beverage',0x4d2c16,.36);m.glass=ownM(new T.MeshStandardMaterial({color:0xcbdad9,transparent:true,opacity:.12,depthWrite:false,roughness:.11,side:T.DoubleSide}));
 const yogaMat=mat('Guided training luminous floor rim',0xa9b7a3,.68);yogaMat.emissive.set(0xa2c3aa);yogaMat.emissiveIntensity=.08;
 const tileMaterials=[0x547ac0,0xc2995b,0x9b6fbd,0x5e9e95].map((c,i)=>{const a=mat('Memory game tile '+(i+1),c,.58);a.emissive.set(c);a.emissiveIntensity=.035;return a;});
 function mesh(g,material,name,zone,parent=group,dynamic=false){const o=new T.Mesh(ownG(g),material);o.name=name;o.castShadow=o.receiveShadow=true;o.userData={clubStatic:!dynamic,zone,concept:true};parent.add(o);return o;}
 function box(w,h,d,x,y,z,material,name,zone,dynamic=false){const o=mesh(new T.BoxGeometry(w,h,d),material,name,zone,group,dynamic);o.position.set(x,y+h/2,z);return o;}
 function round(w,h,d,r,x,y,z,material,name,zone,dynamic=false){const g=new T.ExtrudeGeometry(roundedShape(w,d,r),{depth:h,bevelEnabled:false,curveSegments:8});g.rotateX(-Math.PI/2);const o=mesh(g,material,name,zone,group,dynamic);o.position.set(x,y,z);return o;}
 function cylinder(r,h,x,y,z,material,name,zone,r2=r,dynamic=false){const o=mesh(new T.CylinderGeometry(r,r2,h,20),material,name,zone,group,dynamic);o.position.set(x,y+h/2,z);return o;}
 function tube(a,b,r,material,name,zone){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=mesh(new T.CylinderGeometry(r,r,av.distanceTo(bv),8),material,name,zone);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(Y_AXIS,bv.sub(av).normalize());return o;}
 function rectObstacle(id,x,z,width,depth,zone){obstacles.push({type:'box',id,x,z,width,depth,angle:0,source:'resident-club-v36',enabled:true,zone});fittings.push({id,x,z,width,depth,zone});}
 function circleObstacle(id,x,z,radius,zone){obstacles.push({type:'circle',id,x,z,radius,source:'resident-club-v36',enabled:true,zone});fittings.push({id,x,z,width:radius*2,depth:radius*2,zone});}
 function poi(id,name,x,z,action,description,extra={}){const p={id,name,x,z,point:[x,z],action,description,authoredConcept:true,...extra};pois.push(p);return p;}
 function label(text,w,h,x,y,z,yaw=0){if(!makeLabel)return;const o=makeLabel(text,w,h,x,y+group.position.y,z);group.add(o);o.position.set(x,y,z);o.rotation.y=yaw;o.userData.clubStatic=false;o.userData.clubLabel=true;labels.push(o);if(o.geometry)ownG(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material]){ownM(material);for(const slot of ['map','emissiveMap'])if(material?.[slot])ownT(material[slot]);}}

 // Compact individual-training room: television, mirrors and movable mats,
 // following brochure p40. No machines or medical workout prescription.
 const yogaMats=[];
 for(const x of [-9,-6.3,-3.6])for(const z of [-20.2,-17.1]){
  round(.85,.014,1.94,.08,x,.018,z,m.tan,'Tan movable yoga mat','yoga');yogaMats.push({x,z});
  const roll=mesh(new T.CylinderGeometry(.12,.12,.66,16),m.tan,'Rolled training bolster','yoga');roll.rotation.z=Math.PI/2;roll.position.set(x,.135,z-.61);
  box(.16,.10,.22,x+.29,.02,z+.68,m.wood,'Small cork training block','yoga');
 }
 const yogaLights=new T.InstancedMesh(ownG(new T.BoxGeometry(.87,.012,.035)),yogaMat,yogaMats.length);yogaLights.name='Guided three-phase yoga floor-light pulses';yogaLights.userData={dynamic:true,zone:'yoga'};yogaMats.forEach((p,i)=>{dummy.position.set(p.x,.035,p.z+.95);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();yogaLights.setMatrixAt(i,dummy.matrix);});yogaLights.instanceMatrix.needsUpdate=true;group.add(yogaLights);
 const mirror=box(8.26,2.45,.027,-6.3,.18,-21.78,m.mirror,'Wide training satin mirror · no render target','yoga');
 for(let i=0;i<5;i++)box(.018,2.45,.036,-10.2+i*1.96,.18,-21.75,m.wood,'Fine mirror section','yoga');
 box(2.9,1.62,.05,-6.3,1.15,-15.23,m.black,'Individual-training television surround','yoga');box(2.72,1.43,.017,-6.3,1.245,-15.269,m.tv,'Large television in individual-training room','yoga');
 for(let i=0;i<6;i++)box(.07,.10+.035*i,.028,-7.25+i*.37,1.85,-15.282,m.cobaltLight,'Authored training-screen quiet waveform','yoga');
 label('ИНДИВИДУАЛЬНЫЕ ТРЕНИРОВКИ',2.7,.29,-6.3,2.95,-15.28,Math.PI);
 for(const z of [-20.2,-16.8]){box(.32,2.45,.085,-10.64,.14,z,m.wood,'Timber training support upright','yoga');for(let i=0;i<6;i++)box(.55,.05,.035,-10.50,.45+i*.27,z,m.cream,'Training support soft strap','yoga');}
 poi('resident-yoga','Индивидуальные тренировки · 1 этаж',-3,-18.55,'amenity-yoga','Комната по рендеру YOGA_FIN и буклету: большое окно, зеркальная отделка, коврики и телевизор. Локальная демонстрация света: вдох, пауза, выдох, 60 секунд; программу физических упражнений не назначает.',{lookAt:[-6.3,-20.2],room:'yoga'});

 // Children's room: reach it through the coffee/coworking room only.
 const carpetShape=new T.Shape();carpetShape.moveTo(-3.0,-1.5);carpetShape.bezierCurveTo(-1.9,-2.2,1.1,-2.2,2.3,-1.25);carpetShape.bezierCurveTo(3.0,-.3,2.65,1.65,.8,1.8);carpetShape.bezierCurveTo(-1.3,2.4,-3.1,1.5,-3.0,-1.5);const carpetGeo=new T.ShapeGeometry(carpetShape,20);carpetGeo.rotateX(-Math.PI/2);const carpet=mesh(carpetGeo,m.blue,'Organic navy soft-play carpet','kids');carpet.position.set(-6.1,.028,-11.25);
 round(6.1,.35,.8,.22,-6.12,.03,-14.3,m.cream,'Low cream stepped play seating','kids');round(5.8,.17,.74,.22,-6.12,.38,-14.3,m.olive,'Olive cushioned play seating','kids');rectObstacle('kids-back-bench',-6.12,-14.3,6.1,.8,'kids');
 round(.78,.35,3.7,.21,-2.28,.03,-12.05,m.cream,'Side low play seating','kids');round(.72,.17,3.48,.20,-2.28,.38,-12.05,m.olive,'Side olive play cushion','kids');rectObstacle('kids-side-bench',-2.28,-12.05,.78,3.7,'kids');
 round(1.6,.31,.94,.36,-6.2,.03,-11.6,m.blue,'Rounded navy foam stepping seat','kids');rectObstacle('kids-centre-seat',-6.2,-11.6,1.6,.94,'kids');
 round(.95,.52,.95,.16,-9.1,.02,-9.35,m.blue,'Rounded blue foam block','kids');rectObstacle('kids-soft-block',-9.1,-9.35,.95,.95,'kids');
 box(.08,2.54,4.85,-10.76,.16,-11.55,m.wood,'Warm timber indoor climbing panel','kids');rectObstacle('kids-climbing-panel',-10.76,-11.55,.08,4.85,'kids');
 const holds=new T.InstancedMesh(ownG(new T.DodecahedronGeometry(.085)),m.blue,40);holds.name='Forty authored blue climbing holds';holds.userData={zone:'kids'};for(let i=0;i<40;i++){dummy.position.set(-10.67,.43+Math.floor(i/8)*.42,-13.60+(i%8)*.56);dummy.rotation.set(i*.27,i*.61,i*.18);dummy.scale.set(1.1,.84,.82);dummy.updateMatrix();holds.setMatrixAt(i,dummy.matrix);holds.setColorAt(i,new T.Color(i%3===0?0x82afbe:0x397eaf));}holds.instanceMatrix.needsUpdate=true;group.add(holds);
 // Three independent authored silhouettes: a cat, bird and long-neck animal.
 // Their shapes and markings are code-native artwork, not copied render pixels.
 const animalArt=new T.Group();animalArt.name='Original code-native animal silhouettes · render-inspired';animalArt.userData.zone='kids';group.add(animalArt);
 function silhouette(points,x,y,scale,material,name){const s=new T.Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();const o=new T.Mesh(ownG(new T.ShapeGeometry(s)),material);o.name=name;o.position.set(x,y,-14.78);o.scale.setScalar(scale);o.userData={clubStatic:true,zone:'kids'};animalArt.add(o);return o;}
 silhouette([[0,0],[.25,0],[.35,.65],[.58,.75],[.78,.63],[.91,.0],[1.12,.0],[1.08,.69],[1.27,.80],[1.48,1.03],[1.55,1.33],[1.43,1.61],[1.33,1.47],[1.15,1.52],[1.03,1.65],[.91,1.38],[.83,1.08],[.44,.93],[.20,1.04],[-.1,1.21],[-.28,1.10],[-.25,.90],[.03,.72]],-8.7,.75,1.04,m.amber,'Authored amber meadow cat');
 silhouette([[0,0],[.2,0],[.27,.52],[.56,.36],[.94,.54],[1.06,.88],[.94,1.13],[.66,1.27],[.82,1.54],[.72,1.72],[.52,1.49],[.42,1.53],[.25,1.19],[.04,1.0],[-.15,.70],[-.04,.47],[.04,.42]],-5.45,.8,.92,m.coral,'Authored red woodland bird');
 silhouette([[0,0],[.16,0],[.2,.54],[.57,.55],[.7,0],[.87,0],[.75,.69],[.85,1.12],[.82,1.63],[1.02,1.72],[1.0,1.88],[.74,1.94],[.65,1.86],[.57,1.85],[.58,1.63],[.53,.99],[.12,.79],[-.09,.86],[-.17,.68]],-3.87,.75,1.05,m.navy,'Authored navy long-neck woodland animal');
 for(let i=0;i<16;i++){const spot=mesh(new T.CircleGeometry(.029+(i%3)*.004,7),m.black,'Cat silhouette original marking','kids');spot.position.set(-8.29+(i%4)*.24,1.44+Math.floor(i/4)*.14,-14.768);}
 for(let i=0;i<4;i++){const x=-8.80+i*.28;round(.23,.11,.12,.027,x,.04,-11.46,m.wood,'Small wooden play-train carriage','kids');for(const dx of [-.08,.08])for(const z of [-11.53,-11.39]){const wheel=mesh(new T.CylinderGeometry(.033,.033,.018,10),m.wood,'Wooden play-train wheel','kids');wheel.rotation.x=Math.PI/2;wheel.position.set(x+dx,.055,z);}if(i===0){cylinder(.043,.085,x-.05,.15,-11.46,m.wood,'Wooden play-train chimney','kids');box(.09,.10,.13,x+.064,.15,-11.46,m.wood,'Wooden play-train cab','kids');}}
 const globes=new T.InstancedMesh(ownG(new T.SphereGeometry(1,16,10)),m.warm,23);globes.name='Twenty-three warm spherical play-room pendant lights';globes.userData={zone:'kids'};
 for(let i=0;i<23;i++){const row=Math.floor(i/6),x=-10.1+(i%6)*1.43,z=-13.90+row*1.55,r=.13+(i%5)*.033,y=2.55+(i%4)*.10;dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(r);dummy.updateMatrix();globes.setMatrixAt(i,dummy.matrix);tube([x,y+r,z],[x,3.26,z],.007,m.black,'Fine globe pendant wire','kids');}globes.instanceMatrix.needsUpdate=true;group.add(globes);
 const kidsTiles=[];box(1.64,.72,.32,-3.57,.02,-9.32,m.wood,'Colour memory game low console','kids');rectObstacle('kids-memory-console',-3.57,-9.32,1.64,.32,'kids');
 for(let i=0;i<4;i++){const tile=round(.30,.04,.21,.065,-4.16+i*.40,.76,-9.32,tileMaterials[i],'Memory game colour tile '+i,'kids',true);kidsTiles.push(tile);}
 poi('resident-kids','Игровая · через кофе и коворкинг',-4.70,-9.35,'amenity-kids','Детская комната с мягкой мебелью, световыми шарами, скалодромом и авторскими животными. Вход организован через кофе и коворкинг. Запомните показанную последовательность четырёх цветов и повторите её.',{room:'kids',lookAt:[-3.57,-9.32],sourceEntryRule:'coffee-only'});

 // Coffee/coworking: cobalt cabinetry, three stools, black faucet and an
 // original arched pendant. This is a demonstrator, with no paid ordering.
 box(7.55,2.87,.19,-6.34,.12,-2.24,m.navy,'Cobalt coffee and coworking cabinet wall','coffee');
 box(6.85,.88,.54,-6.36,.06,-2.65,m.navy,'Coffee base cabinetry','coffee');box(6.97,.035,.63,-6.36,.935,-2.71,m.black,'Coffee preparation worktop','coffee');
 box(6.82,1.16,.025,-6.36,1.06,-2.365,m.cobaltLight,'Cobalt luminous coffee backsplash','coffee');
 box(6.92,.06,.72,-6.36,2.22,-2.65,m.navy,'Cobalt upper cabinet cornice','coffee');
 for(let i=0;i<8;i++)box(.012,2.72,.023,-9.7+i*.96,.16,-2.35,m.black,'Fine cobalt cabinet reveal','coffee');
 round(5.35,1.04,.58,.05,-6.25,.04,-4.54,m.navy,'Coffee bar counter · three-stool frontage','coffee');box(5.45,.055,.66,-6.25,1.08,-4.54,m.black,'Coffee island dark countertop','coffee');box(5.10,.85,.025,-6.25,.18,-4.85,m.violetLight,'Violet backlit coffee island front','coffee');rectObstacle('coffee-bar',-6.25,-4.54,5.45,.66,'coffee');
 const stoolPositions=[-8.0,-6.35,-4.7];for(const [i,x]of stoolPositions.entries()){cylinder(.27,.11,x,.82,-5.6,m.brown,'Brown upholstered bar stool','coffee');for(const dx of [-.17,.17])for(const dz of [-.16,.16])tube([x+dx,.04,-5.6+dz],[x+dx*.78,.85,-5.6+dz*.78],.018,m.silver,'Fine chrome stool leg','coffee');tube([x-.2,.28,-5.76],[x+.2,.28,-5.76],.012,m.silver,'Stool chrome footrest','coffee');circleObstacle('coffee-stool-'+i,x,-5.6,.28,'coffee');}
 box(.72,.48,.36,-4.09,.975,-2.75,m.silver,'Espresso machine stainless housing','coffee');box(.61,.22,.03,-4.09,1.18,-2.94,m.black,'Espresso machine control face','coffee');for(const x of [-4.28,-3.93]){tube([x,1.26,-2.97],[x,1.23,-3.12],.015,m.black,'Espresso portafilter handle','coffee');cylinder(.025,.11,x,1.10,-2.95,m.silver,'Espresso group nozzle','coffee');}
 box(.79,.018,.40,-4.09,.972,-2.75,m.black,'Espresso drip tray','coffee');
 const sink=box(.66,.018,.34,-7.55,.957,-2.7,m.black,'Coffee preparation sink','coffee');const faucetCurve=new T.CatmullRomCurve3([new T.Vector3(-7.65,.98,-2.50),new T.Vector3(-7.65,1.43,-2.50),new T.Vector3(-7.40,1.50,-2.50),new T.Vector3(-7.34,1.32,-2.50)]);mesh(new T.TubeGeometry(faucetCurve,18,.017,8),m.black,'Black arched coffee faucet','coffee');
 const archPoints=[new T.Vector3(-8.7,2.51,-4.5),new T.Vector3(-8.7,2.93,-4.5),new T.Vector3(-8.05,3.05,-4.5),new T.Vector3(-7.96,2.64,-4.5),new T.Vector3(-7.96,2.51,-4.5),new T.Vector3(-7.93,2.92,-4.5),new T.Vector3(-7.21,3.05,-4.5),new T.Vector3(-7.13,2.64,-4.5),new T.Vector3(-7.13,2.51,-4.5),new T.Vector3(-7.10,2.92,-4.5),new T.Vector3(-6.38,3.05,-4.5),new T.Vector3(-6.30,2.64,-4.5),new T.Vector3(-6.30,2.51,-4.5)];mesh(new T.TubeGeometry(new T.CatmullRomCurve3(archPoints),80,.046,10),m.navy,'Original cobalt three-arch pendant','coffee');for(const x of [-8.55,-6.45])tube([x,2.94,-4.5],[x,3.26,-4.5],.008,m.black,'Pendant suspension wire','coffee');
 const cupX=-3.90,cupZ=-4.52;cylinder(.093,.125,cupX,1.14,cupZ,m.cream,'Interactive ceramic beverage cup','coffee',.078);cylinder(.135,.012,cupX,1.13,cupZ,m.cream,'Ceramic beverage saucer','coffee');const handle=mesh(new T.TorusGeometry(.046,.013,8,14),m.cream,'Ceramic cup rounded handle','coffee');handle.position.set(cupX+.093,1.204,cupZ);handle.rotation.y=Math.PI/2;
 const coffeeLiquid=cylinder(.079,.008,cupX,1.26,cupZ,m.drink,'Actual selected beverage surface','coffee',.079,true);
 const coffeeSteam=new T.InstancedMesh(ownG(new T.SphereGeometry(1,10,6)),m.steam,9);coffeeSteam.name='Nine animated coffee steam curls';coffeeSteam.visible=false;coffeeSteam.userData={dynamic:true,zone:'coffee'};for(let i=0;i<9;i++){dummy.position.set(cupX,1.29+i*.04,cupZ);dummy.rotation.set(0,0,0);dummy.scale.set(.014,.023,.014);dummy.updateMatrix();coffeeSteam.setMatrixAt(i,dummy.matrix);}coffeeSteam.instanceMatrix.needsUpdate=true;group.add(coffeeSteam);
 for(const x of [-9.02,-8.76]){cylinder(.043,.135,x,.975,-2.8,m.glass,'Clear coffee water glass','coffee',.037);}
 label('КОФЕ / КОВОРКИНГ',2.7,.31,-6.5,2.70,-2.35,Math.PI);
 poi('resident-coffee','Кофе и коворкинг · 1 этаж',-3.45,-5.75,'amenity-coffee','Кобальтовая кухня по KITCHEN_9: три барных места, кофемашина и локальная демонстрация напитка. Выберите эспрессо, латте или чай: меняются поверхность чашки и пар. Дверь в детскую находится внутри этой комнаты.',{room:'coffee',lookAt:[cupX,cupZ],beverages:['espresso','latte','tea']});

 // Blue-grain lounge with curved cream sofa, brushed metal coffee tables
 // and three warm vertical fixtures; all are modelled furniture.
 box(8.2,2.9,.037,6.3,.12,-2.21,m.navy,'Navy wave-grain lounge feature wall','lounge');
 const sofaSegments=[];for(let i=0;i<11;i++){const a=Math.PI*.12+i/10*Math.PI*.72,x=6.3+Math.cos(a)*3.04,z=-3.84+Math.sin(a)*.54,sofa=round(.83,.38,.88,.23,x,.09,z,m.cream,'Curved cream lounge sofa seat','lounge');sofa.rotation.y=-a*.18+.25;const back=round(.83,.66,.24,.12,x,.37,z+.28,m.cream,'Curved cream lounge sofa back','lounge');back.rotation.y=sofa.rotation.y;sofaSegments.push({x,z});circleObstacle('lounge-sofa-'+i,x,z,.47,'lounge');}
 // Chrome cylindrical table base with a broad thin oval dark-metal top.
 for(const [i,x]of [5.4,6.35,7.30].entries())cylinder(.20,.43,x,.04,-5.5,m.silver,'Metal lounge table cylindrical leg','lounge');const table=cylinder(1.38,.045,6.35,.47,-5.5,m.silver,'Oval stainless lounge coffee table','lounge');table.scale.z=.53;rectObstacle('lounge-coffee-table',6.35,-5.5,2.78,1.47,'lounge');
 box(.32,.008,.25,6.35,.52,-5.5,m.cream,'Magazine on lounge coffee table','lounge');
 round(1.0,.37,.88,.16,2.80,.08,-6.50,m.brown,'Cognac lounge armchair cushion','lounge');round(1.0,.58,.17,.09,2.80,.32,-6.85,m.brown,'Cognac lounge armchair back','lounge');for(const x of [2.30,3.30])round(.12,.53,.83,.055,x,.08,-6.5,m.brown,'Lounge armchair soft armrest','lounge');rectObstacle('lounge-armchair',2.8,-6.5,1.15,.95,'lounge');
 const loungeLights=new T.InstancedMesh(ownG(new T.CapsuleGeometry(.038,1.75,5,12)),m.loungeWarm,3);loungeLights.name='Three warm vertical lounge light fixtures';loungeLights.userData={dynamic:true,zone:'lounge'};for(let i=0;i<3;i++){dummy.position.set(3.7+i*2.65,1.94,-2.30);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();loungeLights.setMatrixAt(i,dummy.matrix);cylinder(.06,1.85,3.7+i*2.65,1.01,-2.27,m.silver,'Lounge sconce brushed end caps','lounge');}loungeLights.instanceMatrix.needsUpdate=true;group.add(loungeLights);
 for(let i=0;i<7;i++){const panel=box(.28,1.53+.18*Math.sin(i*.8),.035,9.32+(i%3)*.37,.32,-3.25-Math.floor(i/3)*.055,m.silver,'Authored chrome wave screen','lounge');panel.rotation.y=Math.sin(i*.8)*.2;}
 poi('resident-lounge-seat','Лаунж · сесть и осмотреть',4.22,-6.10,'amenity-seat','Кремовый изогнутый диван, синий древесный рисунок и металлические столики по LOUNGE_FIN_3. Локальная посадка с сохранением точки возврата.',{room:'lounge',seatPoint:[5.10,-3.45],seatHeight:(layout?.floorY??0)+.49,lookAt:[6.35,-5.5]});
 poi('resident-lounge-light','Лаунж · тёплый / приглушённый свет',8.55,-6.18,'amenity-light','Переключите три вертикальных светильника и подсветку кофейной ниши. Сценическое освещение не подключено к реальной системе дома.',{room:'lounge',lookAt:[6.3,-2.3]});

 // Batched static furnishing, retaining independent dynamic controls and
 // original semantic names in metadata. Each batch is confined to one room.
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),semanticParts=[];
 group.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.userData.clubStatic||o.material.transparent)return;const key=o.userData.zone+'|'+o.material.uuid,list=batches.get(key)||[];list.push(o);batches.set(key,list);semanticParts.push({name:o.name,zone:o.userData.zone});});
 for(const list of batches.values()){const first=list[0],parts=list.map(o=>o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld))),geo=ownG(mergedGeometry(parts)),batch=new T.Mesh(geo,first.material);batch.name='Resident club '+first.userData.zone+' · batched '+first.material.name;batch.userData={zone:first.userData.zone,clubBatch:true,partNames:list.map(o=>o.name)};batch.castShadow=batch.receiveShadow=true;group.add(batch);for(const o of list){o.removeFromParent();geos.delete(o.geometry);externalG?.delete(o.geometry);o.geometry.dispose();}}
 const mask=ownT(createAttributionTexture());if(mask.image?.data)embedPixelSignature(mask.image.data,{label:'resident-club-v36/ownership-mask'});const authored=bakeSceneAuthorship(group,{mask,label:'resident-club-v36'});for(const map of authored.textures)ownT(map);
 const states={yoga:{running:false,elapsed:0,duration:60,phase:'готовность'},kids:{mode:'idle',sequence:[0,2,1,3],round:1,index:0,score:0,activeTile:-1,elapsed:0},coffee:{beverage:'espresso',brewing:false,elapsed:0},lounge:{lighting:'warm',seated:false}};
 let yogaStart=0,kidsStart=0,coffeeStart=0,kidsFlashUntil=0;
 function setAction(id,value){if(dead)return false;
  if(id==='amenity-yoga'){if(value==='start'||value===true){states.yoga.running=true;states.yoga.elapsed=0;states.yoga.phase='вдох';yogaStart=clock;}else if(value==='stop'||value===false){states.yoga.running=false;states.yoga.phase='готовность';yogaMat.emissiveIntensity=.08;}else return false;return true;}
  if(id==='amenity-kids'){
   if(value==='start'){states.kids.mode='preview';states.kids.index=0;states.kids.elapsed=0;states.kids.activeTile=states.kids.sequence[0];kidsStart=clock;return true;}
   if(value==='stop'){states.kids.mode='idle';states.kids.activeTile=-1;states.kids.index=0;for(const a of tileMaterials)a.emissiveIntensity=.035;return true;}
   const n=Number(value);if(!Number.isInteger(n)||n<0||n>3||states.kids.mode!=='input')return false;
   states.kids.activeTile=n;kidsFlashUntil=clock+.28;
   if(n!==states.kids.sequence[states.kids.index]){states.kids.mode='preview';states.kids.index=0;kidsStart=clock+.55;return true;}
   states.kids.index++;if(states.kids.index===states.kids.sequence.length){states.kids.score+=states.kids.sequence.length;states.kids.mode='complete';states.kids.round++;}return true;
  }
  if(id==='amenity-coffee'){if(value==='stop'){states.coffee.brewing=false;coffeeSteam.visible=false;return true;}if(!['espresso','latte','tea'].includes(value))return false;states.coffee.beverage=value;states.coffee.brewing=true;states.coffee.elapsed=0;coffeeStart=clock;coffeeLiquid.material.color.set({espresso:0x4d2c16,latte:0xc9aa7e,tea:0x8b6531}[value]);coffeeSteam.visible=true;return true;}
  if(id==='amenity-light'){if(!['warm','quiet'].includes(value))return false;states.lounge.lighting=value;m.loungeWarm.emissiveIntensity=value==='quiet'?.20:.85;m.cobaltLight.emissiveIntensity=value==='quiet'?.22:.7;m.violetLight.emissiveIntensity=value==='quiet'?.16:.6;return true;}
  if(id==='amenity-seat'){states.lounge.seated=!!value;return true;}return false;
 }
 function update(seconds){if(dead)return;clock=Number.isFinite(+seconds)?+seconds:clock;
  if(states.yoga.running){states.yoga.elapsed=Math.max(0,clock-yogaStart);if(states.yoga.elapsed>=states.yoga.duration){states.yoga.running=false;states.yoga.elapsed=states.yoga.duration;states.yoga.phase='завершено';yogaMat.emissiveIntensity=.08;}else{const phase=states.yoga.elapsed%10;states.yoga.phase=phase<4?'вдох':phase<6?'пауза':'выдох';const pulse=phase<4?phase/4:phase<6?1:1-(phase-6)/4;yogaMat.emissiveIntensity=.08+pulse*.95;for(let i=0;i<yogaMats.length;i++){dummy.position.set(yogaMats[i].x,.035,yogaMats[i].z+.95);dummy.rotation.set(0,0,0);dummy.scale.set(1+pulse*.035,1,1);dummy.updateMatrix();yogaLights.setMatrixAt(i,dummy.matrix);}yogaLights.instanceMatrix.needsUpdate=true;}}
  if(states.kids.mode==='preview'){states.kids.elapsed=Math.max(0,clock-kidsStart);const i=Math.floor(states.kids.elapsed/.8);if(i>=states.kids.sequence.length){states.kids.mode='input';states.kids.activeTile=-1;states.kids.index=0;}else states.kids.activeTile=(states.kids.elapsed%.8)<.52?states.kids.sequence[i]:-1;}
  else if(states.kids.mode==='input'&&clock>=kidsFlashUntil)states.kids.activeTile=-1;
  for(let i=0;i<kidsTiles.length;i++){const selected=states.kids.activeTile===i||states.kids.mode==='complete';tileMaterials[i].emissiveIntensity=selected?.95:.035;kidsTiles[i].position.y=.76+(selected?.012:0);}
  if(states.coffee.brewing){states.coffee.elapsed=Math.max(0,clock-coffeeStart);if(states.coffee.elapsed>9){states.coffee.brewing=false;coffeeSteam.visible=false;}else{for(let i=0;i<9;i++){const p=((states.coffee.elapsed*.45+i*.17)%1),wave=states.coffee.elapsed*1.25+i;dummy.position.set(cupX+Math.sin(wave)*.029,1.29+p*.43,cupZ+Math.cos(wave*.8)*.025);dummy.rotation.set(0,0,0);const r=.012+p*.022;dummy.scale.set(r,r*1.6,r);dummy.updateMatrix();coffeeSteam.setMatrixAt(i,dummy.matrix);}coffeeSteam.instanceMatrix.needsUpdate=true;m.steam.opacity=.17+Math.sin(states.coffee.elapsed*.9)*.025;}}
 }
 const metadata={revision:36,authoredConcept:true,floor:1,operatorConfirmed:false,metricDeveloperPlan:false,sourceRenderNames:['YOGA_FIN.jpg','KIDS.jpg','KITCHEN_9.jpg','LOUNGE_FIN_3.jpg'],zones,roomCount:4,kidsEntryRule:'coffee-only',topologySource:'Official brochure page41: children enter exclusively through coffee/coworking',trainingSource:'Official brochure page40: individual-training room with large TV and no machines',trainingMachines:0,trainingMats:yogaMats.length,climbingHolds:holds.count,pendantGlobes:globes.count,coffeeStools:stoolPositions.length,originalArtwork:true,artwork:'Three code-native woodland silhouettes, individually authored shapes',mirrors:'Satin metal visual approximation; no live reflection render target',furnishingFittings:fittings,semanticParts,interactions:pois.map(p=>({id:p.id,action:p.action,room:p.room,point:p.point})),authorship:authored.stats};
 group.userData.concept=metadata;group.userData.attribution={handle:'@r_peredelkino',modelId:MODEL_ID};
 function dispose(){if(dead)return;dead=true;group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});for(const g of geos){g.dispose();externalG?.delete(g);}for(const a of materials){a.dispose();externalM?.delete(a);}for(const t of textures){t.dispose();externalT?.delete(t);}for(const o of obstacles)o.enabled=false;group.removeFromParent();}
 return{group,obstacles,solids,poi:pois,pois,metadata,states,setAction,update,dispose,visuals:{yogaLights,kidsTiles,coffeeSteam,coffeeLiquid,loungeLights,climbingHolds:holds,pendantGlobes:globes},get stats(){let meshes=0,triangles=0;group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});return{meshes,triangles,geometries:geos.size,materials:materials.size,textures:textures.size};}};
}
