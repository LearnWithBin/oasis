import './style.css';
import { enterOasis, updateProfile, buyItem, moveItem, sellItem, setAnimalHome, setAnimalCompanion, setPenAnimals, collectEggs, isPreview } from './backend.js';
import { mountGame } from './game.js';
import { avatarMarkup } from './avatar.js';
import { mountTrading } from './trading.js';
import { ITEMS, itemLabel, capacity } from './catalog.js';
import { isPen, penSpecies, eggCollection, ownedPens, animalPen, penResidents, PEN_CAPACITY } from './pens.js';
import { isAnimal, animalHomeSlot, ownedAnimals } from './animals.js';
const eggIcon='<svg width="18" height="22" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 2C6 2 2 16 2 21a10 8 0 0 0 20 0C22 16 18 2 12 2Z" fill="#fff6dc" stroke="#b99357" stroke-width="2"/><path d="M7 18q-2 5 1 6" fill="none" stroke="#e5cc9e" stroke-width="2"/></svg>';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

const app = document.querySelector('#app');
let oasis, game, intent = { type: 'buy', item: 'palms' }, selected = null;
let avatarPosition = { x: 0.45, y: 0.77 };
let inventoryBusy = false;
const trading = mountTrading({ getOasis: () => oasis, setOasis: data => { oasis = data; sync(); }, say });
const skinOptions = ['#7a4b33', '#a86843', '#d49a6c', '#efc299'];
const hairOptions = ['#191719', '#493128', '#7a4932', '#e8cf86', '#e7eaf0'];
const clothesOptions = ['#ee9b52', '#4b9aaf', '#ad6e96', '#d6ad4d'];

function say(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(say.timer);
  say.timer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function shell() {
  app.innerHTML = `<main class="shell">
    <header class="topbar"><div class="brand"><span class="brand-icon">✦</span><div><small>LEARNWITHBIN</small><strong>My Oasis</strong></div></div>
      <div class="top-actions"><div class="star-balance"><span>★</span> <b id="stars">0</b> <small>STARS</small></div><button id="edit" class="round" title="Edit your name and avatar">⚙</button></div></header>
    <section class="stage"><div id="scene"></div><div class="world-avatar" id="world-avatar"></div><div class="scene-title"><span>MY LITTLE WORLD</span><h1 id="title"></h1></div><div class="welcome-tip" id="tip">Tap sand to walk · drag to explore</div></section>
    <nav class="world-controls" aria-label="Explore your Oasis">
      <div class="world-buttons"><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="whole-oasis" type="button">Whole Oasis</button><button id="follow-me" type="button">Follow me</button><button id="animal-menu" type="button">Animals</button></div>
      <span class="world-status" id="world-status"></span><span class="egg-basket" id="egg-basket">${eggIcon} 0 eggs</span><span class="land-progress" id="land-progress">Your land grows as you build</span>
    </nav>
    <nav class="shop" aria-label="Build menu"><div class="shop-heading"><b>Build your Oasis</b><span>Choose an item, then tap a glowing spot</span></div>
      <button class="shop-item active" data-type="palms"><img src="${asset('date-palms.webp')}" alt="Date palms"/><span>Date palms</span><b>★ 2</b></button>
      <button class="shop-item" data-type="tent"><img src="${asset('tent.webp')}" alt="Canvas tent"/><span>Canvas tent</span><b>★ 4</b></button>
      <button class="shop-item" data-type="goat"><img src="${asset('baby-goat.svg')}" alt="Baby goat"/><span>Baby goat</span><b>★ 8</b></button>
      <button class="shop-item" data-type="pen"><img src="${asset('animal-pen.svg')}" alt="Goat pen"/><span>Goat pen</span><small>room for 6</small><b>★ 12</b></button>
      <button class="shop-item" data-type="chicken"><img src="${asset('chicken.svg')}" alt="Chicken"/><span>Chicken</span><b>★ 6</b></button>
      <button class="shop-item" data-type="coop"><img src="${asset('chicken-coop.svg')}" alt="Chicken coop"/><span>Chicken coop</span><small>room for 6</small><b>★ 12</b></button>
      <button class="shop-item move" data-type="move"><span class="move-icon">↔</span><span>Rearrange</span><small>free</small></button>
      <button class="shop-item trades" id="class-trades" data-type="trade"><span class="move-icon">⇄</span><span>Class trades</span><small>items or stars</small><b id="trade-count" hidden></b></button>
    </nav><div id="toast" class="toast" role="status" hidden></div>
    <div id="modal-root"></div>${isPreview ? '<span class="preview-label">PRIVATE PREVIEW</span>' : ''}
  </main>`;
  document.querySelector('#edit').onclick = () => showProfile();
  document.querySelectorAll('.shop-item').forEach(button => button.onclick = () => {
    if (button.dataset.type === 'trade') return trading.open();
    selected = null;
    const type = button.dataset.type;
    intent = type === 'move' ? { type: 'move' } : { type: 'buy', item: type };
    document.querySelectorAll('.shop-item').forEach(b => b.classList.toggle('active', b === button));
    document.querySelector('#tip').textContent = type === 'move' ? 'Tap an item, then tap an empty spot' : isPen(type)?'Tap a roomy glowing spot to build a pen':'Tap sand to walk · drag to explore';
    game?.refresh();
  });
  game = mountGame('scene', () => oasis, handleSpot, handleItem, handleWalk, projectAvatar, () => intent);
  document.querySelector('#zoom-in').onclick = () => game.zoom(1);
  document.querySelector('#zoom-out').onclick = () => game.zoom(-1);
  document.querySelector('#whole-oasis').onclick = () => game.overview();
  document.querySelector('#follow-me').onclick = () => game.follow();
  document.querySelector('#animal-menu').onclick = showAnimals;
  document.addEventListener('keydown', handleWalkKey);
  sync();
  if (!oasis.oasis_name) showProfile();
  trading.refreshBadge();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') trading.refreshBadge();
  });
}

