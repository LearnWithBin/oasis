import { createClient } from '@supabase/supabase-js';
import { ITEMS, capacity, landLevelForCount } from './catalog.js';
import { PEN_CAPACITY, ownedPens, penLocationAvailable, buildingClearOfPens } from './pens.js';
import { isAnimal, animalHomeSlot } from './animals.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = url && key ? createClient(url, key) : null;
const preview = new URLSearchParams(location.search).has('preview');
const STORAGE_KEY = 'learnwithbin-oasis-preview-v1';
const initial = () => ({ id: 'preview', oasis_name: '', avatar: { skin: '#a86843', hair: '#191719', clothes: '#ee9b52' }, stars: 6, items: [] });

function readPreview() {
  try {
    const oasis = JSON.parse(localStorage.getItem(STORAGE_KEY)) || initial();
    oasis.land_level = Math.max(oasis.land_level || 1, landLevelForCount(oasis.items.length));
    normalizePens(oasis);
    oasis.animal_home_slot = animalHomeSlot(oasis);
    if (!oasis.items.some(i=>i.id===oasis.companion_item_id&&isAnimal(i.item_type))) oasis.companion_item_id=null;
    return oasis;
  }
  catch { return initial(); }
}
function normalizePens(oasis) {
  for(const item of oasis.items)if(!isAnimal(item.item_type)||!ownedPens(oasis).some(p=>p.id===item.pen_item_id))item.pen_item_id=null;
}
function savePreview(oasis) {
  normalizePens(oasis);
  oasis.land_level = Math.max(oasis.land_level || 1, landLevelForCount(oasis.items.length));
  oasis.animal_home_slot = animalHomeSlot(oasis);
  if (!oasis.items.some(i=>i.id===oasis.companion_item_id&&isAnimal(i.item_type))) oasis.companion_item_id=null;
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
  const { data, error } = await client.from('oases').select('id,oasis_name,avatar,stars,land_level,animal_home_slot,companion_item_id,items:items!items_oasis_id_fkey(id,item_type,slot_index,pen_item_id)').single();
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
    const cost = ITEMS[itemType]?.cost;
    if (!cost || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity(oasis)) throw new Error('That land has not opened yet.');
    if (oasis.stars < cost) throw new Error('Save more stars to buy this item.');
    if(itemType==='pen'&&!penLocationAvailable(oasis,slotIndex))throw new Error('Choose a roomy, dry spot for the pen.');
    if(!isAnimal(itemType)&&itemType!=='pen'&&!buildingClearOfPens(oasis,slotIndex))throw new Error('Leave room around the animal pen.');
    const occupant = oasis.items.find(x=>x.slot_index===slotIndex);
    if (!isAnimal(itemType) && itemType!=='pen' && slotIndex===animalHomeSlot(oasis)) throw new Error('Move the animal home before building here.');
    if (occupant) {
      if (!isAnimal(occupant.item_type)) throw new Error('That spot is occupied.');
      const free = Array.from({length:capacity(oasis)},(_,i)=>i).find(i=>!oasis.items.some(x=>x.slot_index===i));
      if (free==null) throw new Error('Your inventory is full.');
      if (isAnimal(itemType)) slotIndex=free; else occupant.slot_index=free;
    }
    if (isAnimal(itemType) && oasis.animal_home_slot==null) oasis.animal_home_slot=slotIndex;
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
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity(oasis)) throw new Error('That land has not opened yet.');
    const item = oasis.items.find(x => x.id === itemId);
    if (!item) throw new Error('Item not found.');
    if(item.item_type==='pen'&&!penLocationAvailable(oasis,slotIndex,item.id))throw new Error('Choose a roomy, dry spot for the pen.');
    if(!isAnimal(item.item_type)&&item.item_type!=='pen'&&!buildingClearOfPens(oasis,slotIndex,item.id))throw new Error('Leave room around the animal pen.');
    if (item.slot_index===slotIndex) return savePreview(oasis);
    if (!isAnimal(item.item_type) && item.item_type!=='pen' && slotIndex===animalHomeSlot(oasis)) throw new Error('Move the animal home before building here.');
    const occupant=oasis.items.find(x=>x.slot_index===slotIndex);
    if (occupant) {
      if (isAnimal(item.item_type)||!isAnimal(occupant.item_type)) throw new Error('That spot is occupied.');
      occupant.slot_index=item.slot_index;
    }
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
    const refund = ITEMS[item.item_type].refund;
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

export async function setAnimalHome(slot) {
  if (preview) {
    const oasis=readPreview();
    if(!Number.isInteger(slot)||slot<0||slot>=capacity(oasis)) throw new Error('That land has not opened yet.');
    if(!oasis.items.some(i=>isAnimal(i.item_type))) throw new Error('Buy an animal first.');
    if(oasis.items.some(i=>i.slot_index===slot&&!isAnimal(i.item_type))) throw new Error('Choose a clear spot for the animal home.');
    oasis.animal_home_slot=slot;return savePreview(oasis);
  }
  const {error}=await client.rpc('set_animal_home',{p_slot:slot});
  if(error) errorMessage(error);
  return enterOasis();
}
export async function setAnimalCompanion(itemId) {
  if(preview) {
    const oasis=readPreview();
    if(itemId&&!oasis.items.some(i=>i.id===itemId&&isAnimal(i.item_type))) throw new Error('Choose an animal you own.');
    oasis.companion_item_id=itemId;return savePreview(oasis);
  }
  const {error}=await client.rpc('set_animal_companion',{p_item:itemId});
  if(error) errorMessage(error);
  return enterOasis();
}

export async function setPenAnimals(penId,animalIds) {
 if(preview){
  const oasis=readPreview();
  if(!ownedPens(oasis).some(p=>p.id===penId))throw new Error('Choose a pen you own.');
  if(new Set(animalIds).size!==animalIds.length||animalIds.length>PEN_CAPACITY)throw new Error('This pen has room for six animals.');
  if(animalIds.some(id=>!oasis.items.some(i=>i.id===id&&isAnimal(i.item_type))))throw new Error('Choose animals you own.');
  for(const item of oasis.items){if(item.pen_item_id===penId)item.pen_item_id=null;if(animalIds.includes(item.id))item.pen_item_id=penId;}
  return savePreview(oasis);
 }
 const {error}=await client.rpc('set_pen_animals',{p_pen:penId,p_animals:animalIds});
 if(error)errorMessage(error);return enterOasis();
}
