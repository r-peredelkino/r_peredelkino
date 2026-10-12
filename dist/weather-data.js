// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import {location} from './solar.js?v=references37';
export function weatherKind(code){if([71,73,75,77,85,86].includes(code))return'snow';if(code>=51)return'rain';if(code>=45)return'fog';if(code>=2)return'clouds';return'clear'}
export const weatherNames={clear:'Ясно',clouds:'Облачно',rain:'Дождь',snow:'Снег',fog:'Туман'};
let cache=null,pending=null;
export async function currentWeather(signal){if(cache&&Date.now()-cache.received<600000)return cache;if(pending)return pending;
 pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);signal?.addEventListener('abort',()=>controller.abort(),{once:true});try{
 const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:location.latitude,longitude:location.longitude,current:'temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',wind_speed_unit:'ms',timezone:'Europe/Moscow',forecast_days:'1'});
 const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Weather service unavailable');const data=await response.json(),c=data.current;
 if(!c||!Number.isFinite(c.weather_code)||!Number.isFinite(c.wind_speed_10m)||!Number.isFinite(c.wind_direction_10m)||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.cloud_cover))throw new Error('Invalid weather data');
 const observed=Date.parse(c.time+'+03:00');if(!Number.isFinite(observed)||Math.abs(Date.now()-observed)>7200000)throw new Error('Outdated weather data');
 cache={kind:weatherKind(c.weather_code),temperature:c.temperature_2m,cloudCover:c.cloud_cover,windSpeed:c.wind_speed_10m,windDirection:c.wind_direction_10m,time:c.time,received:Date.now(),source:'Open-Meteo'};return cache;
 }finally{clearTimeout(timer)}})().finally(()=>{pending=null});return pending}
