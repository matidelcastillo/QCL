-- A signed-in person can delete only their own account.
-- The privileged body lives in private (not in the Data API).
-- public.delete_own_account is the RPC the app calls.

create or replace function private.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.books where owner_id = caller;
  delete from public.profiles where id = caller;
  delete from auth.users where id = caller;
end;
$$;

revoke all on function private.delete_own_account() from public, anon, authenticated;

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.delete_own_account();
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