function sync() {
  document.querySelector('#stars').textContent = oasis.stars;
  document.querySelector('#egg-basket').innerHTML=`${eggIcon} ${oasis.eggs||0} ${(oasis.eggs||0)===1?'egg':'eggs'}`;
  document.querySelector('#title').textContent = oasis.oasis_name || 'Your Oasis';
  document.querySelector('#world-avatar').innerHTML = avatarMarkup(oasis.avatar, { eggs: oasis.eggs || 0 });
  document.querySelector('#world-status').textContent = `${oasis.items.length} / ${capacity(oasis)} items`;
  document.querySelector('#land-progress').textContent = (oasis.land_level || 1) < 4 ? 'Your land grows as you build' : 'Room for 32 items';
  game?.refresh();
}

function projectAvatar(view) {
  const avatar = document.querySelector('#world-avatar');
  const canvas = document.querySelector('#scene canvas');
  if (!canvas) return;
  avatar.style.left = `${canvas.offsetLeft + view.x * canvas.clientWidth}px`;
  avatar.style.top = `${canvas.offsetTop + view.y * canvas.clientHeight}px`;
  avatar.style.height = `${view.height * canvas.clientHeight}px`;
  avatar.classList.toggle('walking', view.walking);
  avatar.classList.toggle('face-left', view.facingLeft);
  avatarPosition = {x:view.worldX,y:view.worldY};
  avatar.dataset.worldX = view.worldX;
  avatar.dataset.worldY = view.worldY;
  avatar.dataset.zoom = view.zoom;
}

function handleWalk(x, y) {
  if (document.querySelector('.scrim') || !oasis?.oasis_name) return;
  if (!game.walkTo(x,y)) say('Tap the sand inside your land to walk.');
}

function handleWalkKey(event) {
  if (document.querySelector('.scrim') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  const direction = { ArrowUp: [0, -.045], ArrowDown: [0, .045], ArrowLeft: [-.04, 0], ArrowRight: [.04, 0], w: [0, -.045], s: [0, .045], a: [-.04, 0], d: [.04, 0] }[event.key];
  if (!direction) return;
  event.preventDefault();
  handleWalk(avatarPosition.x + direction[0], avatarPosition.y + direction[1]);
}

function showProfile() {
  const root = document.querySelector('#modal-root');
  let avatar = { ...oasis.avatar };
  root.innerHTML = `<div class="scrim"><form class="profile" id="profile-form"><div class="kicker">WELCOME TO YOUR OASIS</div>
    <h2>Make this place yours</h2><p>Choose a name and customize the character who lives here.</p>
    <label for="oasis-name">Oasis name</label><input id="oasis-name" maxlength="32" minlength="2" required autocomplete="off" placeholder="My Oasis" />
    <div class="avatar-preview" id="avatar-preview"></div><div class="color-group"><span>Skin tone</span><div id="skin-options"></div></div>
    <div class="color-group"><span>Hair color</span><div id="hair-options"></div></div><div class="color-group"><span>Clothing</span><div id="clothes-options"></div></div>
    <button class="primary" type="submit">Enter my Oasis →</button><div class="form-error" id="form-error" role="alert"></div>
  </form></div>`;
  const form = document.querySelector('#profile-form');
  form.querySelector('#oasis-name').value = oasis.oasis_name || '';
  const draw = () => {
    document.querySelector('#avatar-preview').innerHTML = avatarMarkup(avatar);
    [['skin', skinOptions], ['hair', hairOptions], ['clothes', clothesOptions]].forEach(([part, choices]) => {
      const row = document.querySelector(`#${part}-options`);
      row.innerHTML = '';
      choices.forEach(color => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `swatch ${avatar[part] === color ? 'chosen' : ''}`;
        b.style.background = color; b.setAttribute('aria-label', part === 'hair' && color === '#e8cf86' ? 'Blonde hair' : part === 'hair' && color === '#e7eaf0' ? 'White hair' : `${part} ${color}`);
        b.onclick = () => { avatar[part] = color; draw(); };
        row.append(b);
      });
    });
  };
  draw();
  form.onsubmit = async event => {
    event.preventDefault();
    const name = form.querySelector('#oasis-name').value.trim();
    if (name.length < 2) return;
    const button = form.querySelector('.primary'); button.disabled = true;
    try { oasis = await updateProfile(name, avatar); root.innerHTML = ''; sync(); }
    catch (error) { form.querySelector('#form-error').textContent = error.message; button.disabled = false; }
  };
}

