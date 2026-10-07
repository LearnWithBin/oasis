import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key) : null;
const preview = new URLSearchParams(location.search).has('preview');
const STORAGE_KEY = 'learnwithbin-oasis-preview-v1';
const initial = () => ({ id: 'preview', oasis_name: '', avatar: { skin: '#a86843', hair: '#191719', clothes: '#ee9b52' }, stars: 6, items: [] });

function readPreview() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initial(); }
  catch { return initial(); }
}
function savePreview(oasis) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(oasis));
  return oasis;
}
function errorMessage(error) { throw new Error(error?.message || 'Please try again.'); }

export const isPreview = preview;
export const configured = Boolean(client);

export async function enterOasis() {
  if (preview) return readPreview();
  if (!client) throw new Error('The Oasis has not been connected to its database yet.');
  const { data: session } = await client.auth.getSession();
  if (!session.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) errorMessage(error);
  }
  const invite = new URLSearchParams(location.search).get('invite');
  if (invite) {
    const { error } = await client.functions.invoke('redeem-invite', { body: { invite } });
    if (error) errorMessage(error);
    history.replaceState(null, '', location.pathname);
  }
  const { data, error } = await client.from('oases').select('id,oasis_name,avatar,stars,items(id,item_type,slot_index)').single();
  if (error) throw new Error(invite ? error.message : 'Open your personal Oasis link to enter.');
  return data;
}

export async function updateProfile(name, avatar) {
  if (preview) return savePreview({ ...readPreview(), oasis_name: name, avatar });
  const { error } = await client.rpc('set_oasis_profile', { p_name: name, p_avatar: avatar });
  if (error) errorMessage(error);
  return enterOasis();
}

export async function buyItem(itemType, slotIndex) {
  if (preview) {
    const oasis = readPreview();
    const cost = itemType === 'tent' ? 4 : 2;
    if (oasis.stars < cost || oasis.items.some(x => x.slot_index === slotIndex)) throw new Error('That spot is unavailable or you need more stars.');
    oasis.stars -= cost;
    oasis.items.push({ id: crypto.randomUUID(), item_type: itemType, slot_index: slotIndex });
    return savePreview(oasis);
  }
  const { error } = await client.rpc('purchase_item', { p_type: itemType, p_slot: slotIndex });
  if (error) errorMessage(error);
  return enterOasis();
}

export async function moveItem(itemId, slotIndex) {
  if (preview) {
    const oasis = readPreview();
    if (oasis.items.some(x => x.slot_index === slotIndex)) throw new Error('That spot is occupied.');
    const item = oasis.items.find(x => x.id === itemId);
    if (!item) throw new Error('Item not found.');
    item.slot_index = slotIndex;
    return savePreview(oasis);
  }
  const { error } = await client.rpc('move_item', { p_item: itemId, p_slot: slotIndex });
  if (error) errorMessage(error);
  return enterOasis();
}

export async function sellItem(itemId) {
  if (preview) {
    const oasis = readPreview();
    const item = oasis.items.find(x => x.id === itemId);
    if (!item) throw new Error('That item is not in your Oasis.');
    const refund = item.item_type === 'tent' ? 2 : 1;
    oasis.items = oasis.items.filter(x => x.id !== itemId);
    oasis.stars += refund;
    return { oasis: savePreview(oasis), refund };
  }
  const { data: refund, error } = await client.rpc('sell_item', { p_item: itemId });
  if (error) errorMessage(error);
  return { oasis: await enterOasis(), refund };
}

export async function getTrading() {
  if (preview) return { peers: [], offers: [] };
  const [peers, offers] = await Promise.all([
    client.rpc('trade_peers'), client.rpc('my_trade_offers')
  ]);
  if (peers.error || offers.error) errorMessage(peers.error || offers.error);
  return { peers: peers.data || [], offers: offers.data || [] };
}

export async function createTrade({ recipient, item, wantedType, starPrice }) {
  if (preview) throw new Error('Class trades are available through your personal Oasis link.');
  const { data, error } = await client.rpc('create_trade_offer', {
    p_recipient: recipient, p_item: item,
    p_wanted_type: wantedType || null, p_star_price: starPrice ?? null
  });
  if (error) errorMessage(error);
  return data;
}

export async function resolveTrade(offer, accept, paymentItem = null) {
  if (preview) throw new Error('Class trades are available through your personal Oasis link.');
  const { data, error } = await client.rpc('resolve_trade_offer', {
    p_offer: offer, p_accept: accept, p_payment_item: paymentItem
  });
  if (error) errorMessage(error);
  return { status: data, oasis: await enterOasis() };
}
