import { identity } from "../domain/metadata";
import type { LeoAnchor, LeoAnswers } from "../domain/leo";
import type { Book, CatalogBook, SharedBook } from "../domain/types";
import { CatalogUnavailable, searchCatalogQuick } from "./catalog";
import type { Ai } from "./genre-ai";

export const LEO_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const LEO_PICKS = 6;
const CANDIDATE_CAP = 24;
const LINE_MAX = 80;

export type LeoCandidate = {
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
  language: string | null;
  inQuiero: boolean;
  inGilada: boolean;
  score: number;
};

export type LeoPick = Omit<LeoCandidate, "score" | "language" | "inQuiero" | "inGilada"> & {
  value: string;
  inQuiero: boolean;
  inGilada: boolean;
};

const PURPOSE_Q: Record<string, string> = {
  escaparme: "novela inmersiva",
  sentir: "novela emotiva",
  aprender: "ensayo divulgación",
  obsesion: "novela adictiva",
};

const MOOD_Q: Record<string, string> = {
  liviano: "ligero",
  oscuro: "oscuro",
  tension: "suspenso",
  reir: "humor",
};

const TOPIC_Q: Record<string, string> = {
  historia: "novela",
  policial: "novela policial",
  fantasia: "fantasía",
  romance: "romance",
  real: "no ficción",
};

export function searchQueries(answers: LeoAnswers): string[] {
  const parts = [PURPOSE_Q[answers.purpose], MOOD_Q[answers.mood], TOPIC_Q[answers.topic]].filter(
    Boolean,
  ) as string[];
  if (answers.pace === "vuele") parts.push("corto");
  if (answers.pace === "calma") parts.push("extenso");
  const queries: string[] = [];
  if (parts.length) queries.push(parts.join(" "));
  if (answers.anchor?.title) {
    const seed = [answers.anchor.title, answers.anchor.author].filter(Boolean).join(" ");
    if (seed) queries.push(seed);
  }
  if (!queries.length) queries.push("novela");
  return queries.slice(0, 3);
}

export function isSpanish(language: string | null | undefined): boolean | null {
  if (!language) return null;
  const code = language.trim().toLowerCase();
  if (!code) return null;
  if (
    code === "es" ||
    code === "spa" ||
    code === "es-419" ||
    code.startsWith("es-") ||
    code === "español"
  )
    return true;
  return false;
}

export function candidateId(book: {
  source?: string | null;
  externalId?: string | null;
  external_id?: string | null;
  isbn?: string | null;
  title: string;
  author: string;
}): string | null {
  const external = book.externalId ?? book.external_id;
  if (book.source && external) return `${book.source}:${external}`;
  if (book.isbn) return `isbn:${book.isbn}`;
  return null;
}

function sameBook(
  a: { title: string; author: string; isbn?: string | null },
  b: { title: string; author: string; isbn?: string | null },
) {
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  return identity(a.title) === identity(b.title) && identity(a.author) === identity(b.author);
}

export function valueLine(
  book: { title: string; page_count: number | null; published_year: string | null },
  flags: { inGilada?: boolean; inQuiero?: boolean; anchor?: LeoAnchor | null },
): string {
  const pages = book.page_count ? `${book.page_count} pág.` : "";
  const anchor = flags.anchor?.title
    ? flags.anchor.page_count
      ? `Como ${flags.anchor.title} (${flags.anchor.page_count} pág.).`
      : `Como ${flags.anchor.title}.`
    : "";
  if (pages && flags.inGilada) return `${pages} Lo lee la gilada.`;
  if (pages && anchor) return `${pages} ${anchor}`;
  if (pages) return pages;
  if (anchor) return anchor;
  if (flags.inGilada) return "Lo lee la gilada.";
  if (flags.inQuiero) return "En tu Quiero.";
  if (book.published_year) return book.published_year;
  return pages;
}

const BANNED = /https?:|@|qcl|usuario|recomiendo|perfecto para|te (va a|puede) gustar/i;

export function sanitizeLine(
  raw: string | null | undefined,
  book: { title: string; page_count: number | null; published_year: string | null },
  flags: { inGilada?: boolean; inQuiero?: boolean; anchor?: LeoAnchor | null },
): string {
  const fallback = valueLine(book, flags);
  const line = (raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(\d{2,4})\s*p(?:ágs?|ags?|ages?)?\.?(?=\s|$)/gi, "$1 pág.")
    .slice(0, LINE_MAX);
  if (!line || BANNED.test(line)) return fallback;
  const numbers = line.match(/\d{2,4}/g) ?? [];
  const allowed = new Set(
    [book.page_count, book.published_year, flags.anchor?.page_count]
      .filter((value) => value != null)
      .map(String),
  );
  if (numbers.some((value) => !allowed.has(value))) return fallback;
  return line;
}

