-- Gilada grouping: rows sharing an ISBN and rows with the same title+author
-- as any of them are one book (the 20261115221040 version split a manual row
-- from an ISBN group whose catalog title differed).

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
    select isbn, min(ta) as canon from base where isbn is not null group by isbn
  ),
  -- Every title+author seen next to an ISBN maps to that ISBN group, so a
  -- manual row (no ISBN) or another edition title joins the same book.
  by_ta as (
    select base.ta, min(by_isbn.canon) as canon
    from base join by_isbn on by_isbn.isbn = base.isbn
    group by base.ta
  ),
  keyed as (
    select base.*, coalesce(by_ta.canon, base.ta) as book_key
    from base left join by_ta on by_ta.ta = base.ta
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