async function handleSpot(index) {
  if (document.querySelector('.scrim') || inventoryBusy) return;
  if (!oasis.oasis_name) return showProfile();
  inventoryBusy = true;
  const oldLevelForView = oasis.land_level || 1;
  try {
    if (intent.type === 'animal-home') {
      oasis = await setAnimalHome(index); intent = {type:'buy',item:'goat'};
      document.querySelectorAll('.shop-item').forEach(button=>button.classList.toggle('active',button.dataset.type==='goat'));
      document.querySelector('#tip').textContent = 'Tap sand to walk · drag to explore';
      say('Your animals are walking to their new home.');
    } else if (intent.type === 'move') {
      if (!selected) return say('Tap an item first, then choose where to move it.');
      oasis = await moveItem(selected.id, index); selected = null; say('Your item has moved.');
    } else {
      const oldLevel = oasis.land_level || 1;
      oasis = await buyItem(intent.item, index);
      if ((oasis.land_level || 1) > oldLevel) {
        say('Your Oasis grew! New ground is open around your land.');
      } else say(isAnimal(intent.item) ? 'Your new animal has joined the home group.' : `Added ${itemLabel(intent.item).toLowerCase()} to your Oasis!`);
    }
    sync();
    if(intent.type==='buy'&&isPen(intent.item)){const pen=oasis.items.find(i=>isPen(i.item_type)&&i.slot_index===index);if(pen)showPen(pen);}
    if ((oasis.land_level || 1) > oldLevelForView) game.overview();
  } catch (error) { say(error.message); } finally { inventoryBusy = false; }
}

function handleItem(item) {
  if (document.querySelector('.scrim')) return;
  if (intent.type === 'move') return selectItemToMove(item);
  if(isPen(item.item_type))return showPen(item);
  const root = document.querySelector('#modal-root');
  const label = itemLabel(item.item_type);
  const refund = ITEMS[item.item_type].refund;
  root.innerHTML = `<div class="scrim"><section class="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
    <div class="kicker">YOUR OASIS</div><h2 id="item-dialog-title">${label}</h2>
    <p>What would you like to do with this item?</p>
    <div class="dialog-actions"><button type="button" id="choose-move">Move it</button><button type="button" id="choose-sell">Sell for ★ ${refund}</button></div>
    ${isAnimal(item.item_type) ? `<div class="animal-actions"><button id="choose-companion" type="button">${oasis.companion_item_id===item.id?'Send home':'Follow me'}</button><button id="add-animal" type="button">Add another ${label.toLowerCase()} · ★ ${ITEMS[item.item_type].cost}</button></div>` : ''}
    <button type="button" class="item-trade" id="choose-trade">Offer to a classmate</button>
    <button type="button" class="dialog-cancel" id="close-item">Keep it here</button><div class="form-error" id="item-error" role="alert"></div>
  </section></div>`;
  if (isAnimal(item.item_type)) {
    root.querySelector('#choose-move').textContent = animalPen(oasis,item)?'Manage its pen':'Move animal home';
    root.querySelector('#choose-companion').onclick = () => animalAction(() => setAnimalCompanion(oasis.companion_item_id===item.id?null:item.id));
    root.querySelector('#add-animal').onclick = () => animalAction(() => buyItem(item.item_type,animalHomeSlot(oasis)??oasis.items.find(i=>isAnimal(i.item_type)).slot_index), 'Your new animal has joined the home group.');
  }
  root.querySelector('#close-item').onclick = () => { root.innerHTML = ''; };
  root.querySelector('#choose-move').onclick = () => { root.innerHTML = ''; selectItemToMove(item); };
  root.querySelector('#choose-trade').onclick = () => trading.open(item.id);
  root.querySelector('#choose-sell').onclick = () => {
    const dialog = root.querySelector('.item-dialog');
    dialog.querySelector('p').textContent = `Sell this ${label.toLowerCase()} and receive ${refund} ${refund === 1 ? 'star' : 'stars'}?`;
    dialog.querySelector('.dialog-actions').innerHTML = `<button type="button" id="confirm-sell">Yes, sell it</button>`;
    dialog.querySelector('#close-item').textContent = 'Cancel';
    dialog.querySelector('#confirm-sell').onclick = async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await sellItem(item.id);
        oasis = result.oasis; selected = null; root.innerHTML = ''; sync();
        say(`Sold for ${result.refund} ${result.refund === 1 ? 'star' : 'stars'}.`);
      } catch (error) {
        dialog.querySelector('#item-error').textContent = error.message;
        button.disabled = false;
      }
    };
  };
}

