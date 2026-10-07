-- Species-specific homes and a daily, saved egg basket.
alter table public.items drop constraint items_item_type_check;
alter table public.items add constraint items_item_type_check check(item_type in ('palms','tent','goat','pen','chicken','coop'));
alter table public.items drop constraint animal_pen_only;
alter table public.items add constraint animal_pen_only check(pen_item_id is null or item_type in ('goat','chicken'));
alter table public.trade_offers drop constraint trade_offers_wanted_type_check;
alter table public.trade_offers add constraint trade_offers_wanted_type_check check(wanted_type in ('palms','tent','goat','chicken'));
alter table public.trade_offers drop constraint trade_offers_offered_type_check;
alter table public.trade_offers add constraint trade_offers_offered_type_check check(offered_type in ('palms','tent','goat','chicken'));
alter table public.oases add column eggs integer not null default 0 check(eggs>=0);
alter table public.oases add column eggs_collected_at timestamptz;
create or replace function private.is_animal_type(p_type text) returns boolean language sql immutable set search_path='' as $$ select p_type in ('goat','chicken') $$;
create function private.pen_species(p_type text) returns text language sql immutable set search_path='' as $$ select case p_type when 'pen' then 'goat' when 'coop' then 'chicken' end $$;
revoke all on function private.pen_species(text) from public,anon,authenticated;

create or replace function private.pen_location_clear(p_oasis uuid,p_slot integer,p_ignore uuid default null) returns boolean
language plpgsql stable set search_path='' as $$
declare v_level integer;c jsonb:=private.world_spot(p_slot);
begin
 select land_level into v_level from public.oases where id=p_oasis;
 if private.pen_ground_clear(p_slot,v_level) is not true then return false;end if;
 return not exists(select 1 from public.items i where oasis_id=p_oasis and i.id is distinct from p_ignore and item_type in ('tent','palms','pen','coop')
  and abs(((c->>'x')::float-(private.world_spot(i.slot_index)->>'x')::float)*1536)<case when item_type in ('pen','coop') then 360 else 285 end
  and abs(((c->>'y')::float-(private.world_spot(i.slot_index)->>'y')::float)*1024)<case when item_type in ('pen','coop') then 240 else 210 end);
end $$;

create or replace function private.check_pen_change() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;begin
 if TG_OP='UPDATE' and NEW.oasis_id<>OLD.oasis_id then NEW.pen_item_id:=null;end if;
 if NEW.pen_item_id is not null then
  if not exists(select 1 from public.items where id=NEW.pen_item_id and oasis_id=NEW.oasis_id and item_type in ('pen','coop')) then raise exception 'Choose a pen you own.';end if;
  if not exists(select 1 from public.items where id=NEW.pen_item_id and private.pen_species(item_type)=NEW.item_type) then raise exception 'Choose the matching animal for this home.';end if;
  if (select count(*) from public.items where pen_item_id=NEW.pen_item_id and id<>NEW.id)>=6 then raise exception 'This pen has room for six animals.';end if;
 end if;
 if NEW.item_type in ('pen','coop') then
  if not private.pen_location_clear(NEW.oasis_id,NEW.slot_index,NEW.id) then raise exception 'Choose a roomy, dry spot for the pen.';end if;
 elsif NEW.item_type in ('palms','tent') then
  c:=private.world_spot(NEW.slot_index);
  if exists(select 1 from public.items i where oasis_id=NEW.oasis_id and item_type in ('pen','coop') and id<>NEW.id
   and abs(((c->>'x')::float-(private.world_spot(i.slot_index)->>'x')::float)*1536)<285
   and abs(((c->>'y')::float-(private.world_spot(i.slot_index)->>'y')::float)*1024)<210) then raise exception 'Leave room around the animal pen.';end if;
 end if;
 return NEW;
end $$;

