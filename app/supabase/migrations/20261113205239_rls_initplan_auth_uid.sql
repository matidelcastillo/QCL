-- Same policies, same semantics: wrap auth.uid() in a scalar subquery so
-- Postgres evaluates it once per statement instead of once per row
-- (Supabase advisor 0003_auth_rls_initplan).

alter policy profiles_select_own on public.profiles
  using (id = (select auth.uid()));

alter policy profiles_insert_own on public.profiles
  with check (id = (select auth.uid()));

alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy books_select_own on public.books
  using (owner_id = (select auth.uid()));

alter policy books_insert_own on public.books
  with check (owner_id = (select auth.uid()));

alter policy books_update_own on public.books
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy books_delete_own on public.books
  using (owner_id = (select auth.uid()));