function selectItemToMove(item) {
  if(isAnimal(item.item_type)) {const pen=animalPen(oasis,item);return pen?showPen(pen):chooseAnimalHome();}
  intent = { type: 'move', item:item.item_type, id:item.id };
  document.querySelectorAll('.shop-item').forEach(b => b.classList.toggle('active', b.dataset.type === 'move'));
  selected = item;
  document.querySelector('#tip').textContent = 'Tap an empty spot to move this item';
  game.refresh();
  say('Now tap an empty glowing space to move this item.');
}

function chooseAnimalHome() {
  document.querySelector('#modal-root').innerHTML='';
  intent={type:'animal-home'};selected=null;
  document.querySelector('#tip').textContent='Tap a clear glowing spot for the shared animal home';
  game.refresh();
  say('Choose one spot for animals that live outside a pen.');
}

async function animalAction(action,message) {
  if(inventoryBusy)return;
  inventoryBusy=true;
  const oldLevel=oasis.land_level||1;
  try {
    oasis=await action();document.querySelector('#modal-root').innerHTML='';sync();
    if((oasis.land_level||1)>oldLevel)game.overview();
    say(message || (oasis.companion_item_id?'Your companion will follow you. The others stay home.':'Your companion is walking home.'));
  } catch(error) {
    const field=document.querySelector('#item-error');
    if(field)field.textContent=error.message;else say(error.message);
  } finally {inventoryBusy=false;}
}

function showAnimals() {
  const animals=ownedAnimals(oasis),root=document.querySelector('#modal-root');
  root.innerHTML=`<div class="scrim"><section class="item-dialog animal-dialog" role="dialog" aria-modal="true" aria-labelledby="animals-title">
    <div class="kicker">YOUR OASIS</div><h2 id="animals-title">Your animals</h2>
    <p>${animals.length?'Choose one companion to follow you. Animals return to their pen or shared home.':'Buy an animal from the build menu to start your home group.'}</p>
    <div class="animal-list">${animals.map((item,index)=>`<div class="animal-card"><img src="${asset(ITEMS[item.item_type].image)}" alt=""/><span>${itemLabel(item.item_type)} ${index+1}<small>${oasis.companion_item_id===item.id?'Your companion':animalPen(oasis,item)?`Pen ${ownedPens(oasis).findIndex(p=>p.id===item.pen_item_id)+1}`:'Shared home'}</small></span><button type="button" data-pet="${item.id}">${oasis.companion_item_id===item.id?'Send home':'Follow me'}</button></div>`).join('')}</div>
    ${ownedPens(oasis).map((pen,index)=>`<button type="button" class="item-trade" data-pen="${pen.id}">${itemLabel(pen.item_type)} ${index+1} · ${penResidents(oasis,pen).length}/6 animals</button>`).join('')}
    ${animals.some(i=>!animalPen(oasis,i))?'<button type="button" id="move-animal-home" class="item-trade">Move animal home</button>':''}
    <button type="button" id="close-animals" class="dialog-cancel">Close animals</button><div id="item-error" class="form-error" role="alert"></div>
  </section></div>`;
  root.querySelector('#close-animals').onclick=()=>{root.innerHTML='';};
  root.querySelector('#move-animal-home')?.addEventListener('click',chooseAnimalHome);
  root.querySelectorAll('[data-pen]').forEach(button=>button.onclick=()=>showPen(ownedPens(oasis).find(p=>p.id===button.dataset.pen)));
  root.querySelectorAll('[data-pet]').forEach(button=>button.onclick=()=>animalAction(()=>setAnimalCompanion(oasis.companion_item_id===button.dataset.pet?null:button.dataset.pet)));
}

