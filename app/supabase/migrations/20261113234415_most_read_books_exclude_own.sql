-- Gilada list excludes every book the caller already has (same key as
-- most_read_books), and counts come only from other people (still >= 2).

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
  with keyed as (
    select
      b.id,
      b.owner_id,
      b.status,
      b.cover_url,
      b.updated_at,
      coalesce(
        nullif(b.isbn, ''),
        'ta:' || private.book_identity(b.title) || '|' || private.book_identity(b.author)
      ) as book_key
    from public.books b
  ),
  mine as (
    select book_key from keyed where owner_id = (select auth.uid())
  ),
  grouped as (
    select
      count(distinct owner_id) as readers,
      count(distinct owner_id) filter (where status = 'lei') as lei,
      count(distinct owner_id) filter (where status = 'quiero') as quiero,
      (array_agg(id order by (cover_url is null), updated_at desc))[1] as pick
    from keyed
    where owner_id <> (select auth.uid())
      and book_key not in (select book_key from mine)
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
