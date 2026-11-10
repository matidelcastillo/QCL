import { todayIsoDate } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { Book, BookStatus, CatalogBook } from "@/lib/types";

export const BOOK_COLUMNS =
  "id, owner_id, title, author, status, read_at, cover_url, isbn, source, external_id, created_at, updated_at";

export async function insertBook(input: {
  ownerId: string;
  title: string;
  author: string;
  status: BookStatus;
  readAt?: string | null;
  coverUrl?: string | null;
  isbn?: string | null;
  source?: string | null;
  externalId?: string | null;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("books")
    .insert({
      owner_id: input.ownerId,
      title: input.title.trim(),
      author: input.author.trim(),
      status: input.status,
      read_at: input.status === "lei" ? input.readAt || todayIsoDate() : null,
      cover_url: input.coverUrl ?? null,
      isbn: input.isbn ?? null,
      source: input.source ?? null,
      external_id: input.externalId ?? null,
    });
  if (error) throw error;
}

export async function insertCatalogBook(
  ownerId: string,
  book: CatalogBook,
  status: BookStatus,
): Promise<void> {
  await insertBook({
    ownerId,
    title: book.title,
    author: book.author,
    status,
    coverUrl: book.coverUrl,
    isbn: book.isbn,
    source: book.source,
    externalId: book.externalId,
  });
}

export function asBooks(data: unknown): Book[] {
  return (data ?? []) as Book[];
}
