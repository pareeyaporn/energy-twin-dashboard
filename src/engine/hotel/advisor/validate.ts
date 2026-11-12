/**
 * The guardrail against invented numbers. Every number in an AI answer must match a number in the context the engine produced,
 * allowing for rounding ("about $12,200" for 12,159). Anything else makes the answer unusable and the app shows the template answer.
 */

export interface NumberToken {
  raw: string;
  value: number;
  dollar: boolean;
  unit: string;
}

const TOKEN =
  /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|percent|k\b|m\b|million|thousand|years?|yrs?|kwh|kw|therms?|tonnes?|tons?|hours?|hrs?|°\s?f|rooms?)?/gi;

/** Digits that are not quantities: gas names, list markers. */
function clean(text: string): string {
  return text.replace(/CO2e?/gi, 'CO-e').replace(/\bH2O\b/gi, 'water');
}

export function extractNumbers(text: string): NumberToken[] {
  const out: NumberToken[] = [];
  for (const m of clean(text).matchAll(TOKEN)) {
    const whole = (m[2] ?? '').replace(/,/g, '');
    const frac = m[3] ?? '';
    let value = Number(whole + frac);
    const unit = (m[4] ?? '').toLowerCase().replace(/\s/g, '');
    if (unit === 'k' || unit === 'thousand') value *= 1000;
    if (unit === 'm' || unit === 'million') value *= 1_000_000;
    if (!Number.isFinite(value)) continue;
    out.push({ raw: m[0].trim(), value, dollar: m[1] === '$', unit });
  }
  return out;
}

/** Every finite number found anywhere in a JSON-like value. */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectNumbers(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) collectNumbers(v, out);
  return out;
}

const roundTo = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
};
const sigFigs = (n: number, figs: number) => {
  if (n === 0) return 0;
  const mag = Math.floor(Math.log10(Math.abs(n)));
  const f = 10 ** (figs - 1 - mag);
  return Math.round(n * f) / f;
};

function decimalsOf(raw: string): number {
  const m = raw.replace(/,/g, '').match(/\.(\d+)/);
  return m ? (m[1] ?? '').length : 0;
}

/** True if `value` is `c` stated exactly or rounded in a natural way (decimals as written, or two or three significant figures). */
function matches(token: NumberToken, c: number): boolean {
  const v = token.value;
  const abs = Math.abs(c);
  const absV = Math.abs(v);
  if (Math.abs(absV - abs) < 1e-9) return true;
  const d = token.unit === 'k' || token.unit === 'm' || token.unit === 'thousand' || token.unit === 'million' ? 0 : decimalsOf(token.raw);
  if (d > 0 && roundTo(abs, d) === absV) return true;
  if (d === 0 && roundTo(abs, 0) === absV) return true;
  return sigFigs(abs, 2) === absV || sigFigs(abs, 3) === absV;
}

export interface Validation {
  ok: boolean;
  /** The numbers in the answer that are not in the context. */
  unmatched: string[];
}

/**
 * Check an answer against the context. Bare whole numbers up to 12 with no unit and no dollar sign are allowed (counts such as
 * "three packages" written as digits, months, "2 options"); everything else must match a number the engine produced.
 * Negative and positive versions match (a saving can be written without its sign).
 */
export function validateAdvisorText(text: string, context: unknown): Validation {
  const allowed = collectNumbers(context);
  const unmatched: string[] = [];
  for (const t of extractNumbers(text)) {
    const bare = !t.dollar && t.unit === '' && Number.isInteger(t.value) && t.value >= 0 && t.value <= 12 && !/\./.test(t.raw);
    if (bare) continue;
    if (!allowed.some((c) => matches(t, c))) unmatched.push(t.raw);
  }
  return { ok: unmatched.length === 0, unmatched };
}
