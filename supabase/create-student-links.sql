-- Run once in the Supabase SQL editor after the migration. Copy the five returned
-- tokens into private URLs: https://YOUR-GAME-DOMAIN/?invite=TOKEN
-- Treat each URL as a password. Do not publish the results or commit real tokens.
with links as materialized (
  select n as student_number, encode(gen_random_bytes(24), 'hex') as token
  from generate_series(1,5) n
), created as (
  insert into public.oases(class_id, student_number, invite_hash)
  select c.id, l.student_number, encode(digest(l.token, 'sha256'), 'hex')
  from links l cross join public.classes c where c.slug = 'fall-2026'
  returning id, student_number
), welcome as (
  insert into public.star_ledger(oasis_id, source_key, delta)
  select id, 'welcome', 6 from created
  returning oasis_id
)
select links.student_number, links.token
from links join created using(student_number)
join welcome on welcome.oasis_id = created.id
order by links.student_number;
