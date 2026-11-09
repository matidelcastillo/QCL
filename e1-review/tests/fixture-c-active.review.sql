-- REVIEW ONLY. Run at the second operator gate for the exact C UUID.
begin;
do $$
declare c uuid := '<C_USER_UUID>'::uuid;
begin
  update public.accounts set status='active'
    where id=c and status='deletion_pending' and display_name='E1 C';
  if not found then raise exception 'Expected pending E1 C account'; end if;
end $$;
commit;
