import assert from 'node:assert/strict';
import {GoatLife} from '../public/style-preview/goat-life.js';
import {nodes,edges,pathTo,isWater,shorePoints} from '../public/style-preview/navigation.js';
const start={x:690,y:640};
for(const point of Object.values(shorePoints)){
 const route=pathTo(start,point);assert.deepEqual(route.at(-1),point,'rock ledge remains an exact destination');
 let previous=start;
 for(const next of route){for(let i=0;i<=50;i++){const p={x:previous.x+(next.x-previous.x)*i/50,y:previous.y+(next.y-previous.y)*i/50};assert.equal(isWater(p),false,'rock approach stays on dry ground');}previous=next;}
}
assert.equal(isWater({x:820,y:430}),true);
const home={x:1245,y:625},door={x:1110,y:650},goat=new GoatLife(false,{...home,mode:'home'});
let time=0;
const advance=()=>{const before={x:goat.x,y:goat.y};time+=50;goat.update(.05,time,start,home,door,goat.pet);assert.ok(Math.hypot(goat.x-before.x,goat.y-before.y)<=10.51,'goat movement never teleports');};
goat.update(0,0,start,home,door,false);goat.setPet(true,start,home,door);
for(let i=0;i<300;i++)advance();assert.equal(goat.mode,'following');assert.ok(Math.hypot(goat.x-645,goat.y-660)<80);
const beforeReturn=goat.snapshot();goat.setPet(false,start,home,door);assert.equal(goat.x,beforeReturn.x);assert.equal(goat.y,beforeReturn.y);assert.equal(goat.mode,'returning');
let steps=0;while(goat.mode!=='home'&&steps++<400)advance();assert.equal(goat.mode,'home');assert.ok(Math.hypot(goat.x-home.x,goat.y-home.y)<1,'goat enters home after its return route');
console.log('Preview movement PASS: all three rock ledges have dry routes; goat joins and returns continuously and arrives inside its pen.');
