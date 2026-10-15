import { toBase64 } from "@kernel/bytes/base64.ts";
import { utf8Encode } from "@kernel/bytes/bytes.ts";
import { isPlistDict, type PlistDict, PlistReal, type PlistValue } from "@kernel/plist/model.ts";
import { escapeText, formatDate, formatReal } from "@kernel/plist/xml-format.ts";

const HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
  '<plist version="1.0">\n';
const FOOTER = "\n</plist>\n";

/** CoreFoundation wraps `<data>` base64 at 76 columns, minus one tab (8 columns) per nesting level. */
const CF_DATA_LINE_WIDTH = 76;
const CF_TAB_WIDTH = 8;
const CF_MIN_DATA_LINE_WIDTH = 4;

/** Base64 line width CoreFoundation uses for `<data>` at a given depth. */
const dataLineWidth = (depth: number): number =>
  Math.max(CF_DATA_LINE_WIDTH - CF_TAB_WIDTH * depth, CF_MIN_DATA_LINE_WIDTH);

/** The one-line element for a scalar, or undefined for data and containers. */
const scalarElement = (value: PlistValue): string | undefined => {
  if (typeof value === "string") return `<string>${escapeText(value)}</string>`;
  if (typeof value === "boolean") return `<${value}/>`;
  if (typeof value === "number" || typeof value === "bigint") return `<integer>${value}</integer>`;
  if (value instanceof PlistReal) return `<real>${formatReal(value.value)}</real>`;
  if (value instanceof Date) return `<date>${formatDate(value)}</date>`;
  return undefined;
};

const writeData = (value: Uint8Array, depth: number, tabs: string, out: string[]): void => {
  out.push(`${tabs}<data>`);
  const encoded = toBase64(value);
  const width = dataLineWidth(depth);
  for (let i = 0; i < encoded.length; i += width) out.push(tabs + encoded.slice(i, i + width));
  out.push(`${tabs}</data>`);
};

const writeArray = (value: readonly PlistValue[], depth: number, tabs: string, out: string[]): void => {
  if (value.length === 0) {
    out.push(`${tabs}<array/>`);
    return;
  }
  out.push(`${tabs}<array>`);
  for (const item of value) writeValue(item, depth + 1, out);
  out.push(`${tabs}</array>`);
};

const writeDict = (value: PlistDict, depth: number, tabs: string, out: string[]): void => {
  // CFStringCompare(…, 0) = UTF-16 code-unit order, which is JavaScript's default string sort.
  const keys = Object.keys(value).sort();
  if (keys.length === 0) {
    out.push(`${tabs}<dict/>`);
    return;
  }
  out.push(`${tabs}<dict>`);
  for (const key of keys) {
    out.push(`${tabs}\t<key>${escapeText(key)}</key>`);
    writeValue(value[key] as PlistValue, depth + 1, out);
  }
  out.push(`${tabs}</dict>`);
};

const writeValue = (value: PlistValue, depth: number, out: string[]): void => {
  const tabs = "\t".repeat(depth);
  const scalar = scalarElement(value);
  if (scalar !== undefined) out.push(tabs + scalar);
  else if (value instanceof Uint8Array) writeData(value, depth, tabs, out);
  else if (Array.isArray(value)) writeArray(value, depth, tabs, out);
  else if (isPlistDict(value)) writeDict(value, depth, tabs, out);
};

/** Serializes exactly like CoreFoundation's XML writer (`plutil -convert xml1`, codesign). */
export const serializeXmlPlist = (value: PlistValue): Uint8Array => {
  const lines: string[] = [];
  writeValue(value, 0, lines);
  return utf8Encode(`${HEADER}${lines.join("\n")}${FOOTER}`);
};
