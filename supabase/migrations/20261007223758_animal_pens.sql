-- A pen is a purchased building; animals retain ownership and their saved home.
alter table public.items drop constraint items_item_type_check;
alter table public.items add constraint items_item_type_check check(item_type in ('palms','tent','goat','pen'));
alter table public.items add column pen_item_id uuid references public.items(id) on delete set null;
create index items_pen_item_idx on public.items(pen_item_id);
alter table public.items add constraint animal_pen_only check(pen_item_id is null or item_type='goat');

create function private.world_spot(p_slot integer) returns jsonb language sql immutable set search_path='' as $$
 select '[{"x":0.16,"y":0.38},{"x":0.26,"y":0.68},{"x":0.42,"y":0.77},{"x":0.66,"y":0.76},{"x":0.83,"y":0.62},{"x":0.84,"y":0.36},{"x":0.12,"y":0.6},{"x":0.82,"y":0.2},{"x":0.35,"y":1.18},{"x":0.56,"y":1.07},{"x":0.87,"y":1.37},{"x":1.12,"y":0.35},{"x":1.08,"y":0.63},{"x":-0.15,"y":0.37},{"x":-0.13,"y":0.65},{"x":0.68,"y":1.34},{"x":-0.25,"y":1.18},{"x":-0.24,"y":0.62},{"x":-0.22,"y":0.22},{"x":1.24,"y":0.3},{"x":1.23,"y":0.65},{"x":1.18,"y":1.35},{"x":0.66,"y":1.52},{"x":0.23,"y":1.53},{"x":-0.38,"y":1.62},{"x":-0.4,"y":1},{"x":-0.4,"y":0.42},{"x":1.4,"y":0.42},{"x":1.4,"y":0.95},{"x":1.3,"y":1.75},{"x":0.8,"y":1.8},{"x":0.26,"y":1.8}]'::jsonb->p_slot;
$$;
create function private.pen_ground_clear(p_slot integer,p_level integer) returns boolean language plpgsql immutable set search_path='' as $$
declare c jsonb:=private.world_spot(p_slot); b jsonb:='[{"x":0,"y":0,"width":1536,"height":1024},{"x":-384,"y":0,"width":2304,"height":1536},{"x":-576,"y":0,"width":2688,"height":1792},{"x":-768,"y":0,"width":3072,"height":2048}]'::jsonb->(p_level-1); poly jsonb:='[[0.64,0.25],[0.67,0.25],[0.68,0.29],[0.63,0.32],[0.65,0.345],[0.7,0.37],[0.71,0.4],[0.78,0.43],[0.76,0.46],[0.77,0.49],[0.79,0.53],[0.85,0.54],[0.85,0.57],[0.78,0.59],[0.63,0.61],[0.525,0.61],[0.46,0.57],[0.42,0.53],[0.36,0.515],[0.31,0.5],[0.24,0.49],[0.24,0.47],[0.27,0.43],[0.35,0.4],[0.4,0.37],[0.375,0.345],[0.49,0.33],[0.51,0.31],[0.62,0.3]]';
 dx integer;dy integer;x float;y float;i integer;j integer;xi float;yi float;xj float;yj float; wet boolean;
begin
 if c is null or p_slot<0 or p_slot>=p_level*8 then return false;end if;
 for dx in select generate_series(-180,180,45) loop
  for dy in select generate_series(-120,120,40) loop
   x:=(c->>'x')::float+dx/1536.0;y:=(c->>'y')::float+dy/1024.0;
   if x*1536<(b->>'x')::float+64 or x*1536>(b->>'x')::float+(b->>'width')::float-64 or y*1024<123 or y*1024>(b->>'height')::float-40 then return false;end if;
   wet:=false;j:=jsonb_array_length(poly)-1;
   for i in 0..jsonb_array_length(poly)-1 loop
    xi:=(poly->i->>0)::float;yi:=(poly->i->>1)::float;xj:=(poly->j->>0)::float;yj:=(poly->j->>1)::float;
    if (yi>y)<>(yj>y) then if x<(xj-xi)*(y-yi)/(yj-yi)+xi then wet:=not wet;end if;end if;j:=i;
   end loop;
   if wet then return false;end if;
  end loop;
 end loop;return true;
end $$;
create function private.pen_location_clear(p_oasis uuid,p_slot integer,p_ignore uuid default null) returns boolean
language plpgsql stable set search_path='' as $$
declare v_level integer;c jsonb:=private.world_spot(p_slot);
begin
 select land_level into v_level from public.oases where id=p_oasis;
 if private.pen_ground_clear(p_slot,v_level) is not true then return false;end if;
 return not exists(select 1 from public.items i where oasis_id=p_oasis and i.id is distinct from p_ignore and item_type in ('tent','palms','pen')
  and abs(((c->>'x')::float-(private.world_spot(i.slot_index)->>'x')::float)*1536)<case when item_type='pen' then 360 else 285 end
  and abs(((c->>'y')::float-(private.world_spot(i.slot_index)->>'y')::float)*1024)<case when item_type='pen' then 240 else 210 end);
end $$;

