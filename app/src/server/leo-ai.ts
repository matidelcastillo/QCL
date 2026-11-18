import {
  authorKey,
  authorsMatch,
  displayTitle,
  isEnglish,
  isLatinScript,
  isSpanish,
  sameWork,
  splitAuthorTitle,
  workKey,
  workTitle,
} from "../domain/metadata";
import type { LeoAnchor, LeoAnswers } from "../domain/leo";
import type { Book, CatalogBook, SharedBook } from "../domain/types";
import { CatalogUnavailable, searchCatalogEditions, type CatalogBookWithFallback } from "./catalog";
import { isbnCoverUrls, workCoverUrls } from "./cover-search";
import { coverResolves } from "./cover";
import type { Ai } from "./genre-ai";

export const LEO_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const LEO_PICKS = 6;
export const LEO_BACKUPS = 2;
const RESULT_COUNT = LEO_PICKS + LEO_BACKUPS;
const CANDIDATE_CAP = 24;
const VERIFY_MAX = 16;
const LINE_MAX = 80;

export type LeoCandidate = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  coverFallback?: string;
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

export type LeoPick = Omit<
  LeoCandidate,
  "score" | "language" | "inQuiero" | "inGilada" | "coverFallback"
> & {
  value: string;
  inQuiero: boolean;
  inGilada: boolean;
};

const TOPIC_Q: Record<string, string> = {
  historia: "subject:fiction novela",
  policial: "subject:mystery novela policial",
  fantasia: "subject:fantasy fantasía",
  romance: "subject:romance",
  real: "subject:nonfiction ensayo",
};

const MOOD_Q: Record<string, string> = {
  liviano: "subject:humor ligero",
  oscuro: "subject:horror noir oscuro",
  tension: "subject:thriller suspenso",
  reir: "subject:humor",
};

const PURPOSE_Q: Record<string, string> = {
  escaparme: "novela",
  sentir: "novela literaria",
  aprender: "subject:nonfiction ensayo divulgación",
  obsesion: "novela",
};

const PACE_Q: Record<string, string> = {
  vuele: "short stories relato corto",
  calma: "novela extensa",
};

const QUERY_CAP = 4;

export function searchQueries(answers: LeoAnswers): string[] {
  const queries: string[] = [];
  const add = (value?: string) => {
    const query = value?.trim();
    if (query && !queries.includes(query)) queries.push(query);
  };
  if (answers.topic !== "igual") add(TOPIC_Q[answers.topic]);
  if (answers.mood !== "igual") add(MOOD_Q[answers.mood]);
  if (answers.purpose === "aprender") add(PURPOSE_Q.aprender);
  else if (answers.topic === "igual" && answers.mood === "igual" && answers.purpose !== "igual") {
    add(PURPOSE_Q[answers.purpose]);
  }
  if (answers.pace !== "igual" && answers.pace in PACE_Q) add(PACE_Q[answers.pace]);
  const reserveAnchor = Boolean(answers.anchor?.author || answers.anchor?.title);
  const primary = queries.slice(0, reserveAnchor ? QUERY_CAP - 1 : QUERY_CAP);
  queries.length = 0;
  queries.push(...primary);
  if (answers.anchor?.author) add(answers.anchor.author);
  else if (answers.anchor?.title) add(workTitle(answers.anchor.title, answers.anchor.author));
  if (!queries.length) add("novela");
  return queries;
}

const GENERIC_SUBJECT =
  /^(fiction|novela|general|literature|adult|juvenile|protected daisy|accessible book|in library|overdrive|nyt|open.?library)$/i;

