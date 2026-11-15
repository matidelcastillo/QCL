-- QCL hardening after the Nov 15 audits.

-- 1. The browser only talks to the API as `authenticated`; anon gets nothing,
--    and nobody needs TRUNCATE / REFERENCES / TRIGGER through the API.
revoke all on table public.books, public.profiles from anon;
revoke truncate, references, trigger on table public.books, public.profiles from authenticated;

-- 2. Generous length caps so no row can carry megabytes of text.
alter table public.books
  add constraint books_title_length check (char_length(title) <= 500),
  add constraint books_author_length check (char_length(author) <= 500),
  add constraint books_isbn_length check (isbn is null or char_length(isbn) <= 13),
  add constraint books_cover_url_length check (cover_url is null or char_length(cover_url) <= 2048),
  add constraint books_external_id_length check (external_id is null or char_length(external_id) <= 200),
  add constraint books_published_year_length check (published_year is null or char_length(published_year) <= 16),
  add constraint books_genre_length check (genre is null or char_length(genre) <= 200),
  add constraint books_synopsis_length check (synopsis is null or char_length(synopsis) <= 20000);
alter table public.profiles
  add constraint profiles_name_length check (char_length(name) <= 80);

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
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3. Gilada uses the app's "same book" rule (data/library.ts duplicate()):
--    same ISBN OR same normalized title + author. Rows sharing an ISBN take
--    one title+author key, so both rules land in the same group.
--    Shown metadata is the version most readers agree on, then catalog
--    rows over manual ones, so one account cannot rewrite what others see.
create or replace function public.most_read_books()
returns table (
  title text,
  author text,
  cover_url text,
  isbn text,
  source text,
  external_id text,
  page_count integer,
  published_year text,
  genre text,
  synopsis text,
  lei_count integer,
  quiero_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      b.*,
      'ta:' || private.book_identity(b.title) || '|' || private.book_identity(b.author) as ta
    from public.books b
  ),
  by_isbn as (
    select isbn, min(ta) as ta from base where isbn is not null group by isbn
  ),
  keyed as (
    select base.*, coalesce(by_isbn.ta, base.ta) as book_key
    from base left join by_isbn on by_isbn.isbn = base.isbn
  ),
  eligible as (
    select k.*
    from keyed k
    where k.owner_id <> (select auth.uid())
      and k.book_key not in (
        select m.book_key from keyed m where m.owner_id = (select auth.uid())
      )
  ),
  versions as (
    select book_key, title, author, cover_url, synopsis, count(distinct owner_id) as votes
    from eligible
    group by book_key, title, author, cover_url, synopsis
  ),
  others as (
    select e.*, v.votes
    from eligible e
    join versions v
      on v.book_key = e.book_key
      and v.title = e.title
      and v.author = e.author
      and v.cover_url is not distinct from e.cover_url
      and v.synopsis is not distinct from e.synopsis
  ),
  grouped as (
    select
      count(distinct owner_id) as readers,
      count(distinct owner_id) filter (where status = 'lei') as lei,
      count(distinct owner_id) filter (where status = 'quiero') as quiero,
      (array_agg(id order by votes desc, (coalesce(source, 'manual') = 'manual'),
        (cover_url is null), created_at))[1] as pick
    from others
    group by book_key
    having count(distinct owner_id) >= 2
  )
  select
    b.title, b.author, b.cover_url, b.isbn, b.source, b.external_id,
    b.page_count, b.published_year, b.genre, b.synopsis,
    g.lei::integer, g.quiero::integer
  from grouped g
  join public.books b on b.id = g.pick
  order by g.readers desc, g.lei desc, b.title
  limit 10;
$$;

revoke all on function public.most_read_books() from public, anon;
grant execute on function public.most_read_books() to authenticated;
