-- Keep privileged writes outside the exposed API schema. The public RPCs are
-- invoker-rights wrappers; private functions validate auth.uid() and inputs.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter function public.set_oasis_profile(text,jsonb) set schema private;
alter function public.purchase_item(text,integer) set schema private;
alter function public.move_item(uuid,integer) set schema private;

create function public.set_oasis_profile(p_name text, p_avatar jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.set_oasis_profile(p_name, p_avatar); $$;

create function public.purchase_item(p_type text, p_slot integer)
returns void language sql security invoker set search_path = ''
as $$ select private.purchase_item(p_type, p_slot); $$;

create function public.move_item(p_item uuid, p_slot integer)
returns void language sql security invoker set search_path = ''
as $$ select private.move_item(p_item, p_slot); $$;

revoke all on function public.set_oasis_profile(text,jsonb), public.purchase_item(text,integer),
  public.move_item(uuid,integer) from public, anon, authenticated;
grant execute on function public.set_oasis_profile(text,jsonb), public.purchase_item(text,integer),
  public.move_item(uuid,integer) to authenticated;
