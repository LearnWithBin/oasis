import assert from 'node:assert/strict';
import { WORLD_SPOTS } from '../src/world.js';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5184', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', data => { if (String(data).includes('Local:')) resolve(); });
  server.once('exit', code => reject(new Error(`Test server exited: ${code}`)));
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.OASIS_BROWSER_EXECUTABLE || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const key = 'learnwithbin-oasis-preview-v1';

await page.addInitScript(({key})=>{
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({id:'preview',oasis_name:'Lateef',stars:50,land_level:2,avatar:{skin:'#a86843',hair:'#e7eaf0',clothes:'#ee9b52'},items:[...Array.from({length:8},(_,i)=>({id:`building-${i}`,item_type:i<6?'tent':'palms',slot_index:i})),{id:'goat-pen',item_type:'pen',slot_index:12},...['a','b','c'].map((id,i)=>({id:`goat-${id}`,item_type:'goat',slot_index:13+i,pen_item_id:'goat-pen'}))]}));
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
const waitNearHome=async()=>page.waitForFunction(()=>JSON.parse(document.querySelector('canvas').dataset.animals).every(a=>Math.abs((a.x-.35)*1536)<150&&Math.abs((a.y-1.18)*1024)<90),null,{timeout:30000});
try {
 await page.goto('http://127.0.0.1:5184/oasis/?preview=1');
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 await page.locator('[data-type="chicken"]').click();await spot(.56,1.07);
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).items.some(i=>i.item_type==='chicken'),key);
 const hen=(await stored()).items.find(i=>i.item_type==='chicken');
 assert.equal((await stored()).stars,44);
 await page.locator('[data-type="coop"]').click();await spot(.35,1.18);
 await page.getByRole('heading',{name:'Chicken coop 1'}).waitFor();
 assert.equal(await page.locator('.pen-animal').count(),1,'only chickens offered to coop');
 await page.locator('.pen-animal input').check();await page.getByRole('button',{name:'Save animals',exact:true}).click();
 const coop=(await stored()).items.find(i=>i.item_type==='coop');
 assert.equal((await stored()).stars,32);
 await page.waitForFunction(id=>{const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id===id);return Math.abs((a.x-.35)*1536)<150&&Math.abs((a.y-1.18)*1024)<90;},hen.id);
 await page.screenshot({path:'/tmp/oasis-chickens-ipad.png',fullPage:true});
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator('[data-pet="goat-a"]').click();
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator(`[data-pet="${hen.id}"]`).click();
 assert.equal((await stored()).companion_item_id,hen.id,'switch from goat to chicken');
 await page.waitForFunction(id=>{const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id===id),v=document.querySelector('#world-avatar');return Math.hypot((a.x-Number(v.dataset.worldX))*1536,(a.y-Number(v.dataset.worldY)-.08)*1024)<170;},hen.id);
 await overview();await spot(.62,.27);
 await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#world-avatar').dataset.worldY)-.19)<.01);
 await page.waitForFunction(id=>{const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id===id);return Math.hypot((a.x-.62)*1536,(a.y-.27)*1024)<240;},hen.id);
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator(`[data-pet="${hen.id}"]`).click();
 await page.waitForFunction(id=>{const a=JSON.parse(document.querySelector('canvas').dataset.animals).find(a=>a.id===id);return Math.abs((a.x-.35)*1536)<150&&Math.abs((a.y-1.18)*1024)<90;},hen.id);
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator(`[data-pen="${coop.id}"]`).click();
 await page.getByRole('button',{name:'Collect 1 egg',exact:true}).click();
 assert.equal((await stored()).eggs,1);assert.equal((await stored()).stars,32,'eggs do not change homework stars');
 await page.reload();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 assert.equal((await stored()).eggs,1,'basket persists');
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator(`[data-pen="${coop.id}"]`).click();
 assert.ok(await page.getByRole('button',{name:'Collect 1 egg',exact:true}).isDisabled(),'daily cooldown persists');
 await page.getByRole('button',{name:'Keep it here',exact:true}).click();
 await page.evaluate(key=>{const o=JSON.parse(localStorage.getItem(key));o.eggs_collected_at=new Date(Date.now()-86400001).toISOString();localStorage.setItem(key,JSON.stringify(o));},key);
 await page.reload();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.animals);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Animals',exact:true}).click();await page.locator(`[data-pen="${coop.id}"]`).click();
 await page.screenshot({path:'/tmp/oasis-chickens-phone.png',fullPage:true});
 await page.getByRole('button',{name:'Collect 1 egg',exact:true}).click();assert.equal((await stored()).eggs,2);
 assert.equal((await stored()).items.filter(i=>i.item_type==='goat').length,3,'goats preserved');
 assert.ok((await stored()).items.filter(i=>i.item_type==='goat').every(i=>i.pen_item_id==='goat-pen'));
 assert.deepEqual(errors,[]);
 console.log('Chicken UI PASS: purchase, white coop, matching residents, switch pet species, waterfall walk, return to coop, daily eggs, reloads and phone layout.');
}catch(error){console.log('Page errors:',errors,'Animal positions:',await positions());await page.screenshot({path:'/tmp/oasis-chickens-failure.png',fullPage:true});throw error;}
finally{await browser.close();server.kill();}
