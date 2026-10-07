import assert from 'node:assert/strict';
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
const spot = async (x,y) => {const b=await page.locator('canvas').boundingBox(); await page.mouse.click(b.x+b.width*x,b.y+b.height*y);};
try {
  await page.goto('http://127.0.0.1:5173/oasis/?preview=1');
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(800);
  await page.locator('[data-land="1"]').click();
  await page.locator('[data-type="goat"]').click();
  await spot(.18,.32);
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).items.some(i=>i.item_type==='goat'),key);
  assert.equal((await stored()).stars,72);
  assert.equal((await stored()).items.find(i=>i.item_type==='goat').slot_index,8);
  const b=await page.locator('canvas').boundingBox();
  const clip={x:b.x+b.width*.06,y:b.y+b.height*.15,width:b.width*.25,height:b.height*.25};
  const still=await page.screenshot({clip});
  await page.waitForTimeout(2400);
  const walking=await page.screenshot({clip});
  assert.ok(!still.equals(walking),'baby goat should visibly animate');
  await page.screenshot({path:'/tmp/oasis-goats-ipad.png',fullPage:true});
  await page.locator('[data-type="palms"]').click();
  for (const [x,y] of [[.42,.36],[.67,.31],[.85,.43],[.17,.68],[.38,.77]]) {await spot(x,y);await page.waitForTimeout(100);}
  await page.locator('[data-land="2"]').waitFor();
  assert.equal((await stored()).land_level,3);
  assert.equal((await stored()).items.length,14);
  await page.reload();
  await page.locator('[data-land="2"]').waitFor();
  await page.waitForTimeout(500);
  await page.locator('[data-land="1"]').click();
  await spot(.18,.28);
  await page.getByRole('heading',{name:'Baby goat',exact:true}).waitFor();
  await page.getByRole('button',{name:'Sell for ★ 4',exact:true}).click();
  await page.getByRole('button',{name:'Yes, sell it'}).click();
  await page.getByText('Sold for 4 stars.',{exact:true}).waitFor();
  assert.equal((await stored()).stars,66);
  assert.equal((await stored()).land_level,3,'selling must preserve new land');
  assert.ok(!(await stored()).items.some(i=>i.item_type==='goat'));
  await page.locator('[data-type="goat"]').click();
  await spot(.18,.32);
  await page.waitForTimeout(300);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/oasis-goats-phone.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,'phone page must not overflow');
  await page.locator('[data-land="0"]').click();
  await page.screenshot({path:'/tmp/oasis-goats-home.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('UI PASS: goat purchase, visible movement, reload, sale/refund, permanent land expansion and tablet/phone navigation.');
} catch(error) {
  await page.screenshot({path:'/tmp/oasis-goats-failure.png',fullPage:true});
  console.log('Page errors:',errors);
  throw error;
} finally {await browser.close();server.kill();}
