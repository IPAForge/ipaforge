// Text forms CoreFoundation's XML writer uses for strings, reals and dates.

/** Significant digits of `%.17g`. */
const G17_DIGITS = 17;
/** `%g` switches to exponent form below this exponent (and at or above the precision). */
const G_MIN_FIXED_EXPONENT = -4;
const EXPONENT_MIN_DIGITS = 2;

export const escapeText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const stripZeros = (digits: string): string => (digits.includes(".") ? digits.replace(/\.?0+$/, "") : digits);

/**
 * C `printf("%.17g")`, which CoreFoundation uses for `<real>`: 17 significant digits, trailing
 * zeros removed, exponent form only when the exponent is < -4 or >= 17 (e.g. 0.1 → 0.10000000000000001,
 * 1000 → 1000, 1e-5 → 1.0000000000000001e-05).
 */
const formatG17 = (value: number): string => {
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";
  const [mantissa = "", exponentText = "0"] = value.toExponential(G17_DIGITS - 1).split("e");
  const exponent = Number(exponentText);
  if (exponent < G_MIN_FIXED_EXPONENT || exponent >= G17_DIGITS) {
    const sign = exponent < 0 ? "-" : "+";
    return `${stripZeros(mantissa)}e${sign}${String(Math.abs(exponent)).padStart(EXPONENT_MIN_DIGITS, "0")}`;
  }
  return stripZeros(value.toFixed(G17_DIGITS - 1 - exponent));
};

export const formatReal = (value: number): string => {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "+infinity";
  if (value === -Infinity) return "-infinity";
  return formatG17(value);
};

/** ISO 8601 without milliseconds, e.g. `2026-10-15T00:00:00Z`. */
export const formatDate = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, "Z");
