import type { LeoAnswers } from "../domain/leo";
import { apiUrl } from "./api-base";
import { browserSupabase } from "./supabase";

export type LeoResult = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  isbn: string | null;
  source: "openlibrary" | "google" | "manual";
  externalId: string;
  page_count: number | null;
  published_year: string | null;
  genre: string | null;
  synopsis: string | null;
  subjects: string[];
  categories: string[];
  buyLink: string | null;
  value: string;
  inQuiero: boolean;
  inGilada: boolean;
};

export type LeoResponse = { results: LeoResult[]; note: string | null };

export async function requestLeo(answers: LeoAnswers): Promise<LeoResponse> {
  const { data } = await browserSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("auth");
  const response = await fetch(apiUrl("/api/leo"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(answers),
  });
  if (!response.ok) throw new Error(`leo:${response.status}`);
  const body = (await response.json()) as { results?: LeoResult[]; note?: string | null };
  return {
    results: Array.isArray(body.results) ? body.results : [],
    note: typeof body.note === "string" && body.note.trim() ? body.note : null,
  };
}
