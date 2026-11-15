import { fold } from "./metadata";

/* Genre = one of a small fixed Spanish set, derived deterministically from
   catalog subject labels (Open Library subjects, Google BISAC categories).
   Measured on the real library (32 books): Open Library subjects 19/22
   correct, Google categories 10/15, so Open Library wins when both exist.

   Each label votes for the first rule it matches (rules are ordered from
   specific to generic, so "Fiction / Horror" votes Terror); the genre with
   most votes wins, ties go to the earlier rule. Topical "X, fiction"
   subjects ("Gods, fiction") say what a book is about, not what it is, so
   they do not vote Novela. */
const RULES: Array<[string, RegExp]> = [
  ["Historieta", /\b(comic|comics|graphic novel|manga|historieta)/],
  ["Terror", /\b(horror|terror|weird fiction|gothic)/],
  ["Ciencia ficción", /\b(science fiction|ciencia ficcion)/],
  ["Fantasía", /\b(fantasy|fantasia)/],
  ["Policial", /\b(detective|mystery|crime fiction|policial|novela negra)/],
  ["Poesía", /\b(poetry|poems|poesia)/],
  ["Teatro", /\b(drama|plays|teatro|tragedy|tragedia)\b/],
  ["Cuentos", /\b(short stor|cuentos|relatos)/],
  ["Infantil", /\b(children|juvenile|infantil)/],
  [
    "Novela",
    /^(?!.*, (fiction|ficcion)\b)(?!.*non-?fiction)(.*\b(fiction|novel|novels|novela|novelas|ficcion|antinovel)\b)/,
  ],
  ["Filosofía", /\b(philosoph|filosof)/],
  ["Política", /\b(political|politics|politica|communism|socialism|marxism)/],
  ["Historia", /\b(history|historia)\b/],
  [
    "Ciencia",
    /\b(cosmolog|physics|astronom|popular science|vulgarisation scientifique|mathemat|biology|ciencia)/,
  ],
  ["Negocios", /\b(business|marketing|leadership|management|economics|negocios|entrepreneur)/],
  ["Arte y diseño", /\b(architect|design|arquitectura|diseno)/],
  ["Biografía", /\b(biograph|autobiograph|memoir)/],
];

export const GENRES = RULES.map(([name]) => name);
export const OTHER_GENRE = "Otros";

function vote(label: string): number {
  const parts = fold(label).split(/ -- | \/ /);
  let best = -1;
  for (const part of parts) {
    const index = RULES.findIndex(([, rule]) => rule.test(part));
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

export function genreFromSubjects(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  const votes = new Map<number, number>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const index = vote(value);
    if (index >= 0) votes.set(index, (votes.get(index) ?? 0) + 1);
  }
  let winner: number | null = null;
  for (const [index, count] of votes) {
    const top = winner === null ? 0 : (votes.get(winner) ?? 0);
    if (winner === null || count > top || (count === top && index < winner)) winner = index;
  }
  return winner === null ? null : RULES[winner][0];
}

/* Stored genre if it belongs to the set; legacy catalog labels do not. */
export function knownGenre(genre: string | null): string | null {
  return genre && GENRES.includes(genre) ? genre : null;
}

/* Stored genre → its home group; anything outside the set is "Otros". */
export function genreGroup(genre: string | null): string {
  return knownGenre(genre) ?? OTHER_GENRE;
}

/* QC groups (barrios) sort alphabetically; the catch-all goes last. */
export function groupByGenre<T extends { genre: string | null }>(items: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = genreGroup(item.genre);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === OTHER_GENRE ? 1 : b === OTHER_GENRE ? -1 : a.localeCompare(b, "es"),
  );
}
