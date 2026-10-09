import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5196','--strictPort']);
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('Local:')&&resolve());server.once('exit',c=>reject(Error(`Server exited ${c}`)));});
const browser=await chromium.launch({executablePath:process.env.OASIS_BROWSER_EXECUTABLE,args:['--no-sandbox']});
const key='learnwithbin-oasis-preview-v1',fixture={id:'preview',oasis_name:'Lateef',stars:7,land_level:2,avatar:{skin:'#a86843',hair:'#e7eaf0',clothes:'#ee9b52'},items:[{id:'pen',item_type:'pen',slot_index:12},{id:'goat',item_type:'goat',slot_index:0,pen_item_id:'pen'},{id:'hen-a',item_type:'chicken',slot_index:8},{id:'hen-b',item_type:'chicken',slot_index:9}],animal_home_slot:9};
try{
 const context=await browser.newContext({viewport:{width:1366,height:1024},hasTouch:true,isMobile:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({key,fixture})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},{key,fixture});
 await page.goto('http://127.0.0.1:5196/oasis/?preview=1&look=illustrated');await page.waitForFunction(()=>document.querySelector('#scene canvas')?.dataset.state);
 await page.getByRole('button',{name:'Chickens · 2 need a coop',exact:true}).click();await page.getByText('You do not own a chicken coop yet.',{exact:false}).waitFor();assert.ok((await page.locator('.animal-dialog').textContent()).includes('save 5 more stars'));await page.getByRole('button',{name:'Close',exact:true}).click();
 const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal((await stored()).stars,7);assert.equal((await stored()).items.length,4,'housing screen does not give free inventory');
 // Native fullscreen path, then its exit control.
 await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.shell').classList.contains('game-expanded'));await page.getByRole('button',{name:'Exit full screen',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.shell').classList.contains('game-expanded'));
 // Browser refuses native fullscreen: the expanded game still works.
 await page.evaluate(()=>{HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('Unsupported'));});
 for(const viewport of [{width:1366,height:1024},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.shell').classList.contains('game-expanded'));
  await page.waitForTimeout(100);const shell=await page.locator('.shell').boundingBox(),stage=await page.locator('.stage').boundingBox(),button=await page.locator('#full-screen').boundingBox();assert.equal(Math.round(shell.width),viewport.width);assert.equal(Math.round(shell.height),viewport.height);assert.ok(stage.height>100);assert.ok(button.y>=0&&button.y+button.height<=viewport.height);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/oasis-fullscreen-${viewport.width}.png`,fullPage:true});await page.getByRole('button',{name:'Build menu',exact:true}).click();assert.equal(await page.locator('.shop').isVisible(),true);await page.getByRole('button',{name:'Build menu',exact:true}).click();assert.equal(await page.locator('.shop').isVisible(),false);await page.getByRole('button',{name:'Exit full screen',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.shell').classList.contains('game-expanded'));
 }
 // Existing coop, unassigned chickens: select and save sends them to it visibly.
 await page.evaluate(key=>{const o=JSON.parse(localStorage.getItem(key));o.items.push({id:'coop',item_type:'coop',slot_index:8});o.items.find(i=>i.id==='hen-a').slot_index=10;localStorage.setItem(key,JSON.stringify(o));},key);await page.reload();await page.waitForFunction(()=>document.querySelector('#scene canvas')?.dataset.state);
 await page.getByRole('button',{name:'Chickens · 2 need a coop',exact:true}).click();await page.getByRole('button',{name:'Chicken coop 1 · 0/6 chickens',exact:true}).click();assert.equal(await page.locator('.pen-animal').count(),2,'only chickens offered to coop');await page.getByRole('button',{name:'Select animals waiting for a home',exact:true}).click();assert.equal(await page.locator('.pen-animal input:checked').count(),2);await page.getByRole('button',{name:'Save animals',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.scrim'));assert.ok((await stored()).items.filter(i=>i.item_type==='chicken').every(i=>i.pen_item_id==='coop'));assert.equal((await stored()).stars,7);
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#scene canvas').dataset.state).animals.filter(a=>a.type==='chicken').every(a=>a.mode==='home'&&Math.abs(a.x-195)<95&&a.y>1165&&a.y<1250),null,{timeout:20000});
 await page.reload();await page.waitForFunction(()=>document.querySelector('#scene canvas')?.dataset.state);assert.equal(await page.getByRole('button',{name:'Chickens',exact:true}).count(),1,'housing survives reload');assert.deepEqual(errors,[]);
 console.log('PASS: native fullscreen and restricted-browser fallback, tablet/phone/landscape exit, no overflow, missing-coop guidance, matching hen assignment, physical arrival and saved housing.');
}finally{await browser.close();server.kill();}
