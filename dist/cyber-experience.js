import {createQuietLounge} from './lounge-v38.js?v=community38';
import {applyGeometryTree} from './surface-provenance-v38.js?v=community38';
import {createPedestrianNavigation} from './pedestrian-navigation-v38.js?v=community38';
// @r_peredelkino · opt-in authored outdoor layer; original reference landscaping is intact.
import {createCyberCourtyard} from './cyber-courtyard.js?v=community38';
import {createCyberGarden} from './cyber-garden-v35.js?v=community38';
import {createTourWorld} from './walking-tour.js?v=community38';
import {getSolarSnapshot} from './solar-clock.js?v=community38';
export function attachCyberExperience(model){
  if(model.cyberCourtyard)return model.cyberCourtyard;
  const layer=createCyberCourtyard(model.root,{world:createTourWorld(model),courtyardData:model.courtyard.data,enabled:true});
  model.cyberCourtyard=layer;
  const garden=createCyberGarden(model.root,{world:createTourWorld(model),courtyardData:model.courtyard.data,officeTerrace:model.officeTerrace,entrances:layer.interactions});model.cyberGarden=garden;
  const lounge=createQuietLounge(model);model.quietLounge=lounge;model.publicRealm.colliders.push(...lounge.colliders);const loungeRecords=applyGeometryTree(lounge.group,{label:'quiet-lounge',authored:true});
  model.pedestrianNavigation=createPedestrianNavigation(model);model.life.setNavigation(model.pedestrianNavigation);
  const update=model.update.bind(model),dispose=model.dispose.bind(model);let dead=false;
  model.update=seconds=>{update(seconds);layer.update(model.life.time,{night:Math.max(0,Math.min(1,(-getSolarSnapshot().elevation+5)/12)),reactionIndex:model.cyberGameState?.reactionIndex??-1,score:model.cyberGameState?.score??0});lounge.update(model.life.time,{night:Math.max(0,Math.min(1,(-getSolarSnapshot().elevation+5)/12))});garden.update(model.life.time,{night:Math.max(0,Math.min(1,(-getSolarSnapshot().elevation+5)/12)),solar:getSolarSnapshot()});};
  model.dispose=()=>{if(dead)return;dead=true;loungeRecords.dispose();lounge.dispose();garden.dispose();layer.dispose();dispose();};
  return layer;
}
