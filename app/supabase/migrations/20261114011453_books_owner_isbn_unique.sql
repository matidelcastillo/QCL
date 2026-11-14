-- DB guard for duplicates: one row per owner and ISBN. Title + author
-- duplicates stay an app rule (data/library.ts duplicate()) because older
-- rows may already repeat them.
create unique index books_owner_isbn_unique on public.books (owner_id, isbn) where isbn is not null;
drop index if exists public.books_owner_isbn_idx;
