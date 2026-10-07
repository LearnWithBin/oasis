import { enterOasis, getTrading, createTrade, resolveTrade } from './backend.js';

import { itemLabel as label, capacity } from './catalog.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const statusLabels = { accepted: 'Trade complete', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', invalid: 'Item no longer available' };

export function mountTrading({ getOasis, setOasis, say }) {
  let data, panel, root, version = 0;
  let busy = false;

  function close() {
    if (busy) return;
    version++;
    root.innerHTML = '';
    document.querySelector('#class-trades')?.focus();
  }

  function showError(error) {
    const box = panel?.querySelector('#trade-error');
    if (box) { box.textContent = error.message; box.focus(); }
  }

  function updateBadge() {
    const badge = document.querySelector('#trade-count');
    if (!badge) return;
    const count = data?.offers.filter(o => o.direction === 'in' && o.status === 'pending').length || 0;
    badge.hidden = count === 0;
    badge.textContent = count;
    document.querySelector('#class-trades')?.setAttribute('aria-label', count ? `Class trades, ${count} new offers` : 'Class trades');
  }

  async function refreshBadge() {
    try { data = await getTrading(); updateBadge(); } catch { /* The inbox shows actionable errors when opened. */ }
  }

  async function load() {
    const current = ++version;
    const [fresh, trading] = await Promise.all([enterOasis(), getTrading()]);
    if (current !== version || !panel?.isConnected) return false;
    setOasis(fresh);
    data = trading;
    updateBadge();
    return true;
  }

  async function open(itemId = null) {
    root = document.querySelector('#modal-root');
    root.innerHTML = `<div class="scrim"><section class="trade-panel" role="dialog" aria-modal="true" aria-labelledby="trade-title">
      <div class="trade-top"><div><div class="kicker">YOUR CLASS ONLY</div><h2 id="trade-title">Class trades</h2></div><button type="button" class="trade-close" aria-label="Close trades">×</button></div>
      <p class="trade-intro">Swap an item or ask for stars. Nothing changes until your classmate accepts.</p>
      <div id="trade-content" aria-live="polite">Loading your class…</div>
      <p id="trade-error" class="form-error" role="alert" tabindex="-1"></p>
    </section></div>`;
    panel = root.querySelector('.trade-panel');
    panel.querySelector('.trade-close').onclick = close;
    panel.querySelector('.trade-close').focus();
    try { if (await load()) itemId && data.peers.length ? compose(itemId) : inbox(); }
    catch (error) {
      if (!panel.isConnected) return;
      panel.querySelector('#trade-content').innerHTML = '<button type="button" class="trade-retry">Try again</button>';
      panel.querySelector('.trade-retry').onclick = () => open(itemId);
      showError(error);
    }
  }

  function inbox() {
    const body = panel.querySelector('#trade-content');
    panel.querySelector('#trade-error').textContent = '';
    body.innerHTML = `<div class="trade-toolbar"><button type="button" id="new-offer">Make an offer</button><button type="button" id="refresh-trades">Refresh</button></div>
      <div class="trade-sections"></div>`;
    body.querySelector('#new-offer').disabled = !data.peers.length || !getOasis().items.length;
    body.querySelector('#new-offer').onclick = () => compose();
    body.querySelector('#refresh-trades').onclick = async event => {
      event.currentTarget.disabled = true;
      try { if (await load()) inbox(); }
      catch (error) { showError(error); event.target.disabled = false; }
    };
    const sections = body.querySelector('.trade-sections');
    if (!data.peers.length) {
      const p = document.createElement('p');
      p.className = 'trade-empty';
      p.textContent = 'No classmates here yet. They appear after opening their personal Oasis links. The teacher Test Oasis is separate from the student class.';
      sections.append(p);
    } else if (!getOasis().items.length) {
      const p = document.createElement('p'); p.className = 'trade-empty';
      p.textContent = 'Add an item or a baby goat to offer something of your own.'; sections.append(p);
    }
    for (const [title, offers, empty] of [
      ['Offers for you', data.offers.filter(o => o.direction === 'in' && o.status === 'pending'), 'No new offers.'],
      ['Your sent offers', data.offers.filter(o => o.direction === 'out' && o.status === 'pending'), 'You haven’t sent any offers.'],
      ['Recent trades', data.offers.filter(o => o.status !== 'pending'), null]
    ]) {
      if (!offers.length && !empty) continue;
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = title; section.append(heading);
      if (!offers.length) { const p = document.createElement('p'); p.className = 'trade-empty'; p.textContent = empty; section.append(p); }
      for (const offer of offers) section.append(offerCard(offer));
      sections.append(section);
    }
  }

  function offerCard(offer) {
    const card = document.createElement('article'); card.className = 'trade-card';
    const incoming = offer.direction === 'in';
    const price = offer.star_price != null ? `★ ${offer.star_price} stars` : label(offer.wanted_type);
    card.innerHTML = `<div class="trade-person">${incoming ? 'From' : 'To'} ${esc(offer.other_name)}</div>
      <div class="trade-exchange"><div><small>${incoming ? 'You get' : 'You offer'}</small><strong>${esc(label(offer.offered_type))}</strong></div><span aria-hidden="true">⇄</span><div><small>${incoming ? 'You give' : 'You ask for'}</small><strong>${esc(price)}</strong></div></div>`;
    if (offer.status !== 'pending') {
      const p = document.createElement('p'); p.className = 'trade-status'; p.textContent = statusLabels[offer.status] || offer.status; card.append(p);
      return card;
    }
    const expires = document.createElement('p'); expires.className = 'trade-expiry';
    expires.textContent = `Offer ends ${new Date(offer.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`; card.append(expires);
    const actions = document.createElement('div'); actions.className = 'trade-actions';
    if (incoming) {
      const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = 'Review & accept';
      accept.onclick = () => review(offer); actions.append(accept);
    }
    const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.className = 'trade-secondary';
    dismiss.textContent = incoming ? 'Decline' : 'Cancel offer';
    dismiss.onclick = () => resolve(offer, false, null);
    actions.append(dismiss); card.append(actions); return card;
  }

  function compose(itemId) {
    const body = panel.querySelector('#trade-content');
    panel.querySelector('#trade-error').textContent = '';
    const items = getOasis().items;
    // SQL also enforces one pending offer per item; all offered items stay movable.
    body.innerHTML = `<form id="offer-form" class="trade-form">
      <h3>Make an offer</h3>
      <label for="trade-recipient">Send to</label><select id="trade-recipient" required>${data.peers.map(p => `<option value="${esc(p.id)}">${esc(p.oasis_name)}</option>`).join('')}</select>
      <label for="trade-item">Your item</label><select id="trade-item" required>${items.map(i => `<option value="${esc(i.id)}">${esc(label(i.item_type))} · spot ${i.slot_index + 1}</option>`).join('')}</select>
      <label for="trade-wants">Ask for</label><select id="trade-wants"><option value="palms">Date palms</option><option value="tent">Canvas tent</option><option value="goat">Baby goat</option><option value="stars">Stars</option></select>
      <div id="trade-price-row" hidden><label for="trade-price">How many stars?</label><input id="trade-price" type="number" min="1" max="100" step="1" inputmode="numeric" value="2"/></div>
      <p class="trade-note">Your classmate chooses which matching item to give. Offers last 7 days. You can cancel while waiting.</p>
      <div class="trade-actions"><button type="submit">Review offer</button><button type="button" id="offer-back" class="trade-secondary">Back</button></div>
    </form>`;
    const form = body.querySelector('form');
    if (itemId && items.some(i => i.id === itemId)) form.querySelector('#trade-item').value = itemId;
    form.querySelector('#trade-wants').onchange = event => {
      const stars = event.target.value === 'stars';
      form.querySelector('#trade-price-row').hidden = !stars;
      form.querySelector('#trade-price').required = stars;
      form.querySelector('#trade-price').disabled = !stars;
    };
    form.querySelector('#trade-price').disabled = true;
    form.querySelector('#offer-back').onclick = inbox;
    form.onsubmit = event => {
      event.preventDefault();
      const recipient = form.querySelector('#trade-recipient').value;
      const item = form.querySelector('#trade-item').value;
      const choice = form.querySelector('#trade-wants').value;
      const starPrice = choice === 'stars' ? Number(form.querySelector('#trade-price').value) : null;
      if (starPrice != null && (!Number.isInteger(starPrice) || starPrice < 1 || starPrice > 100)) return showError(new Error('Choose a whole number from 1 to 100.'));
      const peer = data.peers.find(p => p.id === recipient), mine = items.find(i => i.id === item);
      if (!peer || !mine) return;
      const offer = { recipient, item, wantedType: choice === 'stars' ? null : choice, starPrice };
      body.innerHTML = `<h3>Ready to send?</h3><p class="trade-summary">Offer your <strong>${esc(label(mine.item_type))}</strong> to <strong>${esc(peer.oasis_name)}</strong> for <strong>${esc(starPrice != null ? `★ ${starPrice} stars` : label(choice))}</strong>.</p>
        <p class="trade-note">Your item stays here until they accept.</p><div class="trade-actions"><button type="button" id="send-offer">Send offer</button><button type="button" id="edit-offer" class="trade-secondary">Back</button></div>`;
      body.querySelector('#edit-offer').onclick = () => {
        compose(item);
        panel.querySelector('#trade-recipient').value = recipient;
        panel.querySelector('#trade-wants').value = choice;
        panel.querySelector('#trade-wants').dispatchEvent(new Event('change'));
        if (starPrice != null) panel.querySelector('#trade-price').value = starPrice;
      };
      body.querySelector('#send-offer').onclick = async () => {
        setBusy(true);
        try { await createTrade(offer); say('Offer sent! Your classmate can respond when they log in.'); if (await load()) inbox(); }
        catch (error) { showError(error); }
        finally { setBusy(false); }
      };
    };
  }

  function review(offer) {
    const body = panel.querySelector('#trade-content');
    panel.querySelector('#trade-error').textContent = '';
    const oasis = getOasis(), paymentItems = oasis.items.filter(i => i.item_type === offer.wanted_type);
    const stars = offer.star_price != null;
    const eligible = stars ? oasis.stars >= offer.star_price && oasis.items.length < capacity(oasis) : paymentItems.length > 0;
    body.innerHTML = `<h3>Accept this trade?</h3><p class="trade-summary">Get <strong>${esc(label(offer.offered_type))}</strong> from <strong>${esc(offer.other_name)}</strong> for <strong>${esc(stars ? `★ ${offer.star_price} stars` : label(offer.wanted_type))}</strong>.</p>
      ${!stars && paymentItems.length ? `<label for="payment-item">Choose your item to give</label><select id="payment-item">${paymentItems.map(i => `<option value="${esc(i.id)}">${esc(label(i.item_type))} · spot ${i.slot_index + 1}</option>`).join('')}</select>` : ''}
      <p class="trade-note">${stars ? `You have ★ ${oasis.stars} stars. The item will go into an empty building spot.` : 'The incoming item will take the place of the item you give.'}</p>
      ${!eligible ? `<p class="form-error">${!stars ? 'You need the requested item to accept.' : oasis.stars < offer.star_price ? 'You need more stars to accept.' : 'Make an empty building spot before accepting.'}</p>` : ''}
      <div class="trade-actions"><button type="button" id="confirm-trade" ${eligible ? '' : 'disabled'}>Yes, accept trade</button><button type="button" id="review-back" class="trade-secondary">Back</button></div>`;
    body.querySelector('#confirm-trade').onclick = () => resolve(offer, true, stars ? null : body.querySelector('#payment-item').value);
    body.querySelector('#review-back').onclick = inbox;
  }

  function setBusy(value) {
    busy = value;
    if (!panel?.isConnected) return;
    panel.querySelector('.trade-close').disabled = value;
    panel.querySelector('#trade-content').inert = value;
    panel.setAttribute('aria-busy', String(value));
  }

  async function resolve(offer, accept, payment) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await resolveTrade(offer.id, accept, payment);
      setOasis(result.oasis);
      say(result.status === 'accepted' ? 'Trade complete! Your Oasis has been updated.' : result.status === 'invalid' ? 'That item is no longer available.' : result.status === 'expired' ? 'That offer has expired.' : result.status === 'cancelled' ? 'Offer cancelled.' : 'Offer declined.');
      if (await load()) inbox();
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }

  document.addEventListener('keydown', event => {
    if (!panel?.isConnected) return;
    if (event.key === 'Escape') { close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => !el.closest('[hidden]') && !el.closest('[inert]'));
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return { open, refreshBadge };
}
