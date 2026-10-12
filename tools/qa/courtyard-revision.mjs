import assert from 'node:assert/strict';
import {createComplex} from '../../dist/complex-model.js';
import {createTourWorld} from '../../dist/walking-tour.js';
import {facesCourtyard} from '../../dist/frontage-zones.js';
const m=createComplex(),world=createTourWorld(m);
assert.equal(m.root.getObjectByName('Curved courtyard kindergarten traced from engineering plan'),undefined);
assert.equal(m.courtyard.revision.replaces,'kindergarten');
assert.equal(world.free(11,-1),true,'The former building no longer blocks the central garden route');
assert.equal(m.publicRealm.closeDetails.portals.length,5);
assert.equal(m.publicRealm.entrances.length,1);assert.equal(m.publicRealm.entrances[0].id,0);
for(const p of [...m.commercialPanes,...m.towerCommercialPanes])assert.equal(facesCourtyard(p.x,p.z,p.nx,p.nz),false,'Retail only faces outward');
for(const p of m.publicRealm.signPanes)assert.equal(!!p.officeLobby,false,'Office lobby has no retail sign');
const sport=m.courtyard.data.zones.find(z=>z.id==='sport');
for(const data of [m.courtyard.data,m.publicRealm.data])for(const p of data.trees)assert.ok(((p[0]-sport.x)/sport.rx)**2+((p[1]-sport.z)/sport.rz)**2>=1,'No trees planted inside the reference fitness court');
for(const [id,t] of m.towers)if(id!==0){for(let i=0;i<t.columns;i++){const a=t.windows.instanceMatrix.array;assert.equal(Math.abs(a[i*16]),0,'No residential pane drawn over private ground floor')}}
m.dispose();console.log('PASS: open courtyard; no obsolete building collision; five matching private entries; office-only revolving entry; outward retail; one reference fitness island and clear central garden route; no ground-floor residential glazing');
