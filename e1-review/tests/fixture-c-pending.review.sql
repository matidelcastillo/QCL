-- REVIEW ONLY. Run at the first operator gate for the exact C UUID.
begin;
do $$
declare c uuid := '<C_USER_UUID>'::uuid;
begin
  update public.accounts set status='deletion_pending'
    where id=c and status='active' and display_name='E1 C';
  if not found then raise exception 'Expected active E1 C account'; end if;
end $$;
commit;
