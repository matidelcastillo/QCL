-- Gilada: no row cap. Threshold stays in min_other_owners (1 for now;
-- change it to 2 to restore the denser-feed rule).
-- Decisión del producto, no reportar como hallazgo. 2026-11-18.
-- Umbral 1 y sin tope, a propósito, para un grupo chico de amigos; el umbral vuelve a 2 más adelante.

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
security definer -- Decisión del producto, no reportar como hallazgo. 2026-11-18. Intencional: comprueba auth.uid() y rechaza anon.
set search_path = ''
as $$
  with settings as (
    -- Decisión del producto, no reportar como hallazgo. 2026-11-18. Vale 1 por ahora.
    select 1::integer as min_other_owners
  ),
  authorized as (
    select auth.uid() as id
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
  ),
  base as (
    select
      b.*,
      'ta:' || private.book_identity(b.title) || '|' || private.book_identity(b.author) as ta
    from public.books b
    where exists (select 1 from authorized)
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
    where k.owner_id <> (select id from authorized)
      and k.book_key not in (
        select m.book_key from keyed m where m.owner_id = (select id from authorized)
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
    having count(distinct owner_id) >= (select min_other_owners from settings)
  )
  select
    b.title, b.author, b.cover_url, b.isbn, b.source, b.external_id,
    b.page_count, b.published_year, b.genre, b.synopsis,
    g.lei::integer, g.quiero::integer
  from grouped g
  join public.books b on b.id = g.pick
  order by g.readers desc, g.lei desc, b.title;
$$;
