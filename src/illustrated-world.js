import {nodes,edges,project,pathTo,isWater,shorePoints} from '../public/style-preview/navigation.js';
export {project,pathTo,isWater,shorePoints};
// Slot IDs stay the same in the database. This view arranges them around dry paths.
export const plots=[{x:340,y:210,door:[465,295]},{x:300,y:580,door:[540,635]},{x:565,y:850,door:[500,770]},{x:1030,y:775,door:[970,680]},{x:1290,y:590,door:[1110,650]},{x:1290,y:305,door:[1170,380]},{x:200,y:850,door:[240,750]},{x:1320,y:850,door:[1220,730]}];
for(let i=8;i<32;i++){const row=Math.floor((i-8)/4),col=(i-8)%4;plots.push({x:195+col*380,y:1165+row*300,door:[195+col*380,1280+row*300]});}
// Dry lanes between expansion rows keep animals and avatars out of the pond.
for(let i=8;i<32;i++){const p=plots[i],n=nodes.length;nodes.push(p.door);p.node=n;if(i>=12)edges.push([plots[i-4].node,n]);else edges.push([i%4<2?0:i%4===2?20:7,n]);if(i%4)edges.push([plots[i-1].node,n]);}
export const heightForLevel=level=>level<=1?1024:plots[Math.min(31,level*8-1)].y+240;
export function buildSlots(oasis,intent,{penLocationAvailable,buildingClearOfPens,isPen,isAnimal,animalHomeSlot}){const animal=isAnimal(intent.item);return plots.slice(0,(oasis.land_level||1)*8).map((p,index)=>({index,...p})).filter(p=>{
 if(intent.type==='move'&&!intent.id)return false;
 if(intent.type==='animal-home')return !oasis.items.some(i=>i.slot_index===p.index&&!isAnimal(i.item_type));
 if(isPen(intent.item))return penLocationAvailable(oasis,p.index,intent.id);
 if(!animal&&!buildingClearOfPens(oasis,p.index,intent.id))return false;
 if(!animal&&p.index===animalHomeSlot(oasis))return false;
 return !oasis.items.some(i=>i.slot_index===p.index&&i.id!==intent.id&&!isAnimal(i.item_type));
 });}
