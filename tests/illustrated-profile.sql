-- Run in a transaction and roll back. Only temporary fixtures are touched.
do $$
declare ua uuid:=gen_random_uuid();ub uuid:=gen_random_uuid();cls uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();profile jsonb;
begin
 insert into auth.users(id) values(ua),(ub);
 insert into public.classes(id,slug,title) values(cls,'avatar-test-'||cls,'Avatar test');
 insert into public.oases(id,class_id,student_number,invite_hash,owner_auth_uid,oasis_name,stars) values(a,cls,1,a::text,ua,'Avatar A',70),(b,cls,2,b::text,ub,'Avatar B',80);
 perform set_config('request.jwt.claim.sub',ua::text,true);
 profile:='{"skin":"#a86843","hair":"#e7eaf0","clothes":"#ee9b52","style":"boy","colors":{"girl":{"skin":"#7a4b33","hair":"#e8cf86","outfit":"","scarf":""},"boy":{"skin":"","hair":"","outfit":"#4b9aaf","scarf":"#ad6e96"}}}'::jsonb;
 perform public.set_oasis_profile('Lateef',profile);
 assert (select avatar=profile and oasis_name='Lateef' and stars=70 from public.oases where id=a),'save illustrated colors and preserve stars';
 assert (select oasis_name='Avatar B' and stars=80 from public.oases where id=b),'another student untouched';
 begin perform public.set_oasis_profile('Lateef',jsonb_set(profile,'{colors,boy,outfit}','"#00ff00"'));raise exception 'TEST FAILED invalid color';exception when others then if sqlerrm not like 'Choose the available avatar colors%' then raise;end if;end;
 begin perform public.set_oasis_profile('Lateef',jsonb_set(profile,'{colors,boy,skin}','null'));raise exception 'TEST FAILED null color';exception when others then if sqlerrm not like 'Choose the available avatar colors%' then raise;end if;end;
 perform public.set_oasis_profile('Old view',profile-array['style','colors']);
 assert (select avatar->'colors'=profile->'colors' and avatar->>'style'='boy' from public.oases where id=a),'original view retains illustrated settings';
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.set_oasis_profile('Lateef',profile);raise exception 'TEST FAILED no auth';exception when others then if sqlerrm not like 'Open your personal Oasis link%' then raise;end if;end;
end;$$;
select 'PASS: separate avatar colors, validation, ownership, existing stars and legacy settings preserved' as result;
