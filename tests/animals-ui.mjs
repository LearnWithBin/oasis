import assert from 'node:assert/strict';
import { WORLD_SPOTS } from '../src/world.js';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', data => { if (String(data).includes('Local:')) resolve(); });
  server.once('exit', code => reject(new Error(`Test server exited: ${code}`)));
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.OASIS_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const key = 'learnwithbin-oasis-preview-v1';

await page.addInitScript(({key})=>{
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({id:'preview',oasis_name:'Lateef',stars:31,land_level:2,avatar:{skin:'#a86843',hair:'#e7eaf0',clothes:'#ee9b52'},items:[...Array.from({length:8},(_,i)=>({id:`building-${i}`,item_type:i<6?'tent':'palms',slot_index:i})),...['a','b','c'].map((id,i)=>({id:`goat-${id}`,item_type:'goat',slot_index:12+i}))]}));
},{key});
const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

const screen = async (x,y) => page.evaluate(({x,y})=>{
  const canvas=document.querySelector('canvas'),avatar=document.querySelector('#world-avatar');
  const b=canvas.getBoundingClientRect(), zoom=Number(avatar.dataset.zoom);
  const sx=(parseFloat(avatar.style.left)-canvas.offsetLeft)/canvas.clientWidth;
  const sy=(parseFloat(avatar.style.top)-canvas.offsetTop)/canvas.clientHeight+85/1024*zoom;
  const cx=Number(avatar.dataset.worldX)-(sx-.5)/zoom;
  const cy=Number(avatar.dataset.worldY)+.08-(sy-.5)/zoom;
  return {x:b.x+b.width*(.5+(x-cx)*zoom),y:b.y+b.height*(.5+(y-cy)*zoom)};
}, {x,y});
const spot = async (x,y) => {const p=await screen(x,y);await page.mouse.click(p.x,p.y);};
const overview=async()=>{await page.getByRole('button',{name:'Whole Oasis',exact:true}).click();await page.waitForTimeout(100);};

const animals=()=>page.locator('canvas').getAttribute('data-animals').then(JSON.parse);
const positions=()=>page.evaluate(()=>JSON.parse(document.querySelector('canvas').dataset.animals));
const waitNearHome=async()=>page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.animals).every(a=>Math.hypot((a.x-.35)*1536,(a.y-1.18)*1024)<180));
try {
 await page.goto('http://127.0.0.1:5173/oasis/?preview=1');
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 assert.equal((await positions()).length,3);
 assert.ok((await positions()).every(a=>Math.abs(a.x-1.08)<.09&&Math.abs(a.y-.63)<.1),'existing scattered goats gather together');
 assert.equal((await stored()).stars,31,'grouping is free');
 await page.getByRole('button',{name:'Animals',exact:true}).click();
 assert.equal(await page.locator('.animal-card').count(),3);
 await page.getByRole('button',{name:'Move animal home',exact:true}).click();
 await spot(.35,1.18);
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).animal_home_slot===8,key);
 await waitNearHome();
 await page.screenshot({path:'/tmp/oasis-herd-ipad.png',fullPage:true});
 await page.getByRole('button',{name:'Animals',exact:true}).click();
 await page.locator('[data-pet="goat-a"]').click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).companion_item_id==='goat-a',key);
 await page.waitForFunction(()=>{
  const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id==='goat-a'),v=document.querySelector('#world-avatar');
  return Math.hypot((a.x-Number(v.dataset.worldX))*1536,(a.y-Number(v.dataset.worldY)-.08)*1024)<160;
 });
 await overview();await spot(.62,.27);
 await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#world-avatar').dataset.worldY)-.19)<.01);
 await page.waitForFunction(()=>{
  const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id==='goat-a');return Math.hypot((a.x-.62)*1536,(a.y-.27)*1024)<240;
 });
 const {isDryGround}=await import('../src/ground.js');
 for(const a of await positions())assert.ok(isDryGround(a.x,a.y,2),'animals stay off water');
 const others=(await positions()).filter(a=>a.id!=='goat-a');
 assert.ok(others.every(a=>Math.hypot((a.x-.35)*1536,(a.y-1.18)*1024)<180),'other animals stay at home');
 await page.screenshot({path:'/tmp/oasis-companion-waterfall.png',fullPage:true});
 await page.reload();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 assert.equal((await stored()).companion_item_id,'goat-a','companion survives reload');
 await page.waitForFunction(()=>{const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id==='goat-a'),v=document.querySelector('#world-avatar');return Math.hypot((a.x-Number(v.dataset.worldX))*1536,(a.y-Number(v.dataset.worldY)-.08)*1024)<160;});
 await page.getByRole('button',{name:'Animals',exact:true}).click();
 await page.locator('[data-pet="goat-b"]').click();
 assert.equal((await stored()).companion_item_id,'goat-b','only one companion');
 await page.waitForFunction(()=>{
  const animals=JSON.parse(document.querySelector('canvas').dataset.animals);return animals.find(a=>a.id==='goat-a').mode==='returning';
 });
 await page.getByRole('button',{name:'Animals',exact:true}).click();
 await page.locator('[data-pet="goat-b"]').click();
 assert.equal((await stored()).companion_item_id,null);
 await waitNearHome();
 await page.reload();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 assert.equal((await stored()).animal_home_slot,8,'home survives reload');
 await page.locator('[data-type="goat"]').click();
 await spot(.35,1.27); // the shared home marker, below the animals
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).items.length===12,key);
 assert.equal((await stored()).stars,23,'another goat joins same home');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.animals).length===4);
 await page.locator('[data-type="palms"]').click();await spot(1.08,.63);
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).items.length===13,key);
 assert.equal((await stored()).items.filter(i=>i.item_type==='goat').length,4,'reuse animal slot preserves herd');
 await page.setViewportSize({width:390,height:844});await overview();
 await page.getByRole('button',{name:'Animals',exact:true}).click();
 const bounds=await page.locator('.animal-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 await page.screenshot({path:'/tmp/oasis-animals-phone.png',fullPage:true});
 await page.getByRole('button',{name:'Close animals',exact:true}).click();
 assert.deepEqual(errors,[]);
 console.log('UI PASS: existing herd groups, home relocation, companion follows around pond, switching/dismissal walks home, saved settings, shared-home purchases, slot reuse and phone controls.');
}catch(error){console.log('Page errors:',errors);await page.screenshot({path:'/tmp/oasis-animals-failure.png',fullPage:true});throw error;}
finally{await browser.close();server.kill();}
