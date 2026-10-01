create extension if not exists pgcrypto;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null
);
insert into public.classes(slug, title) values ('fall-2026', 'Sister Bin’s Level 4');

create table public.oases (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  student_number integer not null,
  invite_hash text not null unique,
  owner_auth_uid uuid unique references auth.users(id) on delete set null,
  oasis_name text not null default '',
  avatar jsonb not null default '{"skin":"#a86843","hair":"#191719","clothes":"#ee9b52"}'::jsonb,
  stars integer not null default 6 check(stars >= 0),
  created_at timestamptz not null default now(),
  unique(class_id, student_number)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  oasis_id uuid not null references public.oases(id) on delete cascade,
  item_type text not null check(item_type in ('palms', 'tent')),
  slot_index integer not null check(slot_index between 0 and 7),
  created_at timestamptz not null default now(),
  unique(oasis_id, slot_index)
);

create table public.star_ledger (
  id uuid primary key default gen_random_uuid(),
  oasis_id uuid not null references public.oases(id) on delete cascade,
  source_key text not null,
  delta integer not null,
  created_at timestamptz not null default now(),
  unique(oasis_id, source_key)
);

alter table public.classes enable row level security;
alter table public.oases enable row level security;
alter table public.items enable row level security;
alter table public.star_ledger enable row level security;

create policy "owner reads oasis" on public.oases for select to authenticated
using (owner_auth_uid = (select auth.uid()));
create policy "owner reads items" on public.items for select to authenticated
using (exists (select 1 from public.oases o where o.id = oasis_id and o.owner_auth_uid = (select auth.uid())));
-- The browser has no direct INSERT/UPDATE/DELETE permissions. Changes go through validated functions.
revoke all on public.classes, public.oases, public.items, public.star_ledger from anon, authenticated;
grant select on public.oases, public.items to authenticated;

create or replace function public.set_oasis_profile(p_name text, p_avatar jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(length(trim(p_name)) not between 2 and 32, true)
     or coalesce(p_avatar->>'skin' not in ('#7a4b33','#a86843','#d49a6c','#efc299'), true)
     or coalesce(p_avatar->>'hair' not in ('#191719','#493128','#7a4932'), true)
     or coalesce(p_avatar->>'clothes' not in ('#ee9b52','#4b9aaf','#ad6e96','#d6ad4d'), true) then
    raise exception 'Choose a name and avatar from the available options.';
  end if;
  update public.oases set oasis_name = trim(p_name), avatar = jsonb_build_object(
    'skin', p_avatar->>'skin', 'hair', p_avatar->>'hair', 'clothes', p_avatar->>'clothes'
  ) where owner_auth_uid = (select auth.uid());
  if not found then raise exception 'Open your personal Oasis link first.'; end if;
end; $$;

create or replace function public.purchase_item(p_type text, p_slot integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_oasis uuid; v_stars integer; v_cost integer;
begin
  if p_slot not between 0 and 7 or p_type not in ('palms','tent') then
    raise exception 'That item or building spot is unavailable.';
  end if;
  v_cost := case p_type when 'tent' then 4 else 2 end;
  select id, stars into v_oasis, v_stars from public.oases
  where owner_auth_uid = (select auth.uid()) for update;
  if v_oasis is null then raise exception 'Open your personal Oasis link first.'; end if;
  if v_stars < v_cost then raise exception 'Save more stars to buy this item.'; end if;
  insert into public.items(oasis_id, item_type, slot_index) values (v_oasis, p_type, p_slot);
  update public.oases set stars = stars - v_cost where id = v_oasis;
  insert into public.star_ledger(oasis_id, source_key, delta)
  values (v_oasis, 'purchase:' || gen_random_uuid()::text, -v_cost);
end; $$;

create or replace function public.move_item(p_item uuid, p_slot integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_slot not between 0 and 7 then raise exception 'That spot is unavailable.'; end if;
  update public.items set slot_index = p_slot where id = p_item
  and oasis_id = (select id from public.oases where owner_auth_uid = (select auth.uid()));
  if not found then raise exception 'That item is not in your Oasis.'; end if;
end; $$;

-- Reserved for the future trusted Base44 score importer, never callable by students.
create or replace function public.award_stars(p_oasis uuid, p_source text, p_stars integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_stars not between 1 and 40 or length(p_source) not between 3 and 150 then
    raise exception 'Invalid award.';
  end if;
  insert into public.star_ledger(oasis_id, source_key, delta) values (p_oasis, p_source, p_stars)
  on conflict (oasis_id, source_key) do nothing;
  if found then update public.oases set stars = stars + p_stars where id = p_oasis; end if;
end; $$;

revoke all on function public.set_oasis_profile(text,jsonb), public.purchase_item(text,integer),
public.move_item(uuid,integer), public.award_stars(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.set_oasis_profile(text,jsonb), public.purchase_item(text,integer),
public.move_item(uuid,integer) to authenticated;
grant execute on function public.award_stars(uuid,text,integer) to service_role;
