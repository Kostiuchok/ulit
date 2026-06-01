// Mock ISBN service — MVP uses generated ISBN-13.
// Phase 2: integrate real Книжкова палата України API.

// Ukrainian publisher prefixes (978-617-*)
const PUBLISHER_PREFIXES = ["617-7798", "617-7664", "617-664", "617-695", "617-551"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeIsbn13Check(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export async function assignIsbn(_bookId: string): Promise<string> {
  // Pick a random Ukrainian publisher prefix
  const prefix = PUBLISHER_PREFIXES[randomInt(0, PUBLISHER_PREFIXES.length - 1)];
  // Random title number (1-9999, zero-padded to 4 digits)
  const titleNum = String(randomInt(1, 9999)).padStart(4, "0");
  const digits12 = `978${prefix.replace(/-/g, "")}${titleNum}`;
  const check = computeIsbn13Check(digits12);
  const raw = `${digits12}${check}`;
  // Format: 978-617-XXXX-XXXX-X
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 10)}-${raw.slice(10, 14)}-${raw.slice(14)}`;
}

export function validateIsbn13(isbn: string): boolean {
  const digits = isbn.replace(/[-\s]/g, "");
  if (digits.length !== 13 || !/^\d+$/.test(digits)) return false;
  return computeIsbn13Check(digits.slice(0, 12)) === parseInt(digits[12]);
}