create function private.check_pen_change() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;begin
 if TG_OP='UPDATE' and NEW.oasis_id<>OLD.oasis_id then NEW.pen_item_id:=null;end if;
 if NEW.pen_item_id is not null then
  if not exists(select 1 from public.items where id=NEW.pen_item_id and oasis_id=NEW.oasis_id and item_type='pen') then raise exception 'Choose a pen you own.';end if;
  if (select count(*) from public.items where pen_item_id=NEW.pen_item_id and id<>NEW.id)>=6 then raise exception 'This pen has room for six animals.';end if;
 end if;
 if NEW.item_type='pen' then
  if not private.pen_location_clear(NEW.oasis_id,NEW.slot_index,NEW.id) then raise exception 'Choose a roomy, dry spot for the pen.';end if;
 elsif NEW.item_type in ('palms','tent') then
  c:=private.world_spot(NEW.slot_index);
  if exists(select 1 from public.items i where oasis_id=NEW.oasis_id and item_type='pen' and id<>NEW.id
   and abs(((c->>'x')::float-(private.world_spot(i.slot_index)->>'x')::float)*1536)<285
   and abs(((c->>'y')::float-(private.world_spot(i.slot_index)->>'y')::float)*1024)<210) then raise exception 'Leave room around the animal pen.';end if;
 end if;
 return NEW;
end $$;
create trigger check_pen_change before insert or update on public.items for each row execute function private.check_pen_change();

create function private.set_pen_animals(p_pen uuid,p_animals uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare v_self uuid;
begin
 select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
 if v_self is null then raise exception 'Open your personal Oasis link first.';end if;
 if not exists(select 1 from public.items where id=p_pen and oasis_id=v_self and item_type='pen') then raise exception 'Choose a pen you own.';end if;
 if p_animals is null or cardinality(p_animals)>6 or (select count(distinct a) from unnest(p_animals) a)<>cardinality(p_animals) then raise exception 'This pen has room for six animals.';end if;
 if (select count(*) from public.items where id=any(p_animals) and oasis_id=v_self and private.is_animal_type(item_type))<>cardinality(p_animals) then raise exception 'Choose animals you own.';end if;
 update public.items set pen_item_id=null where oasis_id=v_self and pen_item_id=p_pen and not(id=any(p_animals));
 update public.items set pen_item_id=p_pen where oasis_id=v_self and id=any(p_animals);
end $$;
create function public.set_pen_animals(p_pen uuid,p_animals uuid[]) returns void language sql security invoker set search_path='' as $$ select private.set_pen_animals(p_pen,p_animals) $$;
revoke all on function private.world_spot(integer),private.pen_ground_clear(integer,integer),private.pen_location_clear(uuid,integer,uuid),private.check_pen_change(),private.set_pen_animals(uuid,uuid[]),public.set_pen_animals(uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.set_pen_animals(uuid,uuid[]),public.set_pen_animals(uuid,uuid[]) to authenticated;

create or replace function private.purchase_item(p_type text,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_cost integer; v_occupant public.items%rowtype; v_free integer;
begin
  if p_slot is null or p_type is null or p_type not in ('palms','tent','goat','pen') then raise exception 'That item or building spot is unavailable.'; end if;
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  v_cost:=case p_type when 'pen' then 12 when 'goat' then 8 when 'tent' then 4 else 2 end;
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
    if p_type<>'pen' and p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
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
  if v_type<>'pen' and not private.is_animal_type(v_type) and p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
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
  v_refund:=case v_type when 'pen' then 6 when 'goat' then 4 when 'tent' then 2 else 1 end;
  delete from public.items where id=p_item and oasis_id=v_self;
  if not exists(select 1 from public.items where oasis_id=v_self and private.is_animal_type(item_type)) then
    update public.oases set animal_home_slot=null,companion_item_id=null where id=v_self;
  end if;
  update public.oases set stars=stars+v_refund where id=v_self;
  insert into public.star_ledger(oasis_id,source_key,delta) values(v_self,'sale:'||p_item::text,v_refund);
  return v_refund;
end $$;
create or replace function private.maintain_animal_home() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_first integer; v_home integer;
begin
  for v_id in select distinct id from (values(case when TG_OP<>'DELETE' then NEW.oasis_id end),(case when TG_OP<>'INSERT' then OLD.oasis_id end)) ids(id) where id is not null order by id
  loop
    select animal_home_slot into v_home from public.oases where id=v_id for update;
    select min(slot_index) into v_first from public.items where oasis_id=v_id and private.is_animal_type(item_type) and pen_item_id is null;
    if v_first is null then update public.oases set animal_home_slot=null where id=v_id;
    elsif v_home is null or exists(select 1 from public.items where oasis_id=v_id and slot_index=v_home and not private.is_animal_type(item_type)) then update public.oases set animal_home_slot=v_first where id=v_id;
    end if;
    update public.oases set companion_item_id=null where id=v_id and companion_item_id is not null and not exists(select 1 from public.items where id=companion_item_id and oasis_id=v_id and private.is_animal_type(item_type));
  end loop;
  return null;
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
  if v_type='pen' then raise exception 'Pens stay on your Oasis. Offer an animal, tent or plant.';end if;
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
