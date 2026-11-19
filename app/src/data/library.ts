import type { Book, BookStatus, CatalogBook, SharedBook } from "../domain/types";
import { today } from "../domain/date";
import { coverParams } from "../domain/cover-url";
import { knownGenre, OTHER_GENRE } from "../domain/genre";
import { identity } from "../domain/metadata";
import { apiUrl } from "./api-base";
import { checked } from "./auth-guard";
import { browserSupabase } from "./supabase";

export async function listBooks(ownerId: string): Promise<Book[]> {
  const data = checked(
    await browserSupabase()
      .from("books")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
  );
  return (data ?? []) as Book[];
}

/* Same book = same ISBN, or same normalized title + author (identity(),
   mirrored in SQL by private.book_identity) whether or not either side has
   an ISBN. */
export function duplicate(
  books: Book[],
  candidate: { title: string; author: string; isbn?: string | null },
): Book | undefined {
  const title = identity(candidate.title);
  const author = identity(candidate.author);
  return books.find(
    (book) =>
      (candidate.isbn && book.isbn === candidate.isbn) ||
      (identity(book.title) === title && identity(book.author) === author),
  );
}

const UNIQUE_VIOLATION = "23505";

export type NewBook = Pick<
  Book,
  | "title"
  | "author"
  | "isbn"
  | "source"
  | "external_id"
  | "page_count"
  | "published_year"
  | "genre"
  | "synopsis"
> & {
  coverUrl: string | null;
  /* Classifier input for a catalog book; never stored. */
  subjects: string[];
  categories: string[];
};

export function toNewBook(book: Book | CatalogBook | SharedBook): NewBook {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    source: book.source,
    external_id: "externalId" in book ? book.externalId : book.external_id,
    page_count: book.page_count,
    published_year: book.published_year,
    genre: "genre" in book ? book.genre : null,
    synopsis: book.synopsis,
    coverUrl: "coverUrl" in book ? book.coverUrl : book.cover_url,
    subjects: "subjects" in book ? book.subjects : [],
    categories: "categories" in book ? book.categories : [],
  };
}

/* Book columns of a NewBook: the cover is validated and the classifier input
   consumed before insert, neither is a column. */
function columns({ coverUrl, subjects, categories, ...fields }: NewBook) {
  return fields;
}

/* Optimistic row shown while the insert is in flight. */
export function pendingBook(ownerId: string, input: NewBook, status: BookStatus): Book {
  const now = new Date().toISOString();
  return {
    ...columns(input),
    id: `pending:${now}`,
    owner_id: ownerId,
    status,
    read_at: status === "lei" ? today() : null,
    cover_url: input.coverUrl,
    created_at: now,
    updated_at: now,
  };
}

/* Only a cover that passed /api/tapa validation is stored; the server falls
   back to other sources by ISBN, then to another edition by title + author. */
async function validatedCover(input: NewBook): Promise<string | null> {
  const params = coverParams(input.coverUrl, input.isbn);
  params.set("t", input.title.trim());
  if (input.author.trim()) params.set("a", input.author.trim());
  try {
    const response = await fetch(apiUrl(`/api/tapa?${params}`));
    return response.ok ? response.headers.get("x-qcl-cover-url") : null;
  } catch {
    return null;
  }
}

/* Genre is decided once, when the book is saved: a known genre (a book
   already in someone's library) is kept, otherwise the server classifier
   picks one. A failed call stores no genre (the book shows under Otros). */
async function classifiedGenre(input: NewBook): Promise<string | null> {
  if (knownGenre(input.genre) || input.genre === OTHER_GENRE) return input.genre;
  try {
    const response = await fetch(apiUrl("/api/genero"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        author: input.author,
        subjects: input.subjects,
        categories: input.categories,
      }),
    });
    if (!response.ok) return null;
    const { genre } = (await response.json()) as { genre?: unknown };
    return typeof genre === "string" ? genre : null;
  } catch {
    return null;
  }
}

export async function ensureBook(
  ownerId: string,
  input: NewBook,
  status: BookStatus,
): Promise<Book> {
  /* Already saved: keep the row, but honor the Quiero/Leí just chosen. */
  const existing = duplicate(await listBooks(ownerId), input);
  if (existing)
    return existing.status === status ? existing : setBookStatus(ownerId, existing.id, status);
  const [coverUrl, genre] = await Promise.all([validatedCover(input), classifiedGenre(input)]);
  const result = await browserSupabase()
    .from("books")
    .insert({
      ...columns(input),
      genre,
      owner_id: ownerId,
      title: input.title.trim(),
      author: input.author.trim(),
      status,
      read_at: status === "lei" ? today() : null,
      cover_url: coverUrl,
    })
    .select("*")
    .single();
  if (result.error?.code === UNIQUE_VIOLATION) {
    /* books_owner_isbn_unique: another tab saved it first. */
    const saved = duplicate(await listBooks(ownerId), input);
    if (saved) return saved.status === status ? saved : setBookStatus(ownerId, saved.id, status);
  }
  return checked(result) as Book;
}

export async function setBookStatus(
  ownerId: string,
  bookId: string,
  status: BookStatus,
): Promise<Book> {
  const data = checked(
    await browserSupabase()
      .from("books")
      .update({ status, read_at: status === "lei" ? today() : null })
      .eq("id", bookId)
      .eq("owner_id", ownerId)
      .select("*")
      .single(),
  );
  return data as Book;
}

export async function removeBook(ownerId: string, bookId: string): Promise<void> {
  checked(await browserSupabase().from("books").delete().eq("id", bookId).eq("owner_id", ownerId));
}
