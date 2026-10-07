-- Permanent room for up to four areas, with eight building spots in each.
alter table public.oases add column land_level integer not null default 1 check(land_level between 1 and 4);
update public.oases o set land_level=least(4,1+((select count(*)::integer from public.items i where i.oasis_id=o.id)+2)/8);
alter table public.items drop constraint items_slot_index_check;
alter table public.items add constraint items_slot_index_check check(slot_index between 0 and 31);
alter table public.items drop constraint items_item_type_check;
alter table public.items add constraint items_item_type_check check(item_type in ('palms','tent','goat'));
alter table public.trade_offers drop constraint trade_offers_wanted_type_check;
alter table public.trade_offers add constraint trade_offers_wanted_type_check check(wanted_type in ('palms','tent','goat'));
alter table public.trade_offers drop constraint trade_offers_offered_type_check;
alter table public.trade_offers add constraint trade_offers_offered_type_check check(offered_type in ('palms','tent','goat'));

create function private.expand_oasis_land()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  -- Deferred until commit, so an item swap counts the final inventory on each side.
  for v_id in select distinct id from (values
    (case when TG_OP<>'DELETE' then NEW.oasis_id end),
    (case when TG_OP<>'INSERT' then OLD.oasis_id end)) ids(id) where id is not null
  loop
    update public.oases o set land_level=greatest(o.land_level,
      least(4,1+((select count(*)::integer from public.items i where i.oasis_id=v_id)+2)/8))
      where o.id=v_id;
  end loop;
  return null;
end $$;
revoke all on function private.expand_oasis_land() from public,anon,authenticated;
create constraint trigger expand_oasis_land after insert or update or delete on public.items
  deferrable initially deferred for each row execute function private.expand_oasis_land();