function scoreBook(book: LeoCandidate, answers: LeoAnswers): number {
  let score = book.score;
  if (book.inQuiero) score += 40;
  if (book.inGilada) score += 12;
  if (isSpanish(book.language) === true) score += 8;
  if (isSpanish(book.language) === false) score -= 20;
  if (answers.pace === "vuele" && book.page_count && book.page_count <= 250) score += 6;
  if (answers.pace === "calma" && book.page_count && book.page_count >= 350) score += 6;
  if (book.page_count) score += 2;
  return score;
}

export function toCandidate(
  book: CatalogBook | Book | SharedBook,
  flags: { inQuiero?: boolean; inGilada?: boolean } = {},
): LeoCandidate | null {
  const cover = "coverUrl" in book ? book.coverUrl : book.cover_url;
  const externalId = "externalId" in book ? book.externalId : book.external_id;
  const source = book.source === "manual" ? "manual" : book.source;
  const id = candidateId({ ...book, externalId, source });
  if (!cover || !id) return null;
  return {
    id,
    title: book.title,
    author: book.author,
    coverUrl: cover,
    isbn: book.isbn,
    source,
    externalId: externalId ?? book.isbn ?? book.title,
    page_count: book.page_count,
    published_year: book.published_year,
    genre: "genre" in book ? book.genre : null,
    synopsis: book.synopsis,
    subjects: "subjects" in book ? book.subjects : [],
    categories: "categories" in book ? book.categories : [],
    buyLink: "buyLink" in book ? (book.buyLink ?? null) : null,
    language: "language" in book ? (book.language ?? null) : null,
    inQuiero: Boolean(flags.inQuiero),
    inGilada: Boolean(flags.inGilada),
    score: 0,
  };
}

export function buildCandidates(
  answers: LeoAnswers,
  catalog: CatalogBook[],
  library: Book[],
  gilada: SharedBook[],
): LeoCandidate[] {
  const read = library.filter((book) => book.status === "lei");
  const want = library.filter((book) => book.status === "quiero");
  const ignored = (book: { title: string; author: string; isbn?: string | null }) =>
    read.some((item) => sameBook(item, book));

  const byId = new Map<string, LeoCandidate>();
  const add = (book: LeoCandidate) => {
    if (ignored(book)) return;
    const previous = byId.get(book.id);
    if (!previous || book.score > previous.score) {
      byId.set(book.id, {
        ...book,
        inQuiero: book.inQuiero || Boolean(previous?.inQuiero),
        inGilada: book.inGilada || Boolean(previous?.inGilada),
        buyLink: book.buyLink ?? previous?.buyLink ?? null,
      });
    }
  };

  for (const book of want) {
    const candidate = toCandidate(book, { inQuiero: true });
    if (candidate) add({ ...candidate, score: 40 });
  }
  for (const book of gilada) {
    const candidate = toCandidate(book, { inGilada: true });
    if (candidate) add({ ...candidate, score: 12 });
  }
  for (const book of catalog) {
    const candidate = toCandidate(book);
    if (candidate) {
      const wantMatch = want.some((item) => sameBook(item, book));
      const giladaMatch = gilada.some((item) => sameBook(item, book));
      add({ ...candidate, inQuiero: wantMatch, inGilada: giladaMatch, score: 4 });
    }
  }

  const ranked = [...byId.values()]
    .map((book) => ({ ...book, score: scoreBook(book, answers) }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"));
  const preferred = ranked.filter((book) => isSpanish(book.language) !== false);
  return (preferred.length >= LEO_PICKS ? preferred : ranked).slice(0, CANDIDATE_CAP);
}

export function fillPicks(
  orderedIds: string[],
  lines: Map<string, string>,
  candidates: LeoCandidate[],
  answers: LeoAnswers,
): LeoPick[] {
  const byId = new Map(candidates.map((book) => [book.id, book]));
  const picked: LeoCandidate[] = [];
  for (const id of orderedIds) {
    const book = byId.get(id);
    if (book && !picked.some((item) => item.id === book.id)) picked.push(book);
    if (picked.length === LEO_PICKS) break;
  }
  for (const book of candidates) {
    if (picked.length === LEO_PICKS) break;
    if (!picked.some((item) => item.id === book.id)) picked.push(book);
  }
  return picked.map((book) => {
    const { score: _score, language: _language, ...rest } = book;
    return {
      ...rest,
      value: sanitizeLine(lines.get(book.id), book, {
        inGilada: book.inGilada,
        inQuiero: book.inQuiero,
        anchor: answers.anchor,
      }),
    };
  });
}

const LEO_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          line: { type: "string" },
        },
        required: ["id", "line"],
      },
    },
  },
  required: ["picks"],
};

