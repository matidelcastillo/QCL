-- REVIEW ONLY. After acceptance: remove the exact A/B/C fixture rows/accounts.
-- Replace all placeholders. Verify counts and IDs before running.
-- QCL session guard: the operator must set this on the SAME connection first:
--   select set_config('qcl.expected_ref', 'mdytuysdombxyydqnsmj', false);
-- This aborts unless that session setting equals the QCL ref. It does NOT prove
-- the TCP endpoint, dashboard project, or service-role credentials by itself.
begin;
do $$
begin
  if current_setting('qcl.expected_ref', true) is distinct from 'mdytuysdombxyydqnsmj' then
    raise exception
      'Abort: set qcl.expected_ref to mdytuysdombxyydqnsmj on this session before running QCL review SQL';
  end if;
end $$;
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
  -- Abort if A/B/C own any rows beyond the three expected fixtures.
  -- Deleting accounts would CASCADE-remove those extras via owner_id.
  if exists (
    select 1 from public.e1_private_records
    where owner_id in (a,b,c) and id not in (ra,rb,rc)
  ) then
    raise exception
      'Unexpected e1_private_records owned by A/B/C; aborting before cascade deletion';
  end if;
  if (select count(*) from public.e1_private_records where owner_id in (a,b,c)) <> 3 then
    raise exception 'A/B/C must own exactly the three fixture records';
  end if;
  if (select count(*) from public.accounts where
      (id=a and display_name='E1 A') or
      (id=b and display_name='E1 B') or
      (id=c and display_name='E1 C')) <> 3 then
    raise exception 'Fixture account mismatch';
  end if;
  -- This package only defines e1_private_records as dependent on accounts.
  -- No other dependent relations are checked here.
  delete from public.e1_private_records where id in (ra,rb,rc);
  delete from public.accounts where id in (a,b,c);
end $$;
commit;
-- Then remove A/B/C with Auth Admin deleteUser, checking the exact IDs.
-- After verifying both tables are empty and have no dependent objects, a
-- separately reviewed migration may DROP e1_private_records then accounts.
