export function isbnDigits(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, "");
}

function isbn13CheckDigit(body12: string): string {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(body12[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

function isValidIsbn13(value: string): boolean {
  if (!/^[0-9]{13}$/.test(value)) return false;
  return isbn13CheckDigit(value.slice(0, 12)) === value[12];
}

function isValidIsbn10(value: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    sum += Number(value[index]) * (10 - index);
  }
  const check = value[9] === "X" ? 10 : Number(value[9]);
  sum += check;
  return sum % 11 === 0;
}

export function isbn10To13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  return `${body}${isbn13CheckDigit(body)}`;
}

/** Prefer ISBN-13. Returns null if the value is not a valid ISBN. */
export function normalizeIsbn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = isbnDigits(raw);
  if (digits.length === 13 && isValidIsbn13(digits)) return digits;
  if (digits.length === 10 && isValidIsbn10(digits)) return isbn10To13(digits);
  return null;
}

export function queryLooksLikeIsbn(raw: string): boolean {
  const digits = isbnDigits(raw.trim());
  return digits.length === 10 || digits.length === 13;
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/** Accept book barcodes (ISBN-10 or EAN-13 starting 978/979). Ignores a 2- or 5-digit add-on. */
export function isbnFromBarcode(raw: string): string | null {
  if (!raw) return null;
  const digits = isbnDigits(raw);
  const candidates = uniqueValues([
    digits.length > 13 ? digits.slice(0, 13) : "",
    digits.length > 10 && digits.length !== 13 ? digits.slice(0, 10) : "",
    digits,
    raw,
  ]);
  for (const candidate of candidates) {
    const normalized = normalizeIsbn(candidate);
    if (normalized && (normalized.startsWith("978") || normalized.startsWith("979"))) {
      return normalized;
    }
  }
  return null;
}
