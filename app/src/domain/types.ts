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

/* Catalog result. Genre is not decided here: subjects (Open Library work
   subjects) and categories (Google) feed the genre classifier on save. */
export type CatalogBook = Pick<
  Book,
  "title" | "author" | "isbn" | "page_count" | "published_year" | "synopsis"
> & {
  coverUrl: string | null;
  source: "openlibrary" | "google";
  externalId: string;
  subjects: string[];
  categories: string[];
};

/* Row of public.most_read_books(): one shared book, counts only, no identities. */
export type SharedBook = Omit<CatalogBook, "source" | "externalId" | "subjects" | "categories"> & {
  genre: string | null;
  source: Book["source"];
  externalId: string | null;
  leiCount: number;
  quieroCount: number;
};
