/**
 * Money and percentage helpers for es-UY: thousands separator ".", decimals ",".
 * Money is always bigint cents; percentages are integer basis points (3500 = 35%).
 */

export type CurrencyCode = "UYU" | "USD";

const SYMBOL: Record<CurrencyCode, string> = { USD: "US$", UYU: "$" };

/** "US$ 35.000" · "US$ 35.000,50" · "−US$ 10.000". Cents shown only when not zero. */
export function formatMoney(cents: bigint, currency: CurrencyCode, opts?: { cents?: boolean }) {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = abs % 100n;
  const showCents = opts?.cents ?? fraction !== 0n;
  const decimals = showCents ? `,${fraction.toString().padStart(2, "0")}` : "";
  return `${negative ? "−" : ""}${SYMBOL[currency]} ${whole}${decimals}`;
}

/** "35.000" or "35.000,50" for inputs (es-UY, no currency symbol). */
export function centsToInput(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const fraction = abs % 100n;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const base = `${negative ? "-" : ""}${whole}`;
  return fraction === 0n ? base : `${base},${fraction.toString().padStart(2, "0")}`;
}

/**
 * Parses what a person types: "35.000", "35000", "35.000,5", "1.234.567,89", "-500".
 * Returns null when it is not a valid amount. Never goes through floating point.
 */
export function parseMoney(raw: string): bigint | null {
  const text = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/^(US\$|\$)/, "");
  const match = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const [, sign, integer, decimals = ""] = match;
  const cents = BigInt(integer!.replace(/\./g, "")) * 100n + BigInt(decimals.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** "35%" · "12,5%" */
export function formatPercent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const rest = Math.abs(bp % 100);
  if (rest === 0) return `${whole}%`;
  return `${whole},${rest.toString().padStart(2, "0").replace(/0$/, "")}%`;
}

/** "35" → 3500 · "12,5" → 1250 · "0,25" → 25. Max two decimals, 0–100. */
export function parsePercent(raw: string): number | null {
  const text = raw.trim().replace(/%$/, "").trim();
  const match = /^(\d{1,3})(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const bp = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bp <= 10_000 ? bp : null;
}
