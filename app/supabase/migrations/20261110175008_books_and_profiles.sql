-- QCL E2: biblioteca privada y perfil básico.
-- Cada persona ve y toca solo sus filas.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text not null default '',
  status text not null check (status in ('quiero', 'lei')),
  read_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_read_at_only_when_lei check (status = 'lei' or read_at is null)
);

create index books_owner_created_idx on public.books (owner_id, created_at desc);
create index books_owner_status_idx on public.books (owner_id, status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger books_set_updated_at
  before update on public.books
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.books enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy books_select_own
  on public.books for select to authenticated
  using (owner_id = auth.uid());

create policy books_insert_own
  on public.books for insert to authenticated
  with check (owner_id = auth.uid());

create policy books_update_own
  on public.books for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy books_delete_own
  on public.books for delete to authenticated
  using (owner_id = auth.uid());
