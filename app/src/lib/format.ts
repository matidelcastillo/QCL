const dateFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Buenos_Aires",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.length <= 10 ? `${value}T12:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return dateFmt.format(date);
}

export function todayIsoDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function statusLabel(status: "quiero" | "lei"): string {
  return status === "lei" ? "Leí" : "Quiero";
}

/** Short date for cards, e.g. "nov 2026". */
export function formatMonthYear(value: string | null | undefined): string {
  if (!value) return "";
  const iso = value.length <= 10 ? `${value}T12:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Buenos_Aires",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const month = (parts.find((part) => part.type === "month")?.value ?? "")
    .replace(".", "")
    .toLowerCase();
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${month} ${year}`.trim();
}
