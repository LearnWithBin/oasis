import './style.css';
import { enterOasis, updateProfile, buyItem, moveItem, sellItem, isPreview } from './backend.js';
import { mountGame } from './game.js';
import { avatarMarkup } from './avatar.js';
import { mountTrading } from './trading.js';
import { ITEMS, LAND_NAMES, itemLabel } from './catalog.js';
import { isDryGround } from './ground.js';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

const app = document.querySelector('#app');
let oasis, game, intent = { type: 'buy', item: 'palms' }, selected = null;
let avatarPosition = { x: 0.45, y: 0.77 }, walkTimer, currentLand = 0;
const landPositions = {};
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
    <section class="stage"><div id="scene"></div><div class="world-avatar" id="world-avatar"></div><div class="scene-title"><span>MY LITTLE WORLD</span><h1 id="title"></h1></div><div class="welcome-tip" id="tip">Tap sand to walk · glowing spaces to build</div></section>
    <nav id="land-nav" class="land-nav" aria-label="Explore your land"></nav>
    <nav class="shop" aria-label="Build menu"><div class="shop-heading"><b>Build your Oasis</b><span>Choose an item, then tap a glowing spot</span></div>
      <button class="shop-item active" data-type="palms"><img src="${asset('date-palms.webp')}" alt="Date palms"/><span>Date palms</span><b>★ 2</b></button>
      <button class="shop-item" data-type="tent"><img src="${asset('tent.webp')}" alt="Canvas tent"/><span>Canvas tent</span><b>★ 4</b></button>
      <button class="shop-item" data-type="goat"><img src="${asset('baby-goat.svg')}" alt="Baby goat"/><span>Baby goat</span><b>★ 8</b></button>
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
    document.querySelector('#tip').textContent = type === 'move' ? 'Tap an item, then tap an empty spot' : 'Tap sand to walk · glowing spaces to build';
  });
  game = mountGame('scene', () => oasis, handleSpot, handleItem, handleWalk);
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
  document.querySelector('#title').textContent = oasis.oasis_name || 'Your Oasis';
  document.querySelector('#world-avatar').innerHTML = avatarMarkup(oasis.avatar);
  renderLandNav();
  positionAvatar();
  game?.setLand(currentLand);
  game?.refresh();
}

function positionAvatar() {
  const avatar = document.querySelector('#world-avatar');
  avatar.style.left = `${avatarPosition.x * 100}%`;
  avatar.style.top = `${avatarPosition.y * 100}%`;
}

function renderLandNav() {
  const level = oasis.land_level || 1;
  currentLand = Math.min(currentLand, level - 1);
  document.querySelector('.scene-title span').textContent = currentLand === 0 ? 'MY LITTLE WORLD' : LAND_NAMES[currentLand].toUpperCase();
  const nav = document.querySelector('#land-nav');
  nav.innerHTML = LAND_NAMES.slice(0, level).map((name, index) => {
    const count = oasis.items.filter(item => Math.floor(item.slot_index / 8) === index).length;
    return `<button type="button" data-land="${index}" aria-pressed="${currentLand === index}">${name} <small>${count}/8</small></button>`;
  }).join('') + `<span class="land-progress">${level < 4 ? 'More land opens as you build' : 'All 32 spots open'}</span>`;
  nav.querySelectorAll('button').forEach(button => button.onclick = () => {
    if (document.querySelector('.scrim')) return;
    landPositions[currentLand] = { ...avatarPosition };
    currentLand = Number(button.dataset.land);
    avatarPosition = landPositions[currentLand] || { x: .45, y: .77 };
    clearTimeout(walkTimer);
    document.querySelector('#world-avatar').classList.remove('walking');
    document.querySelector('#world-avatar').style.setProperty('--walk-time', '0s');
    sync();
  });
}

// Sample the whole route, preserving the original water-edge behavior at home.
function isDrySand(x, y) {
  if (x < .06 || x > .94 || y < .12 || y > .91) return false;
  return isDryGround(x, y + .08, currentLand);
}

function handleWalk(x, y) {
  if (document.querySelector('.scrim') || !oasis?.oasis_name) return;
  const start = avatarPosition;
  const distance = Math.hypot(x - start.x, y - start.y);
  const steps = Math.max(1, Math.ceil(distance / .02));
  for (let i = 1; i <= steps; i++) {
    if (!isDrySand(start.x + (x - start.x) * i / steps, start.y + (y - start.y) * i / steps)) {
      say('Walk around the water by tapping closer spots on the sand.');
      return;
    }
  }
  if (distance < .01) return;
  const avatar = document.querySelector('#world-avatar');
  clearTimeout(walkTimer);
  avatar.style.setProperty('--walk-time', `${Math.min(2.8, Math.max(.25, distance * 5))}s`);
  avatar.classList.toggle('face-left', x < start.x);
  avatar.classList.add('walking');
  avatarPosition = { x, y };
  positionAvatar();
  walkTimer = setTimeout(() => avatar.classList.remove('walking'), Math.min(2800, Math.max(250, distance * 5000)));
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
  if (document.querySelector('.scrim')) return;
  if (!oasis.oasis_name) return showProfile();
  try {
    if (intent.type === 'move') {
      if (!selected) return say('Tap an item first, then choose where to move it.');
      oasis = await moveItem(selected.id, index); selected = null; say('Your item has moved.');
    } else {
      const oldLevel = oasis.land_level || 1;
      oasis = await buyItem(intent.item, index);
      if ((oasis.land_level || 1) > oldLevel) {
        landPositions[currentLand] = { ...avatarPosition };
        currentLand = oasis.land_level - 1; avatarPosition = { x: .45, y: .77 };
        say('New land opened! More room for your Oasis.');
      } else say(intent.item === 'goat' ? 'Your baby goat is here! Watch it explore.' : `Added ${itemLabel(intent.item).toLowerCase()} to your Oasis!`);
    }
    sync();
  } catch (error) { say(error.message); }
}

function handleItem(item) {
  if (document.querySelector('.scrim')) return;
  if (intent.type === 'move') return selectItemToMove(item);
  const root = document.querySelector('#modal-root');
  const label = itemLabel(item.item_type);
  const refund = ITEMS[item.item_type].refund;
  root.innerHTML = `<div class="scrim"><section class="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
    <div class="kicker">YOUR OASIS</div><h2 id="item-dialog-title">${label}</h2>
    <p>What would you like to do with this item?</p>
    <div class="dialog-actions"><button type="button" id="choose-move">Move it</button><button type="button" id="choose-sell">Sell for ★ ${refund}</button></div>
    <button type="button" class="item-trade" id="choose-trade">Offer to a classmate</button>
    <button type="button" class="dialog-cancel" id="close-item">Keep it here</button><div class="form-error" id="item-error" role="alert"></div>
  </section></div>`;
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
  intent = { type: 'move' };
  document.querySelectorAll('.shop-item').forEach(b => b.classList.toggle('active', b.dataset.type === 'move'));
  selected = item;
  document.querySelector('#tip').textContent = 'Tap an empty spot to move this item';
  say('Now tap an empty glowing space to move this item.');
}

app.innerHTML = '<div class="loading">Opening your Oasis…</div>';
enterOasis().then(data => { oasis = data; shell(); }).catch(error => {
  app.innerHTML = `<div class="entry-error"><h1>My Oasis</h1><p></p><small>LearnWithBin</small></div>`;
  app.querySelector('p').textContent = error.message;
});
