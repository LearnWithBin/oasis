import './style.css';
import { enterOasis, updateProfile, buyItem, moveItem, sellItem, isPreview } from './backend.js';
import { mountGame } from './game.js';
import { avatarMarkup } from './avatar.js';
const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;

const app = document.querySelector('#app');
let oasis, game, intent = { type: 'buy', item: 'palms' }, selected = null;
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
    <section class="stage"><div id="scene"></div><div class="world-avatar" id="world-avatar"></div><div class="scene-title"><span>MY LITTLE WORLD</span><h1 id="title"></h1></div><div class="welcome-tip" id="tip">Tap a glowing space to build</div></section>
    <nav class="shop" aria-label="Build menu"><div class="shop-heading"><b>Build your Oasis</b><span>Choose an item, then tap a glowing spot</span></div>
      <button class="shop-item active" data-type="palms"><img src="${asset('date-palms.webp')}" alt="Date palms"/><span>Date palms</span><b>★ 2</b></button>
      <button class="shop-item" data-type="tent"><img src="${asset('tent.webp')}" alt="Canvas tent"/><span>Canvas tent</span><b>★ 4</b></button>
      <button class="shop-item move" data-type="move"><span class="move-icon">↔</span><span>Rearrange</span><small>free</small></button>
    </nav><div id="toast" class="toast" role="status" hidden></div>
    <div id="modal-root"></div>${isPreview ? '<span class="preview-label">PRIVATE PREVIEW</span>' : ''}
  </main>`;
  document.querySelector('#edit').onclick = () => showProfile();
  document.querySelectorAll('.shop-item').forEach(button => button.onclick = () => {
    selected = null;
    const type = button.dataset.type;
    intent = type === 'move' ? { type: 'move' } : { type: 'buy', item: type };
    document.querySelectorAll('.shop-item').forEach(b => b.classList.toggle('active', b === button));
    document.querySelector('#tip').textContent = type === 'move' ? 'Tap an item, then tap an empty spot' : 'Tap a glowing space to build';
  });
  game = mountGame('scene', () => oasis, handleSpot, handleItem);
  sync();
  if (!oasis.oasis_name) showProfile();
}

function sync() {
  document.querySelector('#stars').textContent = oasis.stars;
  document.querySelector('#title').textContent = oasis.oasis_name || 'Your Oasis';
  document.querySelector('#world-avatar').innerHTML = avatarMarkup(oasis.avatar);
  game?.refresh();
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
  if (!oasis.oasis_name) return showProfile();
  try {
    if (intent.type === 'move') {
      if (!selected) return say('Tap an item first, then choose where to move it.');
      oasis = await moveItem(selected.id, index); selected = null; say('Your item has moved.');
    } else {
      oasis = await buyItem(intent.item, index); say(`Added ${intent.item === 'tent' ? 'a tent' : 'date palms'} to your Oasis!`);
    }
    sync();
  } catch (error) { say(error.message); }
}

function handleItem(item) {
  if (intent.type === 'move') return selectItemToMove(item);
  const root = document.querySelector('#modal-root');
  const label = item.item_type === 'tent' ? 'Canvas tent' : 'Date palms';
  const refund = item.item_type === 'tent' ? 2 : 1;
  root.innerHTML = `<div class="scrim"><section class="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
    <div class="kicker">YOUR OASIS</div><h2 id="item-dialog-title">${label}</h2>
    <p>What would you like to do with this item?</p>
    <div class="dialog-actions"><button type="button" id="choose-move">Move it</button><button type="button" id="choose-sell">Sell for ★ ${refund}</button></div>
    <button type="button" class="dialog-cancel" id="close-item">Keep it here</button><div class="form-error" id="item-error" role="alert"></div>
  </section></div>`;
  root.querySelector('#close-item').onclick = () => { root.innerHTML = ''; };
  root.querySelector('#choose-move').onclick = () => { root.innerHTML = ''; selectItemToMove(item); };
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