export function anchorSubjectQueries(
  anchor: LeoAnchor | null | undefined,
  books: Array<{
    title: string;
    author: string;
    isbn?: string | null;
    subjects?: string[];
    categories?: string[];
  }>,
): string[] {
  if (!anchor?.title && !anchor?.author) return [];
  const related = books.filter(
    (book) => sameWork(book, anchor) || (anchor.author && authorsMatch(book.author, anchor.author)),
  );
  const subjects: string[] = [];
  for (const book of related) {
    for (const value of [...(book.subjects ?? []), ...(book.categories ?? [])]) {
      const subject = value.trim();
      if (
        subject.length >= 3 &&
        subject.length <= 40 &&
        !GENERIC_SUBJECT.test(subject) &&
        !subjects.some((item) => item.toLowerCase() === subject.toLowerCase())
      ) {
        subjects.push(subject);
      }
      if (subjects.length === 2) break;
    }
    if (subjects.length === 2) break;
  }
  return subjects.map((subject) => `subject:${subject}`);
}

export { isSpanish };

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
  return sameWork(a, b);
}

export function isAnchorMatch(
  book: { title: string; author: string },
  anchor?: LeoAnchor | null,
): boolean {
  if (!anchor?.author || !book.author) return false;
  return authorKey(book.author) === authorKey(anchor.author);
}

/* One concrete signal, strongest first: a real Leí anchor match, then
   Quiero, Gilada, then pages. Never invent a relationship. */
export function valueLine(
  book: {
    title: string;
    page_count: number | null;
    published_year: string | null;
    author?: string;
  },
  flags: {
    inGilada?: boolean;
    inQuiero?: boolean;
    anchor?: LeoAnchor | null;
    anchorMatch?: boolean;
  },
): string {
  const anchor = flags.anchor;
  if (flags.anchorMatch && anchor?.title) {
    const name = workTitle(anchor.title, anchor.author);
    return name ? `Si te gustó ${name}.` : "";
  }
  if (flags.inQuiero) return "En tu Quiero.";
  if (flags.inGilada) return "Lo lee la gilada.";
  if (book.page_count) return `${book.page_count} pág.`;
  if (book.published_year) return book.published_year;
  return "";
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
  const anchorMatch = isAnchorMatch(book, answers.anchor);
  if (anchorMatch) score += 30;
  if (book.inQuiero) score += 20;
  if (book.inGilada) score += 8;
  if (isSpanish(book.language) === true) score += 8;
  else if (isEnglish(book.language) === true) score += 4;
  else if (isSpanish(book.language) === false && !anchorMatch) score -= 8;
  if (answers.pace === "vuele" && book.page_count && book.page_count <= 250) score += 6;
  if (answers.pace === "calma" && book.page_count && book.page_count >= 350) score += 6;
  if (book.page_count) score += 2;
  return score;
}

