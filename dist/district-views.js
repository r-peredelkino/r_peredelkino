// Camera presets share the geographic registration of streets and addresses.
import {geoToWorld} from './geo-reference.js?v=references37';

const junction=geoToWorld(37.353162,55.638418,0);
const jx=junction[0],jz=junction[2];
export const districtView={
 position:[jx-325,590,jz+480],target:[jx+35,8,jz-5],fov:55,zoom:.38
};
export const transportView={
 position:[jx+200,255,jz+210],target:[jx+55,1,jz-65],fov:57,zoom:.68
};
export const forecourtView={
 position:[-88.3812121,54.0558996,-74.4318223],target:[-9.88329,0,-90.57749],fov:46,zoom:2.25
};
export const districtSourceText='Контуры и направления: OpenStreetMap · сверка 10.10.2026. Фазы светофоров — демонстрация.';
