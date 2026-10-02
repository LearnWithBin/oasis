-- A student can sell only an item belonging to their own Oasis.
-- The seller receives half the original star cost: 2 for a tent, 1 for palms.
create function private.sell_item(p_item uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_oasis uuid;
  v_type text;
  v_refund integer;
begin
  select id into v_oasis from public.oases
  where owner_auth_uid = (select auth.uid()) for update;
  if v_oasis is null then raise exception 'Open your personal Oasis link first.'; end if;

  select item_type into v_type from public.items
  where id = p_item and oasis_id = v_oasis for update;
  if v_type is null then raise exception 'That item is not in your Oasis.'; end if;
  v_refund := case v_type when 'tent' then 2 else 1 end;

  delete from public.items where id = p_item and oasis_id = v_oasis;
  update public.oases set stars = stars + v_refund where id = v_oasis;
  insert into public.star_ledger(oasis_id, source_key, delta)
  values (v_oasis, 'sale:' || p_item::text, v_refund);
  return v_refund;
end; $$;

revoke all on function private.sell_item(uuid) from public, anon, authenticated;
grant execute on function private.sell_item(uuid) to authenticated;

create function public.sell_item(p_item uuid)
returns integer language sql security invoker set search_path = ''
as $$ select private.sell_item(p_item); $$;

revoke all on function public.sell_item(uuid) from public, anon, authenticated;
grant execute on function public.sell_item(uuid) to authenticated;
