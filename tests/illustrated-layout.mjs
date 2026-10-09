import assert from 'node:assert/strict';
import {plots,plotOutline,pointInPlot,buildingPosition,roadSegments,project,pathTo} from '../src/illustrated-world.js';
const lots=plots.map((p,slot)=>({...p,slot})).filter(p=>p.expansion);
assert.equal(lots.length,27);
assert.deepEqual([...new Set(lots.map(p=>p.x))],[625,290,965]);
for(const lot of lots){
 const tent=buildingPosition(lot.slot,'tent');
 // The visible ground footprint fits within its lot; its doorway reaches the road.
 for(const dx of [-115,0,115])for(const dy of [-70,-30,0])assert.ok(pointInPlot({x:tent.x+dx,y:tent.y+dy},lot.slot));
 assert.ok(pointInPlot(lot,lot.slot));assert.equal(project({x:lot.door[0],y:lot.door[1]}).distance,0);
 assert.ok(plotOutline(lot.slot).every(([x,y])=>Math.abs(x-lot.x)===135&&Math.abs(y-lot.y)===95));
 const destination={x:lot.door[0],y:lot.door[1]},route=pathTo({x:1220,y:730},destination);assert.ok(route.length);
}
for(const[a,b]of roadSegments)for(let i=0;i<=20;i++){
 const p={x:a[0]+(b[0]-a[0])*i/20,y:a[1]+(b[1]-a[1])*i/20};
 assert.ok(lots.every(lot=>!pointInPlot(p,lot.slot)),'every walking road stays outside building lots');
}
console.log('PASS: artwork has three lot columns, all tent footprints fit, all doorways reach roads, roads never cross a lot.');
