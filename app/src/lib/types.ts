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
  source: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type CatalogBook = {
  title: string;
  author: string;
  year: string | null;
  coverUrl: string | null;
  isbn: string | null;
  source: "google" | "openlibrary";
  externalId: string;
  language: string | null;
};
