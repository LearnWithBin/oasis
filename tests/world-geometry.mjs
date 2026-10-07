import assert from 'node:assert/strict';
import { WORLD_SPOTS, worldBounds } from '../src/world.js';
import { isDryGround, dryRoute, walkingRoute } from '../src/ground.js';
for (let i=0;i<32;i++) {
  assert.ok(isDryGround(WORLD_SPOTS[i].x,WORLD_SPOTS[i].y,Math.floor(i/8)+1),`slot ${i} needs dry unlocked ground`);
}
assert.ok(isDryGround(.62,.27,1),'waterfall ledge remains accessible');
assert.ok(!isDryGround(.55,.48,4),'pond stays water after expanding');
assert.ok(!isDryGround(.5,1.2,1),'unopened land stays locked');
assert.ok(isDryGround(.5,1.2,2),'new land connects to the Oasis');
assert.ok(dryRoute({x:.62,y:.85},{x:.62,y:1.3},2),'no invisible border between old and new land');
for (const [start,end,level] of [
  [{x:.45,y:.85},{x:.62,y:.27},1],
  [{x:.2,y:.46},{x:.86,y:.46},2],
  [{x:.24,y:1.18},{x:1.4,y:.42},4]
]) {
  const route=walkingRoute(start,end,level);
  assert.ok(route?.length,'a sand route should exist');
  let previous=start;
  for(const point of route){assert.ok(dryRoute(previous,point,level));previous=point;}
  assert.deepEqual(route.at(-1),end);
}
assert.equal(walkingRoute({x:.45,y:.85},{x:.55,y:.48},4),null);
assert.equal(worldBounds(2).height,1536);
console.log('Geometry PASS: 32 stable spots, continuous unlocked ground, pond collision, waterfall access and routes around water.');
