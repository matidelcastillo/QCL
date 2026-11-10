-- QCL E3: tapa, ISBN e id externo para altas desde el catálogo.

alter table public.books
  add column if not exists cover_url text,
  add column if not exists isbn text,
  add column if not exists source text,
  add column if not exists external_id text;

create index if not exists books_owner_isbn_idx on public.books (owner_id, isbn);
