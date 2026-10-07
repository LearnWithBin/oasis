-- Temporary fixtures; run inside BEGIN / ROLLBACK after the goats migration.
do $$
declare
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); cls uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); goat uuid; payment uuid; offer uuid;
begin
  insert into auth.users(id) values(ua),(ub);
  insert into public.classes(id,slug,title) values(cls,'goat-test-'||cls,'Goat test');
  insert into public.oases(id,class_id,student_number,invite_hash,owner_auth_uid,oasis_name,stars)
    values(a,cls,1,a::text,ua,'Goat A',200),(b,cls,2,b::text,ub,'Goat B',200);
  perform set_config('request.jwt.claim.sub',ua::text,true);
  begin
    perform public.purchase_item('goat',8);
    raise exception 'TEST FAILED: locked land purchase';
  exception when others then if sqlerrm not like 'That land has not opened yet%' then raise; end if; end;
  perform public.purchase_item('goat',0);
  assert (select stars=192 from public.oases where id=a), 'goat price';
  select id into goat from public.items where oasis_id=a and slot_index=0;
  set constraints expand_oasis_land immediate;
  for slot in 1..5 loop perform public.purchase_item('palms',slot); end loop;
  assert (select land_level=2 from public.oases where id=a), 'six items open more land';
  perform public.move_item(goat,15);
  assert exists(select 1 from public.items where id=goat and slot_index=15), 'goat moves across areas';
  begin
    perform public.move_item(goat,16);
    raise exception 'TEST FAILED: move into locked land';
  exception when others then if sqlerrm not like 'That land has not opened yet%' then raise; end if; end;
  assert public.sell_item(goat)=4, 'goat refund';
  assert (select land_level=2 from public.oases where id=a), 'land shrinks on sale';
  perform public.purchase_item('goat',8);
  select id into goat from public.items where oasis_id=a and slot_index=8;
  for slot in 9..15 loop perform public.purchase_item('palms',slot); end loop;
  perform public.purchase_item('palms',0);
  assert (select land_level=3 from public.oases where id=a), 'fourteen items open third area';
  -- The receiver has all 32 spaces occupied; a goat-for-palms swap still fits.
  insert into public.items(oasis_id,item_type,slot_index) select b,'palms',s from generate_series(0,31) s;
  assert (select land_level=4 from public.oases where id=b), 'fourth area opens';
  offer:=public.create_trade_offer(b,goat,'palms',null);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  select id into payment from public.items where oasis_id=b and slot_index=0;
  assert public.resolve_trade_offer(offer,true,payment)='accepted', 'goat barter';
  assert exists(select 1 from public.items where id=goat and oasis_id=b and slot_index=0), 'received goat saved';
  assert (select count(*)=32 from public.items where oasis_id=b), 'full inventory lost item';
  perform set_config('request.jwt.claim.sub',ua::text,true);
  offer:=public.create_trade_offer(b,payment,'goat',null);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert public.resolve_trade_offer(offer,true,goat)='accepted', 'goat requested as payment';
  -- A star sale finds an expanded-space slot instead of incorrectly limiting to 0..7.
  delete from public.items where oasis_id=b and slot_index=31;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  offer:=public.create_trade_offer(b,goat,null,8);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert public.resolve_trade_offer(offer,true)='accepted', 'goat star sale';
  assert exists(select 1 from public.items where id=goat and oasis_id=b and slot_index=31), 'expanded trading slot';
  assert (select land_level=4 from public.oases where id=b), 'expanded land saved';
  begin
    perform public.purchase_item('goat',32);
    raise exception 'TEST FAILED: slot outside world';
  exception when others then if sqlerrm not like 'That land has not opened yet%' then raise; end if; end;
end $$;
select 'PASS: goat price/refund, saved ownership, permanent expansion, locked slots, full-inventory barter and expanded star-sale space' as result;