create or replace function private.set_pen_animals(p_pen uuid,p_animals uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare v_self uuid;v_species text;
begin
 select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
 if v_self is null then raise exception 'Open your personal Oasis link first.';end if;
 if not exists(select 1 from public.items where id=p_pen and oasis_id=v_self and item_type in ('pen','coop')) then raise exception 'Choose a pen you own.';end if;
 if p_animals is null or cardinality(p_animals)>6 or (select count(distinct a) from unnest(p_animals) a)<>cardinality(p_animals) then raise exception 'This pen has room for six animals.';end if;
 if (select count(*) from public.items where id=any(p_animals) and oasis_id=v_self and private.is_animal_type(item_type))<>cardinality(p_animals) then raise exception 'Choose animals you own.';end if;
 select private.pen_species(item_type) into v_species from public.items where id=p_pen;
 if exists(select 1 from public.items where id=any(p_animals) and item_type<>v_species) then raise exception 'Choose the matching animal for this home.';end if;
 update public.items set pen_item_id=null where oasis_id=v_self and pen_item_id=p_pen and not(id=any(p_animals));
 update public.items set pen_item_id=p_pen where oasis_id=v_self and id=any(p_animals);
end $$;

create or replace function private.purchase_item(p_type text,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_cost integer; v_occupant public.items%rowtype; v_free integer;
begin
  if p_slot is null or p_type is null or p_type not in ('palms','tent','goat','pen','chicken','coop') then raise exception 'That item or building spot is unavailable.'; end if;
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  v_cost:=case p_type when 'coop' then 12 when 'pen' then 12 when 'chicken' then 6 when 'goat' then 8 when 'tent' then 4 else 2 end;
  if v_self.stars<v_cost then raise exception 'Save more stars to buy this item.'; end if;
  select * into v_occupant from public.items where oasis_id=v_self.id and slot_index=p_slot;
  if private.is_animal_type(p_type) then
    if v_occupant.id is not null then
      if not private.is_animal_type(v_occupant.item_type) then raise exception 'That spot is occupied.'; end if;
      select s into v_free from generate_series(0,v_self.land_level*8-1) s where not exists(select 1 from public.items where oasis_id=v_self.id and slot_index=s) order by s limit 1;
      if v_free is null then raise exception 'Your inventory is full.'; end if;
      p_slot:=v_free;
    end if;
    update public.oases set animal_home_slot=coalesce(animal_home_slot,p_slot) where id=v_self.id;
  else
    if p_type not in ('pen','coop') and p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
    if v_occupant.id is not null then
      if not private.is_animal_type(v_occupant.item_type) then raise exception 'That spot is occupied.'; end if;
      select s into v_free from generate_series(0,v_self.land_level*8-1) s where not exists(select 1 from public.items where oasis_id=v_self.id and slot_index=s) order by s limit 1;
      if v_free is null then raise exception 'Your inventory is full.'; end if;
      update public.items set slot_index=v_free where id=v_occupant.id;
    end if;
  end if;
  insert into public.items(oasis_id,item_type,slot_index) values(v_self.id,p_type,p_slot);
  update public.oases set stars=stars-v_cost where id=v_self.id;
  insert into public.star_ledger(oasis_id,source_key,delta) values(v_self.id,'purchase:'||gen_random_uuid()::text,-v_cost);
end $$;

create or replace function private.move_item(p_item uuid,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_type text; v_occupant public.items%rowtype; v_old integer;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot is null or p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  select item_type,slot_index into v_type,v_old from public.items where id=p_item and oasis_id=v_self.id;
  if v_type is null then raise exception 'That item is not in your Oasis.'; end if;
  if v_old=p_slot then return; end if;
  if v_type not in ('pen','coop') and not private.is_animal_type(v_type) and p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
  select * into v_occupant from public.items where oasis_id=v_self.id and slot_index=p_slot;
  if v_occupant.id is not null then
    if private.is_animal_type(v_type) or not private.is_animal_type(v_occupant.item_type) then raise exception 'That spot is occupied.'; end if;
    -- Swap saved slots without deleting an animal or disturbing pending offers.
    set constraints public.items_oasis_id_slot_index_key deferred;
    update public.items set slot_index=case when id=p_item then p_slot else v_old end where id in (p_item,v_occupant.id);
    set constraints public.items_oasis_id_slot_index_key immediate;
  else update public.items set slot_index=p_slot where id=p_item; end if;
end $$;

create or replace function private.sell_item(p_item uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_self uuid; v_type text; v_refund integer;
begin
  select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self is null then raise exception 'Open your personal Oasis link first.'; end if;
  select item_type into v_type from public.items where id=p_item and oasis_id=v_self for update;
  if v_type is null then raise exception 'That item is not in your Oasis.'; end if;
  v_refund:=case v_type when 'coop' then 6 when 'pen' then 6 when 'chicken' then 3 when 'goat' then 4 when 'tent' then 2 else 1 end;
  delete from public.items where id=p_item and oasis_id=v_self;
  if not exists(select 1 from public.items where oasis_id=v_self and private.is_animal_type(item_type)) then
    update public.oases set animal_home_slot=null,companion_item_id=null where id=v_self;
  end if;
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
  if ((p_wanted_type in ('palms','tent','goat','chicken') and p_star_price is null)
     or (p_wanted_type is null and p_star_price between 1 and 100)) is not true then
    raise exception 'Choose one item or a whole star price from 1 to 100.';
  end if;
  select item_type into v_type from public.items where id=p_item and oasis_id=v_self.id;
  if v_type in ('pen','coop') then raise exception 'Pens stay on your Oasis. Offer an animal, tent or plant.';end if;
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

create function private.collect_eggs() returns integer language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype;v_count integer;
begin
 select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
 if v_self.id is null then raise exception 'Open your personal Oasis link first.';end if;
 select count(*) into v_count from public.items animal join public.items home on home.id=animal.pen_item_id
  where animal.oasis_id=v_self.id and home.oasis_id=v_self.id and animal.item_type='chicken' and home.item_type='coop';
 if v_count=0 then raise exception 'Give your chickens a coop first.';end if;
 if v_self.eggs_collected_at is not null and now()<v_self.eggs_collected_at+interval '24 hours' then raise exception 'Your chickens are still laying. Come back when the eggs are ready.';end if;
 update public.oases set eggs=eggs+v_count,eggs_collected_at=now() where id=v_self.id;
 return v_count;
end $$;
create function public.collect_eggs() returns integer language sql security invoker set search_path='' as $$ select private.collect_eggs() $$;
revoke all on function private.collect_eggs(),public.collect_eggs() from public,anon,authenticated;
grant execute on function private.collect_eggs(),public.collect_eggs() to authenticated;