/* Titles and authors go into the model prompt; strip list delimiters
   so a crafted name cannot inject new instructions or extra rows. */
export function promptText(value: string, max = 160): string {
  return value
    .replace(/[\r\n|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function leoPrompt(answers: LeoAnswers, candidates: LeoCandidate[]): string {
  const list = candidates
    .map((book) => {
      const flags = [
        book.inQuiero ? "quiero" : "",
        book.inGilada ? "gilada" : "",
        book.page_count ? `${book.page_count} pág.` : "",
      ]
        .filter(Boolean)
        .join(", ");
      return `${book.id} | ${promptText(book.title)} | ${promptText(book.author)}${flags ? ` | ${flags}` : ""}`;
    })
    .join("\n");
  const anchor = answers.anchor
    ? `${promptText(answers.anchor.title)}${answers.anchor.page_count ? ` (${answers.anchor.page_count} pág.)` : ""}`
    : "ninguno";
  return [
    "Elegí exactamente 6 ids de la lista, en orden, para recomendar qué leer.",
    "La línea (line) es una sola, corta, en español, con un dato real: páginas, el ancla, o «Lo lee la gilada».",
    "No inventes títulos ni números. No uses nombres de personas. No expliques.",
    `Para qué: ${answers.purpose}. Onda: ${answers.mood}. Tema: ${answers.topic}. Ritmo: ${answers.pace}. Ancla: ${anchor}.`,
    "Candidatos:",
    list,
  ].join("\n");
}

function parsePicks(output: unknown): { ids: string[]; lines: Map<string, string> } {
  const response =
    output && typeof output === "object" && "response" in output
      ? (output as { response: unknown }).response
      : output;
  const raw =
    typeof response === "string"
      ? (() => {
          try {
            return JSON.parse(response) as unknown;
          } catch {
            return null;
          }
        })()
      : response;
  const picks =
    raw && typeof raw === "object" && "picks" in raw ? (raw as { picks: unknown }).picks : null;
  const ids: string[] = [];
  const lines = new Map<string, string>();
  if (Array.isArray(picks)) {
    for (const item of picks) {
      if (!item || typeof item !== "object") continue;
      const id =
        typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id.trim() : "";
      const line =
        typeof (item as { line?: unknown }).line === "string"
          ? (item as { line: string }).line
          : "";
      if (!id) continue;
      ids.push(id);
      if (line) lines.set(id, line);
    }
  }
  return { ids, lines };
}

export async function pickWithModel(
  ai: Ai,
  answers: LeoAnswers,
  candidates: LeoCandidate[],
): Promise<LeoPick[]> {
  if (!candidates.length) return [];
  try {
    const output = await ai.run(LEO_MODEL, {
      messages: [
        {
          role: "system",
          content: "Devolvés JSON con picks, cada uno con id y line, usando solo ids de la lista.",
        },
        { role: "user", content: leoPrompt(answers, candidates) },
      ],
      max_tokens: 400,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: LEO_SCHEMA },
    });
    const { ids, lines } = parsePicks(output);
    return fillPicks(ids, lines, candidates, answers);
  } catch {
    return fillPicks([], new Map(), candidates, answers);
  }
}

export async function collectCatalog(
  answers: LeoAnswers,
  googleKey?: string,
): Promise<CatalogBook[]> {
  const queries = searchQueries(answers);
  let failed = 0;
  const groups = await Promise.all(
    queries.map(async (query) => {
      try {
        return await searchCatalogQuick(query, googleKey, "es");
      } catch (error) {
        if (error instanceof CatalogUnavailable) {
          failed += 1;
          return [] as CatalogBook[];
        }
        throw error;
      }
    }),
  );
  if (queries.length > 0 && failed === queries.length) throw new CatalogUnavailable();
  const seen = new Set<string>();
  const merged: CatalogBook[] = [];
  for (const book of groups.flat()) {
    const id = candidateId(book);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(book);
  }
  return merged;
}
