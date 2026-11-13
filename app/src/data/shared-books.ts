import { useQuery } from "@tanstack/react-query";
import type { SharedBook } from "../domain/types";
import { browserSupabase } from "./supabase";

type Row = {
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  source: SharedBook["source"];
  external_id: string | null;
  page_count: number | null;
  published_year: string | null;
  genre: string | null;
  synopsis: string | null;
  lei_count: number;
  quiero_count: number;
};

/* Aggregate across all users via the definer function; it never returns ids. */
export async function listSharedBooks(): Promise<SharedBook[]> {
  const { data, error } = await browserSupabase().rpc("most_read_books");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => ({
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url,
    isbn: row.isbn,
    source: row.source,
    externalId: row.external_id,
    page_count: row.page_count,
    published_year: row.published_year,
    genre: row.genre,
    synopsis: row.synopsis,
    leiCount: row.lei_count,
    quieroCount: row.quiero_count,
  }));
}

export function useSharedBooks(enabled: boolean) {
  return useQuery({ queryKey: ["shared-books"], queryFn: listSharedBooks, enabled });
}

export function sharedCounts(book: SharedBook): string[] {
  return [
    book.leiCount > 0 ? `${book.leiCount} ${book.leiCount === 1 ? "lo leyó" : "lo leyeron"}` : null,
    book.quieroCount > 0
      ? `${book.quieroCount} ${book.quieroCount === 1 ? "lo quiere" : "lo quieren"}`
      : null,
  ].filter((part): part is string => Boolean(part));
}
