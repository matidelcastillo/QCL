-- REVIEW ONLY. Separate teardown after fixtures and Auth users are removed.
-- Confirm these tables were never adopted by the product. No CASCADE.
begin;
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
