-- REVIEW ONLY. Target: QCL mdytuysdombxyydqnsmj. NOT APPLIED.
-- This creates persistent acceptance-test tables, NOT disposable fixtures
-- or the definitive v4 schema. Removal requires a separate reviewed step.
-- Verified 2026-11-07: public has no relations, policies, functions, triggers,
-- or user migrations. Auth has no users. Do not apply without approval.
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

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  status text not null default 'active'
    check (status in ('active', 'deletion_pending'))
);

alter table public.accounts enable row level security;
revoke all on table public.accounts from public, anon, authenticated;
grant select on table public.accounts to authenticated;

create policy account_self_read
on public.accounts
for select
to authenticated
using (
  id = (select auth.uid())
  and status = 'active'
);

-- Acceptance-only records. This is not the future works/user_books model.
-- Accounts and fixtures require a separately reviewed operator-only step.
create table public.e1_private_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.accounts(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 500)
);

create index e1_private_records_owner_idx
  on public.e1_private_records(owner_id);

alter table public.e1_private_records enable row level security;
revoke all on table public.e1_private_records from public, anon, authenticated;
grant select on table public.e1_private_records to authenticated;
grant update (title) on table public.e1_private_records to authenticated;

create policy e1_own_read
on public.e1_private_records
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.accounts as account
    where account.id = (select auth.uid())
      and account.status = 'active'
  )
);

create policy e1_own_update
on public.e1_private_records
for update
to authenticated
using (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.accounts as account
    where account.id = (select auth.uid())
      and account.status = 'active'
  )
)
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.accounts as account
    where account.id = (select auth.uid())
      and account.status = 'active'
  )
);

-- Intentionally absent: anon access, client INSERT/DELETE, account writes,
-- owner changes, views, triggers, and SECURITY DEFINER functions.
commit;
