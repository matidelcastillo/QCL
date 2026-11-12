import type { Book, BookStatus, CatalogBook } from "../domain/types";
import { identity } from "../domain/metadata";
import { coverCandidate } from "../domain/cover-url";
import { browserSupabase } from "./supabase";

export async function listBooks(ownerId: string): Promise<Book[]> {
  const { data, error } = await browserSupabase()
    .from("books")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Book[];
}

export function duplicate(
  books: Book[],
  candidate: { title: string; author: string; isbn?: string | null },
): Book | undefined {
  if (candidate.isbn) return books.find((book) => book.isbn === candidate.isbn);
  return books.find(
    (book) =>
      identity(book.title) === identity(candidate.title) &&
      identity(book.author) === identity(candidate.author),
  );
}

export type NewBook = Pick<
  CatalogBook,
  "title" | "author" | "isbn" | "coverUrl" | "page_count" | "published_year" | "genre" | "synopsis"
> & {
  source: Book["source"];
  externalId?: string | null;
};

export async function ensureBook(
  ownerId: string,
  input: NewBook,
  status: BookStatus,
): Promise<Book> {
  const existing = duplicate(await listBooks(ownerId), input);
  if (existing) return existing;
  let cover: string | null = null;
  const candidate = coverCandidate(input.coverUrl, input.isbn);
  if (candidate) {
    const params = new URLSearchParams({ u: candidate });
    if (input.isbn) params.set("isbn", input.isbn);
    try {
      const response = await fetch(`/api/tapa?${params}`);
      if (response.ok && response.headers.get("content-type")?.startsWith("image/"))
        cover = response.headers.get("x-qcl-cover-url");
    } catch {
      /* A book can be saved without a cover. */
    }
  }
  const { data, error } = await browserSupabase()
    .from("books")
    .insert({
      owner_id: ownerId,
      title: input.title.trim(),
      author: input.author.trim(),
      status,
      read_at: status === "lei" ? new Date().toISOString().slice(0, 10) : null,
      cover_url: cover,
      isbn: input.isbn ?? null,
      source: input.source,
      external_id: input.externalId ?? null,
      page_count: input.page_count,
      published_year: input.published_year,
      genre: input.genre,
      synopsis: input.synopsis,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Book;
}

export async function setBookStatus(
  ownerId: string,
  bookId: string,
  status: BookStatus,
): Promise<Book> {
  const { data, error } = await browserSupabase()
    .from("books")
    .update({
      status,
      read_at: status === "lei" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", bookId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Book;
}

export async function removeBook(ownerId: string, bookId: string): Promise<void> {
  const { error } = await browserSupabase()
    .from("books")
    .delete()
    .eq("id", bookId)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

export async function profileName(ownerId: string): Promise<string> {
  const { data, error } = await browserSupabase()
    .from("profiles")
    .select("name")
    .eq("id", ownerId)
    .single();
  if (error) throw error;
  return data.name ?? "";
}

export async function saveProfileName(ownerId: string, name: string): Promise<void> {
  const { error } = await browserSupabase()
    .from("profiles")
    .update({ name: name.trim() })
    .eq("id", ownerId);
  if (error) throw error;
}
