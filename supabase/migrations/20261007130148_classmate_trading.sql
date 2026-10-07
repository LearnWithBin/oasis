-- Offers are visible only through validated RPCs. No student names or invite keys
-- are shared. Both item ownership and star balances are rechecked at acceptance.
create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  sender_id uuid not null references public.oases(id),
  recipient_id uuid not null references public.oases(id),
  offered_item_id uuid not null,
  wanted_type text check (wanted_type in ('palms','tent')),
  star_price integer check (star_price between 1 and 100),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired','invalid')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  resolved_at timestamptz,
  check (sender_id <> recipient_id),
  check ((wanted_type is null) <> (star_price is null))
);
alter table public.trade_offers enable row level security;
revoke all on public.trade_offers from public, anon, authenticated;
alter table public.trade_offers add column if not exists offered_type text check (offered_type in ('palms','tent'));
update public.trade_offers t set offered_type=i.item_type from public.items i where i.id=t.offered_item_id and t.offered_type is null;
-- Keep offer history after an item is sold. Stale ownership is checked in the RPCs.
alter table public.trade_offers drop constraint if exists trade_offers_offered_item_id_fkey;
create index if not exists trade_offers_sender_lookup on public.trade_offers(sender_id,created_at desc);
create index if not exists trade_offers_recipient_lookup on public.trade_offers(recipient_id,created_at desc);
create index if not exists trade_offers_item_lookup on public.trade_offers(offered_item_id) where status='pending';
-- Swapping two items must work even when both Oases have eight occupied spots.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.items'::regclass and conname='items_oasis_id_slot_index_key' and condeferrable) then
    alter table public.items drop constraint items_oasis_id_slot_index_key;
    alter table public.items add constraint items_oasis_id_slot_index_key unique(oasis_id,slot_index) deferrable initially immediate;
  end if;
end $$;

create or replace function private.trade_peers()
returns table(id uuid, oasis_name text)
language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid());
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  return query select o.id,coalesce(nullif(o.oasis_name,''),'Oasis '||o.student_number::text)
    from public.oases o where o.class_id=v_self.class_id and o.id<>v_self.id
    and o.owner_auth_uid is not null order by o.student_number;
end $$;

create or replace function private.my_trade_offers()
returns table(id uuid,direction text,other_name text,offered_type text,wanted_type text,star_price integer,status text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid());
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  return query select t.id,case when t.recipient_id=v_self.id then 'in' else 'out' end,
    coalesce(nullif(other_o.oasis_name,''),'Oasis '||other_o.student_number::text),
    coalesce(t.offered_type,i.item_type),t.wanted_type,t.star_price,
    case when t.status='pending' and t.expires_at<=now() then 'expired'
      when t.status='pending' and (i.id is null or i.oasis_id<>t.sender_id) then 'invalid'
      else t.status end,t.expires_at
    from public.trade_offers t
    left join public.items i on i.id=t.offered_item_id
    join public.oases other_o on other_o.id=case when t.recipient_id=v_self.id then t.sender_id else t.recipient_id end
    where t.class_id=v_self.class_id and (t.sender_id=v_self.id or t.recipient_id=v_self.id)
    order by (t.status='pending' and t.expires_at>now()) desc,t.created_at desc limit 50;
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
  if ((p_wanted_type in ('palms','tent') and p_star_price is null)
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
    select s into v_to_slot from generate_series(0,7) s where not exists
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

create or replace function private.move_item(p_item uuid,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self uuid;
begin
  if p_slot is null or p_slot not between 0 and 7 then raise exception 'That spot is unavailable.'; end if;
  select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self is null then raise exception 'Open your personal Oasis link first.'; end if;
  update public.items set slot_index=p_slot where id=p_item and oasis_id=v_self;
  if not found then raise exception 'That item is not in your Oasis.'; end if;
end $$;

create or replace function public.trade_peers()
returns table(id uuid,oasis_name text) language sql security invoker set search_path=''
as $$ select * from private.trade_peers() $$;
create or replace function public.my_trade_offers()
returns table(id uuid,direction text,other_name text,offered_type text,wanted_type text,star_price integer,status text,expires_at timestamptz)
language sql security invoker set search_path='' as $$ select * from private.my_trade_offers() $$;
create or replace function public.create_trade_offer(p_recipient uuid,p_item uuid,p_wanted_type text default null,p_star_price integer default null)
returns uuid language sql security invoker set search_path='' as $$ select private.create_trade_offer(p_recipient,p_item,p_wanted_type,p_star_price) $$;
create or replace function public.resolve_trade_offer(p_offer uuid,p_accept boolean,p_payment_item uuid default null)
returns text language sql security invoker set search_path='' as $$ select private.resolve_trade_offer(p_offer,p_accept,p_payment_item) $$;
revoke all on function private.trade_peers(),private.my_trade_offers(),private.create_trade_offer(uuid,uuid,text,integer),private.resolve_trade_offer(uuid,boolean,uuid),
  public.trade_peers(),public.my_trade_offers(),public.create_trade_offer(uuid,uuid,text,integer),public.resolve_trade_offer(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function private.trade_peers(),private.my_trade_offers(),private.create_trade_offer(uuid,uuid,text,integer),private.resolve_trade_offer(uuid,boolean,uuid),
  public.trade_peers(),public.my_trade_offers(),public.create_trade_offer(uuid,uuid,text,integer),public.resolve_trade_offer(uuid,boolean,uuid) to authenticated;
