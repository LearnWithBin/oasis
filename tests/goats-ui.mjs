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
await page.addInitScript(({key}) => {
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({id:'preview',oasis_name:'Practice',stars:80,avatar:{skin:'#a86843',hair:'#e7eaf0',clothes:'#ee9b52'},items:Array.from({length:8},(_,i)=>({id:`tent-${i}`,item_type:'tent',slot_index:i}))}));
}, {key});
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
try {
  await page.goto('http://127.0.0.1:5173/oasis/?preview=1');
  await page.locator('canvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('#world-avatar')?.dataset.zoom);
  assert.equal(await page.locator('[data-land]').count(),0,'no separate-land tabs');
  assert.equal((await stored()).items.length,8,'original purchases preserved');
  await page.locator('[data-type="goat"]').click();
  await spot(.35,1.18);
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).items.length===9,key);
  assert.equal((await stored()).stars,72);
  assert.equal((await stored()).items.find(i=>i.item_type==='goat').slot_index,8);
  const p=await screen(.35,1.18),b=await page.locator('canvas').boundingBox();
  const clip={x:p.x-100,y:p.y-120,width:200,height:150};
  const still=await page.screenshot({clip});await page.waitForTimeout(2400);
  assert.ok(!still.equals(await page.screenshot({clip})),'goat should visibly animate');
  await page.screenshot({path:'/tmp/oasis-continuous-ipad.png',fullPage:true});
  await spot(.62,1.05);
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#world-avatar').dataset.worldY)-.97)<.01);
  assert.ok(Number(await page.locator('#world-avatar').getAttribute('data-zoom'))>=.95,'walking enables closer camera follow');
  await page.screenshot({path:'/tmp/oasis-continuous-follow.png',fullPage:true});
  const beforeDrag=await page.locator('#world-avatar').getAttribute('data-world-y');
  await page.mouse.move(b.x+b.width*.55,b.y+b.height*.55);await page.mouse.down();
  await page.mouse.move(b.x+b.width*.4,b.y+b.height*.45,{steps:8});await page.mouse.up();
  assert.equal(await page.locator('#world-avatar').getAttribute('data-world-y'),beforeDrag,'drag must not walk');
  assert.equal((await stored()).items.length,9,'drag must not buy');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const zoomBefore=Number(await page.locator('#world-avatar').getAttribute('data-zoom'));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.5-30,y:b.y+b.height*.5},{x:b.x+b.width*.5+30,y:b.y+b.height*.5}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*.5-75,y:b.y+b.height*.5},{x:b.x+b.width*.5+75,y:b.y+b.height*.5}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(150);
  assert.ok(Number(await page.locator('#world-avatar').getAttribute('data-zoom'))>zoomBefore,'pinch zoom');
  assert.equal((await stored()).items.length,9,'pinch must not purchase');
  await overview();
  await page.locator('[data-type="palms"]').click();
  for(const {x,y} of WORLD_SPOTS.slice(9,14)) {await spot(x,y);await page.waitForTimeout(120);}
  assert.equal((await stored()).land_level,3);
  assert.equal((await stored()).items.length,14);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#world-avatar')?.dataset.zoom);
  assert.equal((await stored()).items.length,14,'purchases survive reload');
  await spot(.35,1.14);
  await page.getByRole('heading',{name:'Baby goat',exact:true}).waitFor();
  await page.getByRole('button',{name:'Sell for ★ 4',exact:true}).click();
  await page.getByRole('button',{name:'Yes, sell it'}).click();
  await page.getByText('Sold for 4 stars.',{exact:true}).waitFor();
  assert.equal((await stored()).stars,66);
  assert.equal((await stored()).land_level,3,'selling preserves land');
  await page.locator('[data-type="goat"]').click();await spot(.35,1.18);await page.waitForTimeout(200);
  await overview();
  await spot(.62,.27);
  await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#world-avatar').dataset.worldY)-.19)<.01);
  await page.screenshot({path:'/tmp/oasis-continuous-waterfall.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await overview();
  await page.screenshot({path:'/tmp/oasis-continuous-phone.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'no phone overflow');
  await page.getByRole('button',{name:'Follow me',exact:true}).click();
  await page.screenshot({path:'/tmp/oasis-continuous-phone-follow.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('UI PASS: one connected world, preserved items, goats, route across former border, camera follow, drag, pinch, expansion, reload, refunds and phone layout.');
} catch(error){await page.screenshot({path:'/tmp/oasis-continuous-failure.png',fullPage:true});console.log('Page errors:',errors);throw error;}
finally{await browser.close();server.kill();}
