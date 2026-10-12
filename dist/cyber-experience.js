// @r_peredelkino · opt-in authored outdoor layer; original reference landscaping is intact.
import {createCyberCourtyard} from './cyber-courtyard.js?v=references37';
import {createCyberGarden} from './cyber-garden-v35.js?v=references37';
import {createTourWorld} from './walking-tour.js?v=references37';
import {getSolarSnapshot} from './solar-clock.js?v=references37';
export function attachCyberExperience(model){
  if(model.cyberCourtyard)return model.cyberCourtyard;
  const layer=createCyberCourtyard(model.root,{world:createTourWorld(model),courtyardData:model.courtyard.data,enabled:true});
  model.cyberCourtyard=layer;
  const garden=createCyberGarden(model.root,{world:createTourWorld(model),courtyardData:model.courtyard.data,officeTerrace:model.officeTerrace,entrances:layer.interactions});model.cyberGarden=garden;
  const update=model.update.bind(model),dispose=model.dispose.bind(model);let dead=false;
  model.update=seconds=>{update(seconds);layer.update(seconds,{night:Math.max(0,Math.min(1,(-getSolarSnapshot().elevation+5)/12)),reactionIndex:model.cyberGameState?.reactionIndex??-1,score:model.cyberGameState?.score??0});garden.update(seconds,{night:Math.max(0,Math.min(1,(-getSolarSnapshot().elevation+5)/12)),solar:getSolarSnapshot()});};
  model.dispose=()=>{if(dead)return;dead=true;garden.dispose();layer.dispose();dispose();};
  return layer;
}
