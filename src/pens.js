import { ITEMS } from './catalog.js';
import { isDryGround } from './ground.js';
import { WORLD_SPOTS, CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';
export const PEN_CAPACITY=6;
export const PEN_HALF_WIDTH=180, PEN_HALF_HEIGHT=120;
export const isPen=type=>!!ITEMS[type]?.pen;
export const penSpecies=pen=>ITEMS[pen.item_type].pen.species;
export const ownedPens=oasis=>oasis.items.filter(i=>isPen(i.item_type)).sort((a,b)=>a.slot_index-b.slot_index);
export const animalPen=(oasis,item)=>ownedPens(oasis).find(p=>p.id===item.pen_item_id)||null;
export const penResidents=(oasis,pen)=>oasis.items.filter(i=>i.pen_item_id===pen.id);
export function penLocationAvailable(oasis,slot,ignoreId=null){
 const center=WORLD_SPOTS[slot];if(!center||slot>=(oasis.land_level||1)*8)return false;
 for(let dx=-180;dx<=180;dx+=45)for(let dy=-120;dy<=120;dy+=40)
  if(!isDryGround(center.x+dx/W,center.y+dy/H,oasis.land_level||1))return false;
 return !oasis.items.some(i=>{
  if(i.id===ignoreId||!['tent','palms'].includes(i.item_type)&&!isPen(i.item_type))return false;
  const p=WORLD_SPOTS[i.slot_index];
  return Math.abs((center.x-p.x)*W)<(isPen(i.item_type)?360:285)&&Math.abs((center.y-p.y)*H)<(isPen(i.item_type)?240:210);
 });
}
export function buildingClearOfPens(oasis,slot,ignoreId=null){
 const p=WORLD_SPOTS[slot];
 return ownedPens(oasis).filter(i=>i.id!==ignoreId).every(i=>{
  const c=WORLD_SPOTS[i.slot_index];return Math.abs((p.x-c.x)*W)>=285||Math.abs((p.y-c.y)*H)>=210;
 });
}
export function penGate(pen){const c=WORLD_SPOTS[pen.slot_index];return{x:c.x,y:c.y+120/H};}
export function insidePen(point,pen,margin=0){const c=WORLD_SPOTS[pen.slot_index];return Math.abs((point.x-c.x)*W)<=180-margin&&Math.abs((point.y-c.y)*H)<=120-margin;}
export function penPosition(pen,index,resting=false){
 const center=WORLD_SPOTS[pen.slot_index],dx=[-85,0,85,-85,0,85][index%6],dy=resting?(index<3?-55:-20):[-5,-5,-5,62,62,62][index%6];
 return{x:center.x+dx/W,y:center.y+dy/H};
}

// Fence crossings are only possible through the 92px opening in the front.
export function fenceClear(start,end,oasis){
 for(const pen of ownedPens(oasis)){
  const c=WORLD_SPOTS[pen.slot_index];
  const a={x:(start.x-c.x)*W,y:(start.y-c.y)*H},b={x:(end.x-c.x)*W,y:(end.y-c.y)*H};
  const dx=b.x-a.x,dy=b.y-a.y;
  for(const side of [-180,180])if(dx){const t=(side-a.x)/dx,y=a.y+t*dy;if(t>0.00001&&t<.99999&&Math.abs(y)<120)return false;}
  for(const side of [-120,120])if(dy){const t=(side-a.y)/dy,x=a.x+t*dx;if(t>0.00001&&t<.99999&&Math.abs(x)<180&&(side<0||Math.abs(x)>46))return false;}
 }
 return true;
}

export function eggCollection(oasis,now=Date.now()) {
 const count=oasis.items.filter(i=>i.item_type==='chicken'&&animalPen(oasis,i)?.item_type==='coop').length;
 const last=oasis.eggs_collected_at?Date.parse(oasis.eggs_collected_at):null;
 const wait=last===null?0:Math.max(0,last+86400000-now);
 return{count,ready:count>0&&wait===0,wait};
}
