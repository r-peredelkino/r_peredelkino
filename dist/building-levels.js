// @r_peredelkino · declaration 77-003147 (07.09.2026), section 15.3.
// Clear commercial height is documented; structural allowances/upper floor pitch remain concept estimates.
export const commercialClearHeight=id=>id===1?6.68:6.32;
export const commercialStructuralTop=id=>commercialClearHeight(id)+.32;
export function residentialFloorBase(id,floor,height=94,floors=30){return floor<=1?0:commercialStructuralTop(id)+(floor-2)*(height-commercialStructuralTop(id))/(floors-1);}
export function towerLevel(spec,index){if(spec.id===0)return {base:index*spec.h/spec.floors,height:spec.h/spec.floors};const base=residentialFloorBase(spec.id,index+1,spec.h,spec.floors);return {base,height:index===0?commercialStructuralTop(spec.id):(spec.h-commercialStructuralTop(spec.id))/(spec.floors-1)};}
