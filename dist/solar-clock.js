import {solarPosition,direction,moscowParts,moscowDate,location,timeLabel} from './solar.js?v=community38';

// One calendar and time for the district, walking views and apartment viewer.
const initial=moscowParts();
export const solarState={mode:'now',date:initial.date,minutes:initial.minutes,weather:'clear',paths:false,context:true,play:false};

export function setSolarSelection(day,minutes,{mode='manual',weather}={}){
 const value=Number(minutes);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(value))throw new RangeError('Invalid solar date or time');
 const time=Math.max(0,Math.min(1439,Math.round(value))),instant=new Date(moscowDate(day,time));
 if(moscowParts(instant).date!==day)throw new RangeError('Invalid calendar date');
 Object.assign(solarState,{mode,date:day,minutes:time,play:false});
 if(weather!==undefined)solarState.weather=weather;
 return getSolarSnapshot();
}

export function getSolarSnapshot(now=new Date()){
 const date=solarState.mode==='now'?now:new Date(moscowDate(solarState.date,solarState.minutes));
 const parts=moscowParts(date);
 if(solarState.mode==='now'){solarState.date=parts.date;solarState.minutes=parts.minutes;}
 const position=solarPosition(date);
 // SunCalc.org displays the apparent altitude. Use that same physical
 // quantity for the light ray; keep the airless value available for QA.
 const elevation=position.apparentElevation;
 return{date,parts,position,elevation,direction:direction(position.azimuth,elevation),aboveHorizon:elevation>0};
}

export function solarReferenceLinks(day=solarState.date,minutes=solarState.minutes){
 const {latitude:lat,longitude:lon}=location;
 const parts=moscowParts(new Date(moscowDate(day,minutes))),offset=parts.utcOffsetMinutes/60;
 return{
  suncalc:`https://www.suncalc.org/#/${lat.toFixed(6)},${lon.toFixed(6)},17/${day.replaceAll('-','.')}/${parts.time}/1/${offset}`,
  shademap:`https://shademap.app/@${lat.toFixed(6)},${lon.toFixed(6)},16.5z,${moscowDate(day,minutes)}t,0b,0p,0m`
 };
}

export function monthDate(day,month){
 const year=Number(day.slice(0,4)),date=Number(day.slice(8,10));
 const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return`${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(date,last)).padStart(2,'0')}`;
}
