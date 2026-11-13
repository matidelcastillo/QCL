export type BookStatus = "quiero" | "lei";

export type Book = {
  id: string;
  owner_id: string;
  title: string;
  author: string;
  status: BookStatus;
  read_at: string | null;
  cover_url: string | null;
  isbn: string | null;
  source: "openlibrary" | "google" | "manual";
  external_id: string | null;
  page_count: number | null;
  published_year: string | null;
  genre: string | null;
  synopsis: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogBook = Pick<
  Book,
  "title" | "author" | "isbn" | "page_count" | "published_year" | "genre" | "synopsis"
> & {
  coverUrl: string | null;
  source: "openlibrary" | "google";
  externalId: string;
};

/* Row of public.most_read_books(): one shared book, counts only, no identities. */
export type SharedBook = Omit<CatalogBook, "source" | "externalId"> & {
  source: Book["source"];
  externalId: string | null;
  leiCount: number;
  quieroCount: number;
};
