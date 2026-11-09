-- REVIEW ONLY. Separate teardown after fixtures and Auth users are removed.
-- Confirm these tables were never adopted by the product. No CASCADE.
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
begin
  if (select count(*) from public.e1_private_records) <> 0 or
     (select count(*) from public.accounts) <> 0 then
    raise exception 'Acceptance tables are not empty';
  end if;
end $$;
drop table public.e1_private_records;
drop table public.accounts;
commit;
