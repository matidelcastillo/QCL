export function normalizeIsbn(value: string): string | null {
  const raw = value.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{9}[\dX]$/.test(raw)) {
    const sum = [...raw].reduce(
      (total, char, index) => total + (char === "X" ? 10 : Number(char)) * (10 - index),
      0,
    );
    if (sum % 11 !== 0) return null;
    return isbn13(`978${raw.slice(0, 9)}`);
  }
  if (/^\d{13}$/.test(raw) && /^(978|979)/.test(raw)) {
    return isbn13(raw.slice(0, 12)) === raw ? raw : null;
  }
  return null;
}

function isbn13(firstTwelve: string): string {
  const sum = [...firstTwelve].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${firstTwelve}${(10 - (sum % 10)) % 10}`;
}
