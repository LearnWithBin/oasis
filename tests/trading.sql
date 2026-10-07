-- Run after the trading migration, inside a transaction that is rolled back.
-- All students, items and balances below are temporary test fixtures.
do $$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); uc uuid:=gen_random_uuid();
  cls uuid:=gen_random_uuid(); other_cls uuid:=gen_random_uuid();
  ia uuid; ib uuid; sale_item uuid; stale_item uuid; offer uuid; result text;
begin
  insert into auth.users(id) values(ua),(ub),(uc);
  insert into public.classes(id,slug,title) values(cls,'trade-test-'||cls,'Trading test'),(other_cls,'trade-test-'||other_cls,'Other class');
  insert into public.oases(id,class_id,student_number,invite_hash,owner_auth_uid,oasis_name,stars)
    values(a,cls,1,a::text,ua,'Test A',10),(b,cls,2,b::text,ub,'Test B',10),(c,other_cls,1,c::text,uc,'Outside',10);
  insert into public.items(oasis_id,item_type,slot_index)
    select a,'tent',s from generate_series(0,7) s union all select b,'palms',s from generate_series(0,7) s;
  select id into ia from public.items where oasis_id=a and slot_index=0;
  select id into ib from public.items where oasis_id=b and slot_index=0;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  assert (select count(*)=1 from public.trade_peers()), 'classmate visibility';
  assert not exists(select 1 from public.trade_peers() where id=c), 'outside class hidden';
  begin
    perform public.create_trade_offer(c,ia,null,3);
    raise exception 'TEST FAILED: cross-class offer allowed';
  exception when others then
    if sqlerrm not like 'Choose another student%' then raise; end if;
  end;
  begin
    perform public.create_trade_offer(b,ib,null,3);
    raise exception 'TEST FAILED: someone else item allowed';
  exception when others then
    if sqlerrm not like 'Choose an item you own%' then raise; end if;
  end;
  begin
    perform public.create_trade_offer(b,ia,'tent',3);
    raise exception 'TEST FAILED: ambiguous payment allowed';
  exception when others then
    if sqlerrm not like 'Choose one item%' then raise; end if;
  end;
  offer:=public.create_trade_offer(b,ia,null,3);
  begin
    perform public.create_trade_offer(b,ia,null,3);
    raise exception 'TEST FAILED: duplicate offer allowed';
  exception when others then
    if sqlerrm not like 'This item already has an offer%' then raise; end if;
  end;
  begin
    perform public.resolve_trade_offer(offer,true);
    raise exception 'TEST FAILED: sender accepted own offer';
  exception when others then
    if sqlerrm not like 'Only the recipient%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',uc::text,true);
  assert (select count(*)=0 from public.my_trade_offers()), 'outsider inbox hidden';
  begin
    perform public.resolve_trade_offer(offer,false);
    raise exception 'TEST FAILED: outsider declined offer';
  exception when others then
    if sqlerrm not like 'This is not your offer%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',ub::text,true);
  begin
    perform public.resolve_trade_offer(offer,true);
    raise exception 'TEST FAILED: sale into full Oasis';
  exception when others then
    if sqlerrm not like 'Make an empty building spot%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  assert public.resolve_trade_offer(offer,false)='cancelled', 'cancel status';
  offer:=public.create_trade_offer(b,ia,'palms',null);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert public.resolve_trade_offer(offer,true,ib)='accepted', 'full Oasis barter';
  assert exists(select 1 from public.items where id=ia and oasis_id=b and slot_index=0), 'received tent placement';
  assert exists(select 1 from public.items where id=ib and oasis_id=a and slot_index=0), 'received palms placement';
  assert (select sum(stars)=20 from public.oases where id in (a,b)), 'barter changed stars';
  begin
    perform public.resolve_trade_offer(offer,true,ib);
    raise exception 'TEST FAILED: double acceptance';
  exception when others then
    if sqlerrm not like 'This offer is no longer pending%' then raise; end if;
  end;
  -- Make one building space, then test a star sale with insufficient funds first.
  delete from public.items where oasis_id=b and slot_index=7;
  select id into sale_item from public.items where oasis_id=a and slot_index=1;
  perform set_config('request.jwt.claim.sub',ua::text,true);
  offer:=public.create_trade_offer(b,sale_item,null,3);
  update public.oases set stars=2 where id=b;
  perform set_config('request.jwt.claim.sub',ub::text,true);
  begin
    perform public.resolve_trade_offer(offer,true);
    raise exception 'TEST FAILED: overspending';
  exception when others then
    if sqlerrm not like 'You need more stars%' then raise; end if;
  end;
  assert exists(select 1 from public.items where id=sale_item and oasis_id=a), 'failed sale moved item';
  assert (select stars=10 from public.oases where id=a), 'failed sale changed seller stars';
  update public.oases set stars=10 where id=b;
  assert public.resolve_trade_offer(offer,true)='accepted', 'star sale';
  assert (select stars=13 from public.oases where id=a), 'seller paid';
  assert (select stars=7 from public.oases where id=b), 'buyer charged';
  assert (select count(*)=2 and sum(delta)=0 from public.star_ledger where source_key='trade:'||offer::text), 'balanced ledger';
  -- Declined offers leave ownership intact; stale and expired offers cannot move items.
  perform set_config('request.jwt.claim.sub',ua::text,true);
  select id into stale_item from public.items where oasis_id=a and slot_index=2;
  offer:=public.create_trade_offer(b,stale_item,'palms',null);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert public.resolve_trade_offer(offer,false)='declined', 'recipient decline';
  assert exists(select 1 from public.items where id=stale_item and oasis_id=a), 'decline moved item';
  perform set_config('request.jwt.claim.sub',ua::text,true);
  offer:=public.create_trade_offer(b,stale_item,null,2);
  perform public.sell_item(stale_item);
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert (select status='invalid' from public.my_trade_offers() where id=offer), 'stale offer hidden';
  assert public.resolve_trade_offer(offer,true)='invalid', 'stale offer accepted';
  perform set_config('request.jwt.claim.sub',ua::text,true);
  select id into stale_item from public.items where oasis_id=a and slot_index=3;
  offer:=public.create_trade_offer(b,stale_item,null,2);
  update public.trade_offers set expires_at=now()-interval '1 second' where id=offer;
  perform set_config('request.jwt.claim.sub',ub::text,true);
  assert public.resolve_trade_offer(offer,true)='expired', 'expired offer accepted';
  assert not has_table_privilege('authenticated','public.trade_offers','SELECT'), 'direct offer reads allowed';
  assert not has_function_privilege('anon','public.create_trade_offer(uuid,uuid,text,integer)','EXECUTE'), 'anonymous trade mutation allowed';
  assert not exists(select 1 from public.oases where id in (a,b) and stars<0), 'negative balance';
  assert not exists(select 1 from public.items where oasis_id in (a,b) group by oasis_id,slot_index having count(*)>1), 'overlapping items';
  perform set_config('request.jwt.claim.sub',ua::text,true);
  perform set_config('oasis.test_actor',ua::text,true);
end $$;
set local role authenticated;
-- Verify the public wrappers work under the actual browser role.
select count(*)=1 as authenticated_classmate_read from public.trade_peers();
reset role;
select 'PASS: barter, stars, full inventory, ownership, class isolation, duplicate/stale/expired offers, decline/cancel, role permissions and ledger' as result;
