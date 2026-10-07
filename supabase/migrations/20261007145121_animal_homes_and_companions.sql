-- Animal location is a shared home; slot IDs still track inventory capacity.
create function private.is_animal_type(p_type text) returns boolean
language sql immutable set search_path='' as $$ select p_type in ('goat') $$;
revoke all on function private.is_animal_type(text) from public,anon,authenticated;

alter table public.oases add column animal_home_slot integer check(animal_home_slot between 0 and 31);
alter table public.oases add column companion_item_id uuid references public.items(id) on delete set null;
create index oases_companion_item_idx on public.oases(companion_item_id);
update public.oases o set animal_home_slot=(select min(slot_index) from public.items i where i.oasis_id=o.id and private.is_animal_type(i.item_type));

create function private.set_animal_home(p_slot integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype;
begin
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot is null or p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  if not exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Buy an animal first.'; end if;
  if exists(select 1 from public.items where oasis_id=v_self.id and slot_index=p_slot and not private.is_animal_type(item_type)) then raise exception 'Choose a clear spot for the animal home.'; end if;
  update public.oases set animal_home_slot=p_slot where id=v_self.id;
end $$;

create function private.set_animal_companion(p_item uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_self uuid;
begin
  select id into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_item is not null and not exists(select 1 from public.items where id=p_item and oasis_id=v_self and private.is_animal_type(item_type)) then raise exception 'Choose an animal you own.'; end if;
  update public.oases set companion_item_id=p_item where id=v_self;
end $$;

create function public.set_animal_home(p_slot integer) returns void
language sql security invoker set search_path='' as $$ select private.set_animal_home(p_slot) $$;
create function public.set_animal_companion(p_item uuid default null) returns void
language sql security invoker set search_path='' as $$ select private.set_animal_companion(p_item) $$;
revoke all on function private.set_animal_home(integer),private.set_animal_companion(uuid),public.set_animal_home(integer),public.set_animal_companion(uuid) from public,anon,authenticated;
grant execute on function private.set_animal_home(integer),private.set_animal_companion(uuid),public.set_animal_home(integer),public.set_animal_companion(uuid) to authenticated;

-- Reuse visually vacated animal slots for buildings while preserving every animal.
create or replace function private.purchase_item(p_type text,p_slot integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_self public.oases%rowtype; v_cost integer; v_occupant public.items%rowtype; v_free integer;
begin
  if p_slot is null or p_type is null or p_type not in ('palms','tent','goat') then raise exception 'That item or building spot is unavailable.'; end if;
  select * into v_self from public.oases where owner_auth_uid=(select auth.uid()) for update;
  if v_self.id is null then raise exception 'Open your personal Oasis link first.'; end if;
  if p_slot<0 or p_slot>=v_self.land_level*8 then raise exception 'That land has not opened yet.'; end if;
  v_cost:=case p_type when 'goat' then 8 when 'tent' then 4 else 2 end;
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
    if p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
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
  if not private.is_animal_type(v_type) and p_slot=v_self.animal_home_slot and exists(select 1 from public.items where oasis_id=v_self.id and private.is_animal_type(item_type)) then raise exception 'Move the animal home before building here.'; end if;
  select * into v_occupant from public.items where oasis_id=v_self.id and slot_index=p_slot;
  if v_occupant.id is not null then
    if private.is_animal_type(v_type) or not private.is_animal_type(v_occupant.item_type) then raise exception 'That spot is occupied.'; end if;
    -- Swap saved slots without deleting an animal or disturbing pending offers.
    set constraints public.items_oasis_id_slot_index_key deferred;
    update public.items set slot_index=case when id=p_item then p_slot else v_old end where id in (p_item,v_occupant.id);
    set constraints public.items_oasis_id_slot_index_key immediate;
  else update public.items set slot_index=p_slot where id=p_item; end if;
end $$;

create function private.maintain_animal_home() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_first integer; v_home integer;
begin
  for v_id in select distinct id from (values(case when TG_OP<>'DELETE' then NEW.oasis_id end),(case when TG_OP<>'INSERT' then OLD.oasis_id end)) ids(id) where id is not null order by id
  loop
    select animal_home_slot into v_home from public.oases where id=v_id for update;
    select min(slot_index) into v_first from public.items where oasis_id=v_id and private.is_animal_type(item_type);
    if v_first is null then update public.oases set animal_home_slot=null,companion_item_id=null where id=v_id;
    elsif v_home is null or exists(select 1 from public.items where oasis_id=v_id and slot_index=v_home and not private.is_animal_type(item_type)) then update public.oases set animal_home_slot=v_first where id=v_id;
    end if;
    update public.oases set companion_item_id=null where id=v_id and companion_item_id is not null and not exists(select 1 from public.items where id=companion_item_id and oasis_id=v_id and private.is_animal_type(item_type));
  end loop;
  return null;
end $$;
revoke all on function private.maintain_animal_home() from public,anon,authenticated;
create constraint trigger maintain_animal_home after insert or update or delete on public.items deferrable initially deferred for each row execute function private.maintain_animal_home();

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
  if not exists(select 1 from public.items where oasis_id=v_self and private.is_animal_type(item_type)) then
    update public.oases set animal_home_slot=null,companion_item_id=null where id=v_self;
  end if;
  update public.oases set stars=stars+v_refund where id=v_self;
  insert into public.star_ledger(oasis_id,source_key,delta) values(v_self,'sale:'||p_item::text,v_refund);
  return v_refund;
end $$;

