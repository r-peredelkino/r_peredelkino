// Export first-person physics from the actual project model without a browser.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createComplex} from '../../dist/complex-model.js';
import {createTourWorld} from '../../dist/walking-tour.js';

const sourceText=fs.readFileSync(new URL('./projected-forecourt.json',import.meta.url),'utf8');
const model=createComplex();
try{
 const realm=model.publicRealm,sales=model.salesOffice,world=createTourWorld(model);
 const output={
  sourceInputSHA256:crypto.createHash('sha256').update(sourceText).digest('hex'),
  generatedAt:new Date().toISOString(),
  salesOfficeLayout:sales.layout,
  publicRealmData:realm.data,
  extraction:'The actual createTourWorld(model), including courtyard, portals, all publicRealm source solids, retained backdrop obstacles and boundary extensions.',
  collisionSource:'createTourWorld',
  pedestrianRadius:world.radius,
  solids:world.solids,
  obstacles:world.obstacles,
  boundaries:world.boundaries,
 };
 fs.mkdirSync(new URL('./generated/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('./generated/walking-model-obstacles.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({sourceInputSHA256:output.sourceInputSHA256,solids:output.solids.length,obstacles:output.obstacles.length,boundaries:output.boundaries.length}));
}finally{
 model.dispose();
}
