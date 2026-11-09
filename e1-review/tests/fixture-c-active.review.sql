-- REVIEW ONLY. Run at the second operator gate for the exact C UUID.
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
declare c uuid := '<C_USER_UUID>'::uuid;
begin
  update public.accounts set status='active'
    where id=c and status='deletion_pending' and display_name='E1 C';
  if not found then raise exception 'Expected pending E1 C account'; end if;
end $$;
commit;
