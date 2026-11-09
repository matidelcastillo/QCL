-- REVIEW ONLY; do not execute until the operator has created A/B/C in QCL
-- through Auth Admin with email_confirm=true and controlled addresses.
-- Replace every placeholder with the returned QCL UUID. Use distinct values.
begin;
do $$
declare
  a uuid := '<A_USER_UUID>'::uuid;
  b uuid := '<B_USER_UUID>'::uuid;
  c uuid := '<C_USER_UUID>'::uuid;
  ra uuid := '<A_RECORD_UUID>'::uuid;
  rb uuid := '<B_RECORD_UUID>'::uuid;
  rc uuid := '<C_RECORD_UUID>'::uuid;
begin
  if a = b or a = c or b = c or ra = rb or ra = rc or rb = rc then
    raise exception 'Fixture IDs must be distinct';
  end if;
  if (select count(*) from auth.users where id in (a,b,c)
      and email_confirmed_at is not null and is_anonymous is false) <> 3 then
    raise exception 'Expected three confirmed QCL Auth users';
  end if;
  if exists (select 1 from public.accounts where id in (a,b,c)) or
     exists (select 1 from public.e1_private_records where id in (ra,rb,rc)) then
    raise exception 'Fixture IDs already in use';
  end if;
  insert into public.accounts(id, display_name, status)
    values (a,'E1 A','active'), (b,'E1 B','active'), (c,'E1 C','active');
  insert into public.e1_private_records(id, owner_id, title)
    values (ra,a,'E1 A original'), (rb,b,'E1 B original'),
           (rc,c,'E1 C original');
end $$;
commit;
