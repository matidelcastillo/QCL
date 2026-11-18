export const LEO_SKIP = "igual" as const;

export const LEO_PURPOSE = [
  ["escaparme", "Escaparme."],
  ["sentir", "Sentir algo."],
  ["aprender", "Aprender."],
  ["obsesion", "Una obsesión."],
  ["igual", "Da igual."],
] as const;

export const LEO_MOOD = [
  ["liviano", "Liviano."],
  ["oscuro", "Oscuro."],
  ["tension", "De tensión."],
  ["reir", "Para reír."],
  ["igual", "Da igual."],
] as const;

export const LEO_TOPIC = [
  ["historia", "Una historia."],
  ["policial", "Policial."],
  ["fantasia", "Fantasía."],
  ["romance", "Romance."],
  ["real", "Algo real."],
  ["igual", "Da igual."],
] as const;

export const LEO_PACE = [
  ["vuele", "Que vuele."],
  ["normal", "Normal."],
  ["calma", "Con calma."],
  ["igual", "Da igual."],
] as const;

export const LEO_STEPS = [
  { key: "purpose", title: "¿Para qué?", options: LEO_PURPOSE },
  { key: "mood", title: "¿Qué te pinta?", options: LEO_MOOD },
  { key: "topic", title: "¿De qué?", options: LEO_TOPIC },
  { key: "pace", title: "¿Rápido o lento?", options: LEO_PACE },
  { key: "anchor", title: "¿Como alguno?" },
] as const;

export type LeoPurpose = (typeof LEO_PURPOSE)[number][0];
export type LeoMood = (typeof LEO_MOOD)[number][0];
export type LeoTopic = (typeof LEO_TOPIC)[number][0];
export type LeoPace = (typeof LEO_PACE)[number][0];

export type LeoAnchor = {
  title: string;
  author: string;
  isbn?: string | null;
  page_count?: number | null;
  source?: string | null;
  externalId?: string | null;
};

export type LeoAnswers = {
  purpose: LeoPurpose;
  mood: LeoMood;
  topic: LeoTopic;
  pace: LeoPace;
  anchor: LeoAnchor | null;
};

const keys = (options: readonly (readonly [string, string])[]) =>
  new Set(options.map(([key]) => key));

const PURPOSE = keys(LEO_PURPOSE);
const MOOD = keys(LEO_MOOD);
const TOPIC = keys(LEO_TOPIC);
const PACE = keys(LEO_PACE);

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

/* Client and worker share this so a bad body never reaches the providers. */
export function parseLeoAnswers(body: unknown): LeoAnswers | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const purpose = text(record.purpose, 20);
  const mood = text(record.mood, 20);
  const topic = text(record.topic, 20);
  const pace = text(record.pace, 20);
  if (!PURPOSE.has(purpose) || !MOOD.has(mood) || !TOPIC.has(topic) || !PACE.has(pace)) return null;
  let anchor: LeoAnchor | null = null;
  if (record.anchor && typeof record.anchor === "object") {
    const raw = record.anchor as Record<string, unknown>;
    const title = text(raw.title);
    if (!title) return null;
    const pages = raw.page_count;
    anchor = {
      title,
      author: text(raw.author),
      isbn: text(raw.isbn, 32) || null,
      page_count: typeof pages === "number" && Number.isInteger(pages) && pages > 0 ? pages : null,
      source: text(raw.source, 20) || null,
      externalId: text(raw.externalId ?? raw.external_id, 80) || null,
    };
  } else if (record.anchor != null) {
    return null;
  }
  return {
    purpose: purpose as LeoPurpose,
    mood: mood as LeoMood,
    topic: topic as LeoTopic,
    pace: pace as LeoPace,
    anchor,
  };
}

export const LEO_RECENT = 3;

export function recentRead<T extends { status: string; read_at: string | null; created_at?: string }>(
  books: T[],
  limit = LEO_RECENT,
): T[] {
  return books
    .filter((book) => book.status === "lei")
    .sort((a, b) => (b.read_at ?? b.created_at ?? "").localeCompare(a.read_at ?? a.created_at ?? ""))
    .slice(0, limit);
}
