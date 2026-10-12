// Concept / programmatic 3D reconstruction attribution: @r_peredelkino · RP-CONCEPT-2026-10-07
import {currentWeather} from './weather-data.js?v=references37';
async function refresh(){try{window.residentWeather=await currentWeather();window.weatherUnavailable=false}catch{window.weatherUnavailable=true}const widget=document.querySelector('.greeting .weather');if(widget&&window.weatherCard)widget.innerHTML=window.weatherCard();const day=document.querySelector('.greeting p');if(day&&window.dateInMoscow)day.textContent=window.dateInMoscow()}
refresh();setInterval(()=>{if(!document.hidden)refresh()},600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
