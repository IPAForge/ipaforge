import { toBase64, utf8Encode } from "@loadstar/kernel";
import { isPlistDict, PlistReal, type PlistValue } from "@signer/domain/plist/model.ts";

const HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
  '<plist version="1.0">\n';

const escapeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const stripZeros = (digits: string): string => (digits.includes(".") ? digits.replace(/\.?0+$/, "") : digits);

/** Significant digits of `%.17g`. */
const G17_DIGITS = 17;

/**
 * C `printf("%.17g")`, which CoreFoundation uses for `<real>`: 17 significant digits, trailing
 * zeros removed, exponent form only when the exponent is < -4 or >= 17 (e.g. 0.1 → 0.10000000000000001,
 * 1000 → 1000, 1e-5 → 1.0000000000000001e-05).
 */
const formatG17 = (value: number): string => {
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";
  const [mantissa = "", exponentText = "0"] = value.toExponential(G17_DIGITS - 1).split("e");
  const exponent = Number(exponentText);
  if (exponent < -4 || exponent >= G17_DIGITS) {
    const sign = exponent < 0 ? "-" : "+";
    return `${stripZeros(mantissa)}e${sign}${String(Math.abs(exponent)).padStart(2, "0")}`;
  }
  return stripZeros(value.toFixed(G17_DIGITS - 1 - exponent));
};

const formatReal = (value: number): string => {
  if (Number.isNaN(value)) return "nan";
  if (value === Infinity) return "+infinity";
  if (value === -Infinity) return "-infinity";
  return formatG17(value);
};

const formatDate = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/** CoreFoundation wraps `<data>` base64 at 76 columns, minus one tab (8 columns) per nesting level. */
const CF_DATA_LINE_WIDTH = 76;
const CF_TAB_WIDTH = 8;
const CF_MIN_DATA_LINE_WIDTH = 4;

/** Base64 line width CoreFoundation uses for `<data>` at a given depth. */
const dataLineWidth = (depth: number): number =>
  Math.max(CF_DATA_LINE_WIDTH - CF_TAB_WIDTH * depth, CF_MIN_DATA_LINE_WIDTH);

const writeValue = (value: PlistValue, depth: number, out: string[]): void => {
  const tabs = "\t".repeat(depth);
  if (typeof value === "string") out.push(`${tabs}<string>${escapeText(value)}</string>`);
  else if (typeof value === "boolean") out.push(`${tabs}<${value}/>`);
  else if (typeof value === "number" || typeof value === "bigint") out.push(`${tabs}<integer>${value}</integer>`);
  else if (value instanceof PlistReal) out.push(`${tabs}<real>${formatReal(value.value)}</real>`);
  else if (value instanceof Date) out.push(`${tabs}<date>${formatDate(value)}</date>`);
  else if (value instanceof Uint8Array) {
    out.push(`${tabs}<data>`);
    const encoded = toBase64(value);
    const width = dataLineWidth(depth);
    for (let i = 0; i < encoded.length; i += width) out.push(tabs + encoded.slice(i, i + width));
    out.push(`${tabs}</data>`);
  } else if (Array.isArray(value)) {
    if (value.length === 0) return void out.push(`${tabs}<array/>`);
    out.push(`${tabs}<array>`);
    for (const item of value) writeValue(item, depth + 1, out);
    out.push(`${tabs}</array>`);
  } else if (isPlistDict(value)) {
    // CFStringCompare(…, 0) = UTF-16 code-unit order, which is JavaScript's default string sort.
    const keys = Object.keys(value).sort();
    if (keys.length === 0) return void out.push(`${tabs}<dict/>`);
    out.push(`${tabs}<dict>`);
    for (const key of keys) {
      out.push(`${tabs}\t<key>${escapeText(key)}</key>`);
      writeValue(value[key] as PlistValue, depth + 1, out);
    }
    out.push(`${tabs}</dict>`);
  }
};

/** Serializes exactly like CoreFoundation's XML writer (`plutil -convert xml1`, codesign). */
export const serializeXmlPlist = (value: PlistValue): Uint8Array => {
  const lines: string[] = [];
  writeValue(value, 0, lines);
  return utf8Encode(`${HEADER}${lines.join("\n")}\n</plist>\n`);
};
