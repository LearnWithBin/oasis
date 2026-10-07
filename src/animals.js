import { ITEMS } from './catalog.js';
import { isDryGround } from './ground.js';
import { WORLD_SPOTS, CORE_WIDTH as W, CORE_HEIGHT as H } from './world.js';

// All species use these home, herd and companion rules. Species only supply art/pace.
export const isAnimal = type => !!ITEMS[type]?.animal;
export const ownedAnimals = oasis => oasis.items.filter(item=>isAnimal(item.item_type)).sort((a,b)=>a.id.localeCompare(b.id));
export function animalHomeSlot(oasis) {
  const animals=ownedAnimals(oasis);
  if(!animals.length)return null;
  const slot=oasis.animal_home_slot;
  if(Number.isInteger(slot)&&slot>=0&&slot<(oasis.land_level||1)*8&&!oasis.items.some(i=>i.slot_index===slot&&!isAnimal(i.item_type)))return slot;
  return Math.min(...animals.map(i=>i.slot_index));
}
export function herdPosition(oasis,index) {
  const home=WORLD_SPOTS[animalHomeSlot(oasis)];
  const offsets=[[0,0],[-100,55],[100,55],[-95,-45],[95,-45],[0,100]];
  let [dx,dy]=offsets[index%offsets.length];
  if(index>=offsets.length){const angle=index*2.39996,radius=150+Math.sqrt(index-offsets.length)*55;dx=Math.cos(angle)*radius;dy=Math.sin(angle)*radius*.65;}
  for(let attempt=0;attempt<8;attempt++){
    const angle=attempt*Math.PI/4,goal={x:home.x+(dx*Math.cos(angle)-dy*Math.sin(angle))/W,y:home.y+(dx*Math.sin(angle)+dy*Math.cos(angle))/H};
    if(isDryGround(goal.x,goal.y,oasis.land_level||1))return goal;
  }
  return {...home};
}
export function companionTarget(trail,leader,distance=120) {
  for(let i=trail.length-1;i>0;i--){
    const a=trail[i],b=trail[i-1],length=Math.hypot(a.x-b.x,a.y-b.y);
    if(length>=distance){const t=distance/length;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
    distance-=length;
  }
  return trail.length>1 ? trail[0] : {x:leader.x-100,y:leader.y+55};
}
