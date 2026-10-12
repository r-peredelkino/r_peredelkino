// @r_peredelkino · one interior spans adjacent panes of the same shop.
// The groups describe a visual reconstruction, not legal tenant boundaries.
export function createShopFrontageLayout(panes,{targetWidth=10.5}={}){
 const chains=new Map(),byPane=new Map(),groups=[];
 for(const pane of panes){
  const key=pane.frontageChain??`detached:${pane.id}`,index=pane.frontageIndex??pane.id;
  let chain=chains.get(key);if(!chain){chain=new Map();chains.set(key,chain)}
  let bay=chain.get(index);if(!bay){bay={key,index,width:pane.width,pitch:pane.pitch??pane.width,panes:[]};chain.set(index,bay)}
  bay.panes.push(pane);
 }
 for(const [key,chain] of chains){
  const ordered=[...chain.values()].sort((a,b)=>a.index-b.index),runs=[];let run=[];
  for(const bay of ordered){if(run.length&&bay.index!==run.at(-1).index+1){runs.push(run);run=[]}run.push(bay)}if(run.length)runs.push(run);
  for(const sequence of runs){
   let at=0;
   while(at<sequence.length){
    let end=at,total=0;
    while(end<sequence.length&&(total<targetWidth||end===at)){total+=sequence[end].pitch;end++}
    // A final one-pane sliver belongs to its neighbour, not another whole cafe.
    if(sequence.length-end===1){total+=sequence[end].pitch;end++}
    const groupId=groups.length,style=groupId%4,entries=sequence.slice(at,end);let distance=0;
    for(const bay of entries){
     const inset=(bay.pitch-bay.width)/2,u0=(distance+inset)/total,u1=(distance+bay.pitch-inset)/total;
     // BoxGeometry reverses U on its negative-Z face. Correct that face so
     // both contour windings preserve the same left-to-right room sequence.
     for(const pane of bay.panes)byPane.set(pane,{groupId,style,u0,u1,tier:pane.storey===2?1:0,reverse:Math.sin(pane.angle)*pane.nx+Math.cos(pane.angle)*pane.nz<0?1:0});
     distance+=bay.pitch;
    }
    groups.push({id:groupId,chain:key,firstBay:entries[0].index,lastBay:entries.at(-1).index,bayCount:entries.length,width:total,style});at=end;
   }
  }
 }
 return{groups,byPane,records:panes.map(pane=>byPane.get(pane))};
}
