ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS published_year text,
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS synopsis text;

ALTER TABLE public.books
  DROP CONSTRAINT IF EXISTS books_page_count_positive;
ALTER TABLE public.books
  ADD CONSTRAINT books_page_count_positive
  CHECK (page_count IS NULL OR page_count > 0);