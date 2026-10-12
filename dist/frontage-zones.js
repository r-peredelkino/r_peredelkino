// Courtyard privacy versus outward-facing retail, based on supplied October panoramas.
export const courtyardFocus=[12,0];
export function facesCourtyard(x,z,nx,nz){return nx*(courtyardFocus[0]-x)+nz*(courtyardFocus[1]-z)>0;}

// Two complete retail tiers are visible in the developer's 9 October views
// 12.03.36 / 12.03.39 / 12.03.41. These model elevations are reconstructed,
// not surveyed: the roof aligns with the existing 6.64 m residential base.
// The October 11 source shows a clear signage fascia between the two glazed
// storeys. Widen it symmetrically about its existing 3.55 datum; keep the roof.
export const retailLevels=Object.freeze({
 groundBottom:.24,groundTop:3.16,
 dividerBottom:3.16,dividerTop:3.94,
 upperBottom:3.94,upperTop:6.04,
 corniceBottom:6.04,corniceTop:6.60,
 roofSlabBottom:6.56,roof:6.64,signY:3.55
});