function showPen(pen) {
 const root=document.querySelector('#modal-root'),animals=ownedAnimals(oasis).filter(i=>i.item_type===penSpecies(pen)),eggs=eggCollection(oasis);
 const number=ownedPens(oasis).findIndex(p=>p.id===pen.id)+1;
 root.innerHTML=`<div class="scrim"><section class="item-dialog animal-dialog" role="dialog" aria-modal="true" aria-labelledby="pen-title">
  <div class="kicker">ON YOUR OASIS</div><h2 id="pen-title">${itemLabel(pen.item_type)} ${number}</h2>
  <p>Choose up to six ${penSpecies(pen)==='chicken'?'chickens':'goats'} to live here. Your pet can come out with you and return through the gate.</p>
  ${pen.item_type==='coop'?`<div class="egg-collection"><b>${eggIcon} Your basket: ${oasis.eggs||0} ${(oasis.eggs||0)===1?'egg':'eggs'}</b><p>${!eggs.count?'House your chickens here to start collecting eggs.':eggs.ready?'One egg per housed chicken is ready to collect.':`Next eggs in ${Math.ceil(eggs.wait/3600000)} hours. Collect once every 24 hours.`}</p><button type="button" id="collect-eggs" class="primary" ${eggs.ready?'':'disabled'}>Collect ${eggs.count} ${eggs.count===1?'egg':'eggs'}</button></div>`:''}
  <div class="pen-count" id="pen-count"></div>
  <div class="animal-list">${animals.map((item,index)=>`<label class="animal-card pen-animal"><img src="${asset(ITEMS[item.item_type].image)}" alt=""/><span>${itemLabel(item.item_type)} ${index+1}<small>${animalPen(oasis,item)?`Lives in pen ${ownedPens(oasis).findIndex(p=>p.id===item.pen_item_id)+1}`:'Lives at the shared home'}</small></span><input type="checkbox" value="${item.id}" ${item.pen_item_id===pen.id?'checked':''} aria-label="House ${itemLabel(item.item_type).toLowerCase()} ${index+1}"/></label>`).join('')}</div>
  ${animals.length?'<button type="button" class="primary" id="save-pen">Save animals</button>':'<p>Buy animals from the build menu, then return here to choose their home.</p>'}
  <div class="dialog-actions"><button type="button" id="move-pen">Move pen</button><button type="button" id="sell-pen">Sell for ★ 6</button></div>
  <button type="button" class="dialog-cancel" id="close-pen">Keep it here</button><div class="form-error" id="item-error" role="alert"></div>
 </section></div>`;
 root.querySelector('#collect-eggs')?.addEventListener('click',()=>animalAction(async()=>{const result=await collectEggs();say(`Collected ${result.count} ${result.count===1?'egg':'eggs'}!`);return result.oasis;},'Eggs added to your basket!'));
 const selectedAnimals=()=>Array.from(root.querySelectorAll('input:checked'),input=>input.value);
 const update=()=>{const n=selectedAnimals().length;root.querySelector('#pen-count').textContent=`${n} / ${PEN_CAPACITY} animals`;const save=root.querySelector('#save-pen');if(save)save.disabled=n>PEN_CAPACITY;};
 root.querySelectorAll('input').forEach(input=>input.onchange=update);update();
 root.querySelector('#save-pen')?.addEventListener('click',()=>animalAction(()=>setPenAnimals(pen.id,selectedAnimals()),'Your animals are walking to their pen.'));
 root.querySelector('#move-pen').onclick=()=>{root.innerHTML='';selectItemToMove(pen);};
 root.querySelector('#close-pen').onclick=()=>{root.innerHTML='';};
 root.querySelector('#sell-pen').onclick=()=>{
  root.querySelector('p').textContent='Sell this pen for 6 stars? Its animals will return to the shared home.';
  const button=root.querySelector('#sell-pen');button.textContent='Yes, sell pen';
  button.onclick=()=>animalAction(async()=>{const result=await sellItem(pen.id);return result.oasis;},'Pen sold for 6 stars. Your animals still belong to you.');
 };
}

app.innerHTML = '<div class="loading">Opening your Oasis…</div>';
enterOasis().then(data => { oasis = data; shell(); }).catch(error => {
  app.innerHTML = `<div class="entry-error"><h1>My Oasis</h1><p></p><small>LearnWithBin</small></div>`;
  app.querySelector('p').textContent = error.message;
});
