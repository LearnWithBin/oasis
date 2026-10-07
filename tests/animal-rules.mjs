import assert from 'node:assert/strict';
import { ITEMS } from '../src/catalog.js';
import { isAnimal, animalHomeSlot, ownedAnimals, herdPosition, companionTarget } from '../src/animals.js';
import { isDryGround } from '../src/ground.js';
const oasis={land_level:2,animal_home_slot:8,items:[{id:'a',item_type:'goat',slot_index:12},{id:'b',item_type:'goat',slot_index:13},{id:'t',item_type:'tent',slot_index:0}]};
assert.equal(animalHomeSlot(oasis),8);
assert.equal(ownedAnimals(oasis).length,2);
assert.ok(!isAnimal('tent'));
assert.equal(animalHomeSlot({...oasis,animal_home_slot:0}),12,'a building cannot become an animal home');
ITEMS.testAnimal={label:'Test animal',animal:{}};
const mixed={...oasis,items:[...oasis.items,{id:'c',item_type:'testAnimal',slot_index:14}]};
assert.equal(ownedAnimals(mixed).length,3,'a new animal species uses the same home rules');
for(let i=0;i<32;i++){const point=herdPosition(mixed,i);assert.ok(isDryGround(point.x,point.y,2));}
delete ITEMS.testAnimal;
assert.deepEqual(companionTarget([{x:0,y:0},{x:200,y:0},{x:200,y:200}],{x:200,y:200}),{x:200,y:80},'follow the path behind the player rather than cut the corner');
assert.equal(animalHomeSlot({...oasis,items:[]}),null);
console.log('Animal rules PASS: mixed-species homes, stable membership, dry herd positions and trailing a turn.');
