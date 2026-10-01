-- Trusted Base44 importer calls this RPC with a verified Oasis and source result.
-- One completed activity earns 10–20 stars; replays grant only an improvement.
create table private.game_award_state (
  oasis_id uuid not null references public.oases(id) on delete cascade,
  activity_key text not null,
  best_stars integer not null check (best_stars between 10 and 20),
  primary key (oasis_id, activity_key)
);
create table private.processed_game_results (
  source_key text primary key,
  oasis_id uuid not null references public.oases(id) on delete cascade,
  activity_key text not null,
  score integer not null,
  maximum_score integer not null,
  awarded_delta integer not null,
  created_at timestamptz not null default now()
);
create index processed_game_results_oasis_activity_idx
  on private.processed_game_results(oasis_id, activity_key);

alter table private.game_award_state enable row level security;
alter table private.processed_game_results enable row level security;
grant usage on schema private to service_role;
grant select, insert, update on private.game_award_state to service_role;
grant select, insert on private.processed_game_results to service_role;

create function public.award_game_result(
  p_oasis uuid, p_activity text, p_result_id text,
  p_score integer, p_maximum integer
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_source text;
  v_stars integer;
  v_previous integer;
  v_delta integer;
begin
  if p_oasis is null
     or p_activity is null or p_activity !~ '^[a-z0-9_-]{3,40}$'
     or p_result_id is null or length(p_result_id) not between 3 and 90
     or p_score is null or p_maximum is null
     or p_maximum not between 1 and 100000
     or p_score < 0 or p_score > p_maximum then
    raise exception 'Invalid game result.';
  end if;
  v_source := 'base44:' || p_activity || ':' || p_result_id;
  v_stars := 10 + round(10.0 * p_score / p_maximum)::integer;

  -- Serialize results for one Oasis, including concurrent retries/replays.
  perform 1 from public.oases where id = p_oasis for update;
  if not found then raise exception 'Oasis not found.'; end if;
  insert into private.processed_game_results
    (source_key, oasis_id, activity_key, score, maximum_score, awarded_delta)
  values (v_source, p_oasis, p_activity, p_score, p_maximum, 0)
  on conflict (source_key) do nothing;
  if not found then return 0; end if;

  select best_stars into v_previous from private.game_award_state
    where oasis_id = p_oasis and activity_key = p_activity;
  v_delta := greatest(0, v_stars - coalesce(v_previous, 0));
  insert into private.game_award_state(oasis_id, activity_key, best_stars)
  values (p_oasis, p_activity, greatest(v_stars, coalesce(v_previous, 0)))
  on conflict (oasis_id, activity_key) do update
    set best_stars = greatest(private.game_award_state.best_stars, excluded.best_stars);
  if v_delta > 0 then
    update public.oases set stars = stars + v_delta where id = p_oasis;
    insert into public.star_ledger(oasis_id, source_key, delta)
      values (p_oasis, v_source, v_delta);
  end if;
  update private.processed_game_results set awarded_delta = v_delta
    where source_key = v_source;
  return v_delta;
end; $$;

revoke all on function public.award_game_result(uuid,text,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.award_game_result(uuid,text,text,integer,integer)
  to service_role;
