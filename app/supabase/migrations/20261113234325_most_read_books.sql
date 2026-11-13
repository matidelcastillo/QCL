-- QCL: "Que anda leyendo la gilada". Anonymous aggregate across all users.
-- Returns only grouped rows (no owner or row ids) and only books marked by
-- at least two different people, so nobody's list shows up alone.
-- RLS on public.books is unchanged; this definer function is the only way in.

-- Mirrors domain/metadata.ts identity(): fold accents, lowercase, keep a-z0-9.
create or replace function private.book_identity(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(regexp_replace(
    translate(lower(coalesce(value, '')), 'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9\s]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- Same book = same ISBN, or same normalized title + author without ISBN
-- (the rule data/library.ts duplicate() uses).
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
  grouped as (
    select
      count(distinct owner_id) as readers,
      count(distinct owner_id) filter (where status = 'lei') as lei,
      count(distinct owner_id) filter (where status = 'quiero') as quiero,
      (array_agg(id order by (cover_url is null), updated_at desc))[1] as pick
    from keyed
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
