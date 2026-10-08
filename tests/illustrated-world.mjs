import assert from 'node:assert/strict';
import {plots,project,pathTo,isWater,shorePoints,heightForLevel} from '../src/illustrated-world.js';
assert.equal(plots.length,32);
for(let level=1;level<=4;level++){const height=heightForLevel(level);assert.ok(plots.slice(0,level*8).every(p=>p.y+100<height));if(level>1)assert.ok(height>heightForLevel(level-1));}
for(const p of plots){const from={x:p.door[0],y:p.door[1]},route=pathTo(from,shorePoints.waterfall);let last=project(from).point;for(const point of route){const n=Math.ceil(Math.hypot(point.x-last.x,point.y-last.y));for(let i=0;i<=n;i++){const t=n?i/n:0;assert.equal(isWater({x:last.x+(point.x-last.x)*t,y:last.y+(point.y-last.y)*t}),false,'every plot has a dry route to the waterfall');}last=point;}}
console.log('Illustrated world PASS: 32 stable slots, increasing unlocked land and dry waterfall routes from all expansion plots.');