create or replace function private.purchase_item(p_type text,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_cost integer;
begin
  if p_slot is null or p_type is null or p_type not in ('palms','tent','goat') then
    raise exception 'That item or building spot is unavailable.';
  end if;
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  v_cost:=case p_type when 'goat' then 8 when 'tent' then 4 else 2 end;
  if v_self.stars<v_cost then raise exception 'Save more stars to buy this item.'; end if;
  if exists(select 1 from public.items where oasis_id=v_self.id and slot_index=p_slot) then raise exception 'That spot is occupied.'; end if;
  insert into public.items(oasis_id,item_type,slot_index) values(v_self.id,p_type,p_slot);
  update public.oases set stars=stars-v_cost where id=v_self.id;
  insert into public.star_ledger(oasis_id,source_key,delta) values(v_self.id,'purchase:'||gen_random_uuid()::text,-v_cost);
end $$;

create or replace function private.move_item(p_item uuid,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot is null or p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  if exists(select 1 from public.items where oasis_id=v_self.id and slot_index=p_slot and id<>p_item) then raise exception 'That spot is occupied.'; end if;
  update public.items set slot_index=p_slot where id=p_item and oasis_id=v_self.id;
  if not found then raise exception 'That item is not in your Oasis.'; end if;
end $$;

create or replace function private.sell_item(p_item uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_self uuid; v_type text; v_refund integer;
begin
  select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self is null then raise exception 'Open your personal Oasis link first.'; end if;
  select item_type into v_type from public.items where id=p_item and oasis_id=v_self for update;
  if v_type is null then raise exception 'That item is not in your Oasis.'; end if;
  v_refund:=case v_type when 'goat' then 4 when 'tent' then 2 else 1 end;
  delete from public.items where id=p_item and oasis_id=v_self;
  update public.oases set stars=stars+v_refund where id=v_self;
  insert into public.star_ledger(oasis_id,source_key,delta) values(v_self,'sale:'||p_item::text,v_refund);
  return v_refund;
end $$;

create or replace function private.create_trade_offer(p_recipient uuid,p_item uuid,p_wanted_type text default null,p_star_price integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_recipient public.oases%rowtype; v_type text; v_id uuid;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid());
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  select * into v_recipient from public.oases where id=p_recipient and class_id=v_self.class_id and owner_auth_uid is not null;
  if v_recipient.id is null or v_recipient.id=v_self.id then raise exception 'Choose another student in your class.'; end if;
  -- Every inventory mutation uses Oasis locks before item or offer locks.
  perform 1 from public.oases where id in (v_self.id,v_recipient.id) order by id for update;
  if not exists (select 1 from public.oases where id=v_self.id and owner_auth_uid=(select auth.uid()) and class_id=v_self.class_id)
    or not exists (select 1 from public.oases where id=v_recipient.id and owner_auth_uid is not null and class_id=v_self.class_id) then
    raise exception 'Open your personal Oasis link and choose a current classmate.';
  end if;
  if ((p_wanted_type in ('palms','tent','goat') and p_star_price is null)
     or (p_wanted_type is null and p_star_price between 1 and 100)) is not true then
    raise exception 'Choose one item or a whole star price from 1 to 100.';
  end if;
  select item_type into v_type from public.items where id=p_item and oasis_id=v_self.id;
  if v_type is null then raise exception 'Choose an item you own.'; end if;
  update public.trade_offers set status='expired',resolved_at=now()
    where sender_id=v_self.id and status='pending' and expires_at<=now();
  update public.trade_offers t set status='invalid',resolved_at=now()
    where t.sender_id=v_self.id and t.status='pending' and not exists
      (select 1 from public.items i where i.id=t.offered_item_id and i.oasis_id=v_self.id);
  if exists (select 1 from public.trade_offers where offered_item_id=p_item and status='pending') then
    raise exception 'This item already has an offer. Cancel it before making another.';
  end if;
  insert into public.trade_offers(class_id,sender_id,recipient_id,offered_item_id,offered_type,wanted_type,star_price)
    values(v_self.class_id,v_self.id,v_recipient.id,p_item,v_type,p_wanted_type,p_star_price) returning public.trade_offers.id into v_id;
  return v_id;
end $$;


create or replace function private.resolve_trade_offer(p_offer uuid,p_accept boolean,p_payment_item uuid default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_offer public.trade_offers%rowtype; v_actor public.oases%rowtype;
  v_sender public.oases%rowtype; v_recipient public.oases%rowtype;
  v_offered_slot integer; v_payment_slot integer; v_payment_type text; v_to_slot integer;
begin
  select * into v_actor from public.oases where owner_auth_uid=(select auth.uid());
  if v_actor.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  select * into v_offer from public.trade_offers where id=p_offer and class_id=v_actor.class_id
    and (sender_id=v_actor.id or recipient_id=v_actor.id);
  if v_offer.id is null then raise exception 'This is not your offer.'; end if;
  -- Stable lock order avoids deadlocks with purchases, sales and simultaneous trades.
  perform 1 from public.oases where id in (v_offer.sender_id,v_offer.recipient_id) order by id for update;
  if not exists (select 1 from public.oases where id=v_actor.id and owner_auth_uid=(select auth.uid()) and class_id=v_offer.class_id) then
    raise exception 'Open your personal Oasis link first.';
  end if;
  select * into v_offer from public.trade_offers where id=p_offer for update;
  if v_offer.status<>'pending' then raise exception 'This offer is no longer pending.'; end if;
  if v_offer.expires_at<=now() then
    update public.trade_offers set status='expired',resolved_at=now() where id=p_offer; return 'expired';
  end if;
  if p_accept is not true then
    update public.trade_offers set status=case when v_actor.id=v_offer.sender_id then 'cancelled' else 'declined' end,resolved_at=now() where id=p_offer;
    return case when v_actor.id=v_offer.sender_id then 'cancelled' else 'declined' end;
  end if;
  if v_actor.id<>v_offer.recipient_id then raise exception 'Only the recipient can accept.'; end if;
  select * into v_sender from public.oases where id=v_offer.sender_id and class_id=v_offer.class_id;
  select * into v_recipient from public.oases where id=v_offer.recipient_id and class_id=v_offer.class_id;
  if v_sender.id is null or v_recipient.id is null then raise exception 'The student is no longer in this class.'; end if;
  select slot_index into v_offered_slot from public.items where id=v_offer.offered_item_id and oasis_id=v_sender.id for update;
  if v_offered_slot is null then
    update public.trade_offers set status='invalid',resolved_at=now() where id=p_offer; return 'invalid';
  end if;
  if v_offer.star_price is not null then
    if p_payment_item is not null then raise exception 'This offer is paid in stars.'; end if;
    if v_recipient.stars<v_offer.star_price then raise exception 'You need more stars to accept.'; end if;
    select s into v_to_slot from generate_series(0,v_recipient.land_level*8-1) s where not exists
      (select 1 from public.items where oasis_id=v_recipient.id and slot_index=s) order by s limit 1;
    if v_to_slot is null then raise exception 'Make an empty building spot before accepting.'; end if;
  else
    select slot_index,item_type into v_payment_slot,v_payment_type from public.items
      where id=p_payment_item and oasis_id=v_recipient.id for update;
    if v_payment_slot is null or v_payment_type<>v_offer.wanted_type then raise exception 'Choose one of your requested items.'; end if;
    v_to_slot:=v_payment_slot;
  end if;
  set constraints public.items_oasis_id_slot_index_key deferred;
  if v_offer.wanted_type is not null then
    update public.items set oasis_id=v_sender.id,slot_index=v_offered_slot where id=p_payment_item;
  end if;
  update public.items set oasis_id=v_recipient.id,slot_index=v_to_slot where id=v_offer.offered_item_id;
  if v_offer.star_price is not null then
    update public.oases set stars=stars-v_offer.star_price where id=v_recipient.id;
    update public.oases set stars=stars+v_offer.star_price where id=v_sender.id;
    insert into public.star_ledger(oasis_id,source_key,delta) values
      (v_recipient.id,'trade:'||p_offer::text,-v_offer.star_price),
      (v_sender.id,'trade:'||p_offer::text,v_offer.star_price);
  end if;
  update public.trade_offers set status='accepted',resolved_at=now() where id=p_offer;
  update public.trade_offers set status='invalid',resolved_at=now()
    where id<>p_offer and status='pending' and offered_item_id in (v_offer.offered_item_id,p_payment_item);
  set constraints public.items_oasis_id_slot_index_key immediate;
  return 'accepted';
end $$;

