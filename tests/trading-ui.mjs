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
const fixture = {
  oasis: { id: 'self', oasis_name: 'Practice', stars: 10, avatar: { skin: '#a86843', hair: '#e7eaf0', clothes: '#ee9b52' }, items: [
    { id: 'palms-own', item_type: 'palms', slot_index: 0 }, { id: 'tent-own', item_type: 'tent', slot_index: 1 }
  ] },
  peers: [{ id: 'peer', oasis_name: 'Neighbor <img src=x onerror=alert(1)>' }],
  offers: [
    { id: 'incoming-sale', direction: 'in', other_name: 'Neighbor', offered_type: 'tent', wanted_type: null, star_price: 3, status: 'pending', expires_at: '2099-10-14T12:00:00Z' },
    { id: 'incoming-swap', direction: 'in', other_name: 'Neighbor', offered_type: 'tent', wanted_type: 'palms', star_price: null, status: 'pending', expires_at: '2099-10-14T12:00:00Z' }
  ]
};
const calls = [];
await page.route('**/*.supabase.co/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const body = request.postDataJSON() || {};
  let response;
  if (path.startsWith('/auth/')) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', exp, role: 'authenticated' })).toString('base64url')}.test`;
    response = { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };
  } else if (path === '/rest/v1/oases') response = fixture.oasis;
  else if (path.endsWith('/trade_peers')) response = fixture.peers;
  else if (path.endsWith('/my_trade_offers')) response = fixture.offers;
  else if (path.endsWith('/create_trade_offer')) {
    calls.push({ action: 'create', body });
    const item = fixture.oasis.items.find(i => i.id === body.p_item);
    fixture.offers.push({ id: 'outgoing', direction: 'out', other_name: fixture.peers[0].oasis_name, offered_type: item.item_type, wanted_type: body.p_wanted_type, star_price: body.p_star_price, status: 'pending', expires_at: '2099-10-14T12:00:00Z' });
    response = 'outgoing';
  } else if (path.endsWith('/resolve_trade_offer')) {
    calls.push({ action: 'resolve', body });
    const offer = fixture.offers.find(o => o.id === body.p_offer);
    offer.status = body.p_accept ? 'accepted' : offer.direction === 'out' ? 'cancelled' : 'declined';
    if (body.p_accept) {
      if (offer.star_price != null) {
        fixture.oasis.stars -= offer.star_price;
        fixture.oasis.items.push({ id: 'new-tent', item_type: 'tent', slot_index: 2 });
      } else {
        const mine = fixture.oasis.items.find(i => i.id === body.p_payment_item);
        mine.item_type = offer.offered_type;
      }
    }
    response = offer.status;
  } else throw new Error(`Unexpected backend request: ${path}`);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
});
try {
  await page.goto('http://127.0.0.1:5173/oasis/'+(process.env.OASIS_ILLUSTRATED?'?look=illustrated':''));
  await page.getByRole('button', { name: /Class trades/ }).waitFor();
  await page.getByRole('button', { name: /Class trades/ }).click();
  await page.getByRole('heading', { name: 'Offers for you' }).waitFor();
  assert.equal(await page.locator('.trade-card').count(), 2);
  const sale = page.locator('.trade-card').filter({ hasText: '★ 3 stars' });
  await sale.getByRole('button', { name: 'Review & accept' }).click();
  await page.getByRole('button', { name: 'Yes, accept trade' }).click();
  await page.getByText('Trade complete', { exact: true }).waitFor();
  assert.equal(await page.locator('#stars').textContent(), '7');
  assert.equal(fixture.oasis.items.length, 3);
  const swap = page.locator('.trade-card').filter({ has: page.getByRole('button', { name: 'Review & accept' }) });
  await swap.getByRole('button', { name: 'Review & accept' }).click();
  assert.equal(await page.locator('#payment-item').inputValue(), 'palms-own');
  await page.getByRole('button', { name: 'Yes, accept trade' }).click();
  await page.getByRole('button', { name: 'Make an offer' }).waitFor();
  assert.equal(fixture.oasis.items.find(i => i.id === 'palms-own').item_type, 'tent');
  await page.getByRole('button', { name: 'Make an offer' }).click();
  await page.locator('#trade-item').selectOption('tent-own');
  await page.locator('#trade-wants').selectOption('stars');
  await page.locator('#trade-price').fill('5');
  await page.getByRole('button', { name: 'Review offer' }).click();
  await page.getByRole('button', { name: 'Send offer' }).click();
  await page.getByRole('button', { name: 'Cancel offer' }).waitFor();
  assert.equal(calls.find(c => c.action === 'create').body.p_star_price, 5);
  assert.equal(await page.locator('.trade-panel img').count(), 0, 'classmate names must be escaped');
  await page.screenshot({ path: '/tmp/oasis-trading-ipad.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel offer' }).click();
  await page.getByText('Cancelled', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close trades' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Class trades/ }).click();
  await page.getByRole('heading', { name: 'Offers for you' }).waitFor();
  const bounds = await page.locator('.trade-panel').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'phone panel overflow');
  assert.ok(bounds.height <= 844, 'phone vertical overflow');
  await page.screenshot({ path: '/tmp/oasis-trading-phone.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.trade-panel').count(), 0);
  fixture.peers = [];
  await page.getByRole('button', { name: /Class trades/ }).click();
  await page.getByText(/No classmates here yet/).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Make an offer' }).isDisabled());
  assert.deepEqual(errors, []);
  console.log('UI PASS: sale, barter, compose, confirmation, cancellation, safe names, phone/iPad layout, empty class and modal close.');
} catch (error) {
  console.log('Page errors:', errors);
  console.log('Trade panel:', await page.locator('.trade-panel').innerText().catch(() => 'No panel'));
  await page.screenshot({ path: '/tmp/oasis-trading-failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); server.kill(); }
