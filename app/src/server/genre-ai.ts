import { GENRES, OTHER_GENRE, parseGenre } from "../domain/genre";

/* Genre classifier: Workers AI Llama 3.3 70B picks one label from the fixed
   list, given title, author and catalog subjects. Temperature 0, so the same
   input gives the same answer. Measured on the real library: 31/32 right
   with subjects, against 19/32 for Open Library subjects mapped by rules. */
export const GENRE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/* Same cap as the evaluation; also bounds prompt size. */
export const SUBJECT_LIMIT = 25;
export const FIELD_MAX = 200;

export type GenreInput = {
  title: string;
  author: string;
  subjects: string[];
  categories: string[];
};

export type Ai = {
  run: (
    model: string,
    input: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      max_tokens: number;
      temperature: number;
      response_format?: unknown;
    },
  ) => Promise<unknown>;
};

const SYSTEM =
  "You classify books into exactly one genre from a fixed list. Answer with the label only, copied exactly from the list. Use Otros only if none fits.";

export function genrePrompt(input: GenreInput): string {
  const list = (values: string[]) => values.join("; ") || "(none)";
  return [
    `Genres: ${[...GENRES, OTHER_GENRE].join(" | ")}`,
    `Title: ${input.title}`,
    `Author: ${input.author}`,
    `Open Library subjects: ${list(input.subjects)}`,
    `Google categories: ${list(input.categories)}`,
    "Genre:",
  ].join("\n");
}

export async function classifyGenre(ai: Ai, input: GenreInput): Promise<string> {
  const output = await ai.run(GENRE_MODEL, {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: genrePrompt(input) },
    ],
    max_tokens: 8,
    temperature: 0,
  });
  const response =
    output && typeof output === "object" && "response" in output ? output.response : "";
  return parseGenre(typeof response === "string" ? response : "");
}

/* Request body → GenreInput, or null when it is not a usable book. */
export function genreInput(body: unknown): GenreInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, FIELD_MAX) : "";
  const texts = (value: unknown) =>
    Array.isArray(value) ? value.map(text).filter(Boolean).slice(0, SUBJECT_LIMIT) : [];
  const title = text(record.title);
  if (!title) return null;
  return {
    title,
    author: text(record.author),
    subjects: texts(record.subjects),
    categories: texts(record.categories),
  };
}
