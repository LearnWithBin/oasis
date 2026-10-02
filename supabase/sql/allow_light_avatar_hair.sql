create or replace function private.set_oasis_profile(p_name text, p_avatar jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(length(trim(p_name)) not between 2 and 32, true)
     or coalesce(p_avatar->>'skin' not in ('#7a4b33','#a86843','#d49a6c','#efc299'), true)
     or coalesce(p_avatar->>'hair' not in ('#191719','#493128','#7a4932','#e8cf86','#e7eaf0'), true)
     or coalesce(p_avatar->>'clothes' not in ('#ee9b52','#4b9aaf','#ad6e96','#d6ad4d'), true) then
    raise exception 'Choose a name and avatar from the available options.';
  end if;
  update public.oases set oasis_name = trim(p_name), avatar = jsonb_build_object(
    'skin', p_avatar->>'skin', 'hair', p_avatar->>'hair', 'clothes', p_avatar->>'clothes'
  ) where owner_auth_uid = (select auth.uid());
  if not found then raise exception 'Open your personal Oasis link first.'; end if;
end; $$;
