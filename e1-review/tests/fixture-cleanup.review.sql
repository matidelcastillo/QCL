-- REVIEW ONLY. After acceptance: remove the exact A/B/C fixture rows/accounts.
-- Replace all placeholders. Verify counts and IDs before running.
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
  if (select count(*) from public.e1_private_records
      where (id=ra and owner_id=a) or (id=rb and owner_id=b) or
            (id=rc and owner_id=c)) <> 3 then
    raise exception 'Fixture record mismatch';
  end if;
  if (select count(*) from public.accounts where
      (id=a and display_name='E1 A') or
      (id=b and display_name='E1 B') or
      (id=c and display_name='E1 C')) <> 3 then
    raise exception 'Fixture account mismatch';
  end if;
  delete from public.e1_private_records where id in (ra,rb,rc);
  delete from public.accounts where id in (a,b,c);
end $$;
commit;
-- Then remove A/B/C with Auth Admin deleteUser, checking the exact IDs.
-- After verifying both tables are empty and have no dependent objects, a
-- separately reviewed migration may DROP e1_private_records then accounts.
