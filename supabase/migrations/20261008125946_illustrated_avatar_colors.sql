-- Preserve the existing avatar fields for the original view; save both illustrated avatars.
create or replace function private.set_oasis_profile(p_name text,p_avatar jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_style text; v_part text; v_color text; v_colors jsonb; v_extra jsonb:='{}';
begin
 if (select auth.uid()) is null then raise exception 'Open your personal Oasis link first.';end if;
 if coalesce(length(trim(p_name)) not between 2 and 32,true)
 or coalesce(p_avatar->>'skin' not in ('#7a4b33','#a86843','#d49a6c','#efc299'),true)
 or coalesce(p_avatar->>'hair' not in ('#191719','#493128','#7a4932','#e8cf86','#e7eaf0'),true)
 or coalesce(p_avatar->>'clothes' not in ('#ee9b52','#4b9aaf','#ad6e96','#d6ad4d'),true) then
 raise exception 'Choose a name and avatar from the available options.';end if;
 if p_avatar ? 'style' or p_avatar ? 'colors' then
  if coalesce(p_avatar->>'style' not in ('girl','boy'),true) or coalesce(jsonb_typeof(p_avatar->'colors')<>'object',true) then raise exception 'Choose a girl or boy and the available colors.';end if;
  v_colors:=p_avatar->'colors';
  if v_colors-array['girl','boy']<>'{}'::jsonb then raise exception 'Choose the available avatar colors.';end if;
  foreach v_style in array array['girl','boy'] loop
   if coalesce(jsonb_typeof(v_colors->v_style)<>'object',true) or (v_colors->v_style)-array['skin','hair','outfit','scarf']<>'{}'::jsonb then raise exception 'Choose the available avatar colors.';end if;
   foreach v_part in array array['skin','hair','outfit','scarf'] loop
    v_color:=v_colors->v_style->>v_part;
    if v_color is null or coalesce(jsonb_typeof(v_colors->v_style->v_part)<>'string',true)
    or v_part='skin' and v_color not in ('','#7a4b33','#a86843','#d49a6c','#efc299')
    or v_part='hair' and v_color not in ('','#191719','#493128','#7a4932','#e8cf86','#e7eaf0')
    or v_part='outfit' and v_color not in ('','#ee9b52','#4b9aaf','#ad6e96','#d6ad4d','#e7eaf0')
    or v_part='scarf' and v_color not in ('','#e7eaf0','#4b9aaf','#ad6e96','#d6ad4d') then raise exception 'Choose the available avatar colors.';end if;
   end loop;
  end loop;
  v_extra:=jsonb_build_object('style',p_avatar->>'style','colors',v_colors);
 end if;
 update public.oases set oasis_name=trim(p_name),avatar=(avatar-array['skin','hair','clothes'])||jsonb_build_object('skin',p_avatar->>'skin','hair',p_avatar->>'hair','clothes',p_avatar->>'clothes')||v_extra where owner_auth_uid=(select auth.uid());
 if not found then raise exception 'Open your personal Oasis link first.';end if;
end;$$;
