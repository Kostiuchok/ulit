// Mock ISBN service — MVP uses generated ISBN-13.
// Phase 2: integrate real Книжкова палата України API.

// Ukrainian publisher codes under 978-617 group (each 6 chars without dashes → 3-digit title space)
const PUBLISHER_CODES = ["617551", "617664", "617695", "617702", "617746"];

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
  const pub = PUBLISHER_CODES[randomInt(0, PUBLISHER_CODES.length - 1)];
  // 978 (3) + publisher (6) + title (3) = 12 digits, then +check = 13
  const titleNum = String(randomInt(1, 999)).padStart(3, "0");
  const digits12 = `978${pub}${titleNum}`;
  const check = computeIsbn13Check(digits12);
  const raw = `${digits12}${check}`;
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}-${raw.slice(12)}`;
}

export function validateIsbn13(isbn: string): boolean {
  const digits = isbn.replace(/[-\s]/g, "");
  if (digits.length !== 13 || !/^\d+$/.test(digits)) return false;
  return computeIsbn13Check(digits.slice(0, 12)) === parseInt(digits[12]);
}