export function toCandidate(
  book: CatalogBook | CatalogBookWithFallback | Book | SharedBook,
  flags: { inQuiero?: boolean; inGilada?: boolean } = {},
): LeoCandidate | null {
  const cover = "coverUrl" in book ? book.coverUrl : book.cover_url;
  const rawFallback = "coverFallback" in book ? book.coverFallback : undefined;
  const coverFallback = typeof rawFallback === "string" ? rawFallback : undefined;
  const externalId = "externalId" in book ? book.externalId : book.external_id;
  const source = book.source === "manual" ? "manual" : book.source;
  const id = candidateId({ ...book, externalId, source });
  if (!cover || !id) return null;
  return {
    id,
    title: displayTitle(workTitle(book.title, book.author)),
    author: splitAuthorTitle(book.title)?.author || book.author,
    coverUrl: cover,
    coverFallback: coverFallback && coverFallback !== cover ? coverFallback : undefined,
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

const MIN_PAGES = 40;

export function plausiblePageCount(counts: Array<number | null | undefined>): number | null {
  const values = counts.filter(
    (value): value is number => Number.isInteger(value) && (value as number) > 0,
  );
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? null;
  if (median == null) return null;
  const shortWork = median < MIN_PAGES;
  const plausible = values.filter((value) => {
    if (!shortWork && value < MIN_PAGES) return false;
    if (median >= MIN_PAGES && (value < median * 0.4 || value > median * 2.5)) return false;
    return true;
  });
  const pool = plausible.length
    ? plausible
    : shortWork
      ? values
      : values.filter((value) => value >= MIN_PAGES);
  if (!pool.length) return null;
  const frequency = new Map<number, number>();
  for (const value of pool) frequency.set(value, (frequency.get(value) ?? 0) + 1);
  let best = pool[0]!;
  let bestCount = 0;
  for (const [value, count] of frequency) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function editionQuality(
  book: {
    title?: string;
    language?: string | null;
    page_count: number | null;
    coverUrl?: string | null;
  },
  pages: number | null,
): number {
  let score = 0;
  if (book.title && !isLatinScript(book.title)) return -1000;
  if (isSpanish(book.language) === true) score += 8;
  else if (isEnglish(book.language) === true) score += 4;
  else if (isSpanish(book.language) === false) score -= 8;
  if (pages && book.page_count === pages) score += 4;
  else if (book.page_count && book.page_count >= MIN_PAGES) score += 1;
  if (book.coverUrl) score += 1;
  return score;
}

export function selectCatalogWorks(books: CatalogBook[]): CatalogBook[] {
  const groups = new Map<string, CatalogBook[]>();
  for (const book of books) {
    const key = workKey(book);
    const list = groups.get(key) ?? [];
    list.push(book);
    groups.set(key, list);
  }
  const selected: CatalogBook[] = [];
  for (const editions of groups.values()) {
    const pages = plausiblePageCount(editions.map((book) => book.page_count));
    const usable =
      pages == null
        ? editions
        : editions.filter(
            (book) =>
              book.page_count == null ||
              book.page_count === pages ||
              Math.abs((book.page_count ?? 0) - pages) <= Math.max(20, pages * 0.15),
          );
    const pool = usable.length ? usable : editions;
    const pick = [...pool].sort((a, b) => editionQuality(b, pages) - editionQuality(a, pages))[0];
    if (!pick) continue;
    if (
      pages &&
      (pick.page_count == null || Math.abs(pick.page_count - pages) > Math.max(20, pages * 0.15))
    ) {
      selected.push({ ...pick, title: workTitle(pick.title, pick.author), page_count: pages });
    } else {
      selected.push({
        ...pick,
        title: workTitle(pick.title, pick.author),
        page_count: pick.page_count ?? pages,
      });
    }
  }
  return selected.filter((book) => isLatinScript(book.title));
}

function selectWorkCandidates(books: LeoCandidate[]): LeoCandidate[] {
  const groups = new Map<string, LeoCandidate[]>();
  for (const book of books) {
    const key = workKey(book);
    const list = groups.get(key) ?? [];
    list.push(book);
    groups.set(key, list);
  }
  const selected: LeoCandidate[] = [];
  for (const editions of groups.values()) {
    const pages = plausiblePageCount(editions.map((book) => book.page_count));
    const pick = [...editions].sort(
      (a, b) => editionQuality(b, pages) - editionQuality(a, pages) || b.score - a.score,
    )[0];
    if (!pick) continue;
    selected.push({
      ...pick,
      title: workTitle(pick.title, pick.author),
      page_count:
        pick.page_count && pages && Math.abs(pick.page_count - pages) <= Math.max(20, pages * 0.15)
          ? pick.page_count
          : (pages ?? pick.page_count),
      inQuiero: editions.some((book) => book.inQuiero),
      inGilada: editions.some((book) => book.inGilada),
      score: Math.max(...editions.map((book) => book.score)),
    });
  }
  return selected.filter((book) => isLatinScript(book.title));
}

export function buildCandidates(
  answers: LeoAnswers,
  catalog: Array<CatalogBook | CatalogBookWithFallback>,
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

  /* Catalog from the answers is the base. Quiero and Gilada only boost
     a book already in that pool; they do not fill the cap by title. */
  catalog.forEach((book, index) => {
    const candidate = toCandidate(book, {
      inQuiero: want.some((item) => sameBook(item, book)),
      inGilada: gilada.some((item) => sameBook(item, book)),
    });
    if (candidate) add({ ...candidate, score: Math.max(1, 20 - Math.min(index, 19)) });
  });

  const ranked = selectWorkCandidates(
    [...byId.values()].map((book) => ({ ...book, score: scoreBook(book, answers) })),
  ).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const preferred = ranked.filter(
    (book) => isSpanish(book.language) !== false || isAnchorMatch(book, answers.anchor),
  );
  return (preferred.length >= LEO_PICKS ? preferred : ranked).slice(0, CANDIDATE_CAP);
}

export const GILADA_NOTE = "De lo que lee la gilada.";
const SHARED_SIGNAL = 3;

export function presentLeo(
  picks: LeoPick[],
  answers: LeoAnswers,
): { results: LeoPick[]; backups: LeoPick[]; note: string | null } {
  const prepared = picks.map((book) => ({ ...book, title: displayTitle(book.title) }));
  const shown = prepared.slice(0, LEO_PICKS);
  const hideGilada = shown.filter((book) => book.inGilada).length >= SHARED_SIGNAL;
  const hideQuiero = shown.filter((book) => book.inQuiero).length >= SHARED_SIGNAL;
  const hideAnchor =
    shown.filter((book) => isAnchorMatch(book, answers.anchor)).length >= SHARED_SIGNAL;
  const withValue = (book: LeoPick): LeoPick => ({
    ...book,
    value: valueLine(book, {
      inGilada: book.inGilada && !hideGilada,
      inQuiero: book.inQuiero && !hideQuiero,
      anchor: answers.anchor,
      anchorMatch: isAnchorMatch(book, answers.anchor) && !hideAnchor,
    }),
  });
  return {
    note: hideGilada ? GILADA_NOTE : null,
    results: shown.map(withValue),
    backups: prepared.slice(LEO_PICKS).map(withValue),
  };
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
    if (picked.length === RESULT_COUNT) break;
  }
  for (const book of candidates) {
    if (picked.length === RESULT_COUNT) break;
    if (!picked.some((item) => item.id === book.id)) picked.push(book);
  }
  return picked.map((book) => {
    const { score: _score, language: _language, coverFallback: _fallback, ...rest } = book;
    return {
      ...rest,
      value: valueLine(book, {
        inGilada: book.inGilada,
        inQuiero: book.inQuiero,
        anchor: answers.anchor,
        anchorMatch: isAnchorMatch(book, answers.anchor),
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
    ? `${promptText(workTitle(answers.anchor.title, answers.anchor.author))}${answers.anchor.page_count ? ` (${answers.anchor.page_count} pág.)` : ""}`
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

/* Confirm each cover resolves (real image, not a 404 or placeholder)
   before the model sees the candidate. Try the stored URL, then the
   other provider, then ISBN sources. Work-level covers only if we still
   need more than RESULT_COUNT verified books. Caps at VERIFY_MAX so the
   worker stays inside the subrequest budget. */
export async function verifyCandidateCovers(
  candidates: LeoCandidate[],
  resolves: (url: string) => Promise<boolean> = coverResolves,
  workUrls: (title: string, author: string) => Promise<string[]> = workCoverUrls,
): Promise<LeoCandidate[]> {
  async function firstValid(urls: string[]): Promise<string | null> {
    const seen = new Set<string>();
    for (const url of urls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      if (await resolves(url)) return url;
    }
    return null;
  }

  function editionUrls(book: LeoCandidate): string[] {
    return [
      book.coverUrl,
      book.coverFallback,
      ...(book.isbn ? isbnCoverUrls(book.isbn) : []),
    ].filter((url): url is string => Boolean(url));
  }

  function withCover(book: LeoCandidate, coverUrl: string): LeoCandidate {
    const { coverFallback: _fallback, ...rest } = book;
    return { ...rest, coverUrl };
  }

  const verified: LeoCandidate[] = [];
  const missed: LeoCandidate[] = [];
  const queue = [...candidates];
  while (queue.length && verified.length < VERIFY_MAX) {
    const batch = queue.splice(0, 8);
    const settled = await Promise.all(
      batch.map(async (book) => {
        const coverUrl = await firstValid(editionUrls(book));
        return coverUrl ? withCover(book, coverUrl) : null;
      }),
    );
    for (let i = 0; i < settled.length; i++) {
      const hit = settled[i];
      if (hit) verified.push(hit);
      else missed.push(batch[i]!);
    }
  }

  if (verified.length < RESULT_COUNT && missed.length) {
    const retry = missed.slice(0, RESULT_COUNT - verified.length + 4);
    const settled = await Promise.all(
      retry.map(async (book) => {
        const coverUrl = await firstValid(await workUrls(book.title, book.author));
        return coverUrl ? withCover(book, coverUrl) : null;
      }),
    );
    for (const hit of settled) {
      if (hit && verified.length < VERIFY_MAX) verified.push(hit);
    }
  }

  const order = new Map(candidates.map((book, index) => [book.id, index]));
  return verified.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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

const ENRICH_MAX = 5;

export async function refineWithSpanishEditions(
  candidates: LeoCandidate[],
  googleKey?: string,
): Promise<LeoCandidate[]> {
  const missing = candidates
    .filter((book) => isSpanish(book.language) !== true)
    .slice(0, ENRICH_MAX);
  if (!missing.length) return candidates;
  const updates = await Promise.all(
    missing.map(async (book) => {
      try {
        const found = await searchCatalogEditions(
          [workTitle(book.title, book.author), book.author].filter(Boolean).join(" "),
          googleKey,
          "es",
        );
        const spanish = found.filter((item) => isSpanish(item.language) === true);
        const match =
          spanish.find((item) => sameWork(item, book)) ??
          spanish.find((item) => authorsMatch(item.author, book.author));
        if (!match) return null;
        return { from: book.id, edition: match };
      } catch {
        return null;
      }
    }),
  );
  const byId = new Map(
    updates.flatMap((item) => (item ? [[item.from, item.edition] as const] : [])),
  );
  const merged = candidates.map((book) => {
    const edition = byId.get(book.id);
    if (!edition) return book;
    const candidate = toCandidate(edition, { inQuiero: book.inQuiero, inGilada: book.inGilada });
    return candidate ? { ...candidate, score: book.score } : book;
  });
  return selectWorkCandidates(merged);
}

async function searchQueryGroup(
  query: string,
  googleKey?: string,
): Promise<{ ok: boolean; books: CatalogBookWithFallback[] }> {
  try {
    return { ok: true, books: await searchCatalogEditions(query, googleKey, "es") };
  } catch (error) {
    if (error instanceof CatalogUnavailable) return { ok: false, books: [] };
    throw error;
  }
}

export async function collectCatalog(
  answers: LeoAnswers,
  googleKey?: string,
): Promise<CatalogBookWithFallback[]> {
  const queries = searchQueries(answers);
  const groups = await Promise.all(queries.map((query) => searchQueryGroup(query, googleKey)));
  if (queries.length > 0 && groups.every((group) => !group.ok)) throw new CatalogUnavailable();
  const seen = new Set<string>();
  const merged: CatalogBookWithFallback[] = [];
  const addAll = (books: CatalogBookWithFallback[]) => {
    for (const book of books) {
      const id = candidateId(book);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(book);
    }
  };
  addAll(groups.flatMap((group) => group.books));
  const extra = anchorSubjectQueries(answers.anchor, merged).filter(
    (query) => !queries.includes(query),
  )[0];
  if (extra) {
    const follow = await searchQueryGroup(extra, googleKey);
    addAll(follow.books);
  }
  return selectCatalogWorks(merged);
}
