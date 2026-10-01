-- Private mapping from Base44's typed names to this class's Oases.
-- Insert actual aliases in the database only; never commit student names to this public repo.
create table private.base44_student_aliases (
  class_id uuid not null references public.classes(id) on delete cascade,
  alias text not null check (alias ~ '^[a-z]{3,40}$'),
  oasis_id uuid not null references public.oases(id) on delete cascade,
  primary key (class_id, alias)
);
create index base44_student_aliases_lookup on private.base44_student_aliases(class_id, oasis_id);
alter table private.base44_student_aliases enable row level security;
grant select on private.base44_student_aliases to service_role;

create function public.award_base44_result(
  p_class_slug text, p_name text, p_activity text, p_result_id text,
  p_score integer, p_maximum integer
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_class uuid;
  v_oasis uuid;
  v_name text;
begin
  if p_name is null or length(p_name) > 100 then
    return 0;
  end if;
  v_name := lower(regexp_replace(p_name, '[^A-Za-z]', '', 'g'));
  select id into v_class from public.classes where slug = p_class_slug;
  if v_class is null then
    return 0;
  end if;
  select a.oasis_id into v_oasis
    from private.base44_student_aliases a
    join public.oases o on o.id = a.oasis_id and o.class_id = a.class_id
   where a.class_id = v_class and left(v_name, length(a.alias)) = a.alias
   order by length(a.alias) desc limit 1;
  if v_oasis is null then
    return 0;
  end if;
  return public.award_game_result(v_oasis, p_activity, p_result_id, p_score, p_maximum);
end; $$;
revoke all on function public.award_base44_result(text,text,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.award_base44_result(text,text,text,text,integer,integer)
  to service_role;
