import { fromBase64 } from "@kernel/bytes/base64.ts";
import { utf8Decode } from "@kernel/bytes/bytes.ts";
import { ErrorCode } from "@kernel/errors/codes.ts";
import { LoadstarError } from "@kernel/errors/loadstar-error.ts";
import { DEFAULT_PLIST_LIMITS, type PlistLimits } from "@kernel/plist/limits.ts";
import { createDict, type PlistValue, real } from "@kernel/plist/model.ts";

const fail = (message: string, position: number): never => {
  throw new LoadstarError(ErrorCode.InvalidPlist, { message: `XML plist: ${message}`, data: { position } });
};

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodeEntities = (text: string, position: number): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (_match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (!Number.isFinite(code) || code > 0x10ffff) return fail(`bad character reference &${entity};`, position);
      return String.fromCodePoint(code);
    }
    const decoded = ENTITIES[entity];
    return decoded ?? fail(`unknown entity &${entity};`, position);
  });

interface Tag {
  readonly name: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
  readonly start: number;
  readonly end: number;
}

/** Minimal, strict XML reader for the plist DTD (no attributes are interpreted). */
const createReader = (xml: string) => {
  let pos = 0;

  const skipMisc = (): void => {
    for (;;) {
      while (pos < xml.length && /\s/.test(xml[pos] as string)) pos++;
      if (xml.startsWith("<?", pos)) pos = indexAfter("?>");
      else if (xml.startsWith("<!--", pos)) pos = indexAfter("-->");
      else if (xml.startsWith("<!DOCTYPE", pos)) pos = indexAfter(">");
      else return;
    }
  };

  const indexAfter = (token: string): number => {
    const index = xml.indexOf(token, pos);
    return index < 0 ? fail(`unterminated ${token}`, pos) : index + token.length;
  };

  const nextTag = (): Tag => {
    skipMisc();
    if (xml[pos] !== "<") fail("expected a tag", pos);
    const start = pos;
    const end = indexAfter(">");
    const inner = xml.slice(start + 1, end - 1).trim();
    const closing = inner.startsWith("/");
    const selfClosing = inner.endsWith("/");
    const name = inner.replace(/^\//, "").replace(/\/$/, "").split(/\s+/)[0] ?? "";
    pos = end;
    return { name, closing, selfClosing, start, end };
  };

  /** Raw text up to the closing tag `</name>` (CDATA sections are supported). */
  const textUntilClose = (name: string): string => {
    const close = `</${name}>`;
    let out = "";
    for (;;) {
      if (xml.startsWith("<![CDATA[", pos)) {
        const end = xml.indexOf("]]>", pos);
        if (end < 0) fail("unterminated CDATA", pos);
        out += xml.slice(pos + 9, end);
        pos = end + 3;
        continue;
      }
      const next = xml.indexOf("<", pos);
      if (next < 0) fail(`missing ${close}`, pos);
      out += decodeEntities(xml.slice(pos, next), pos);
      pos = next;
      if (xml.startsWith(close, pos)) {
        pos += close.length;
        return out;
      }
      if (!xml.startsWith("<![CDATA[", pos)) fail(`unexpected markup inside <${name}>`, pos);
    }
  };

  const atEnd = (): boolean => {
    skipMisc();
    return pos >= xml.length;
  };

  return { nextTag, textUntilClose, skipMisc, position: () => pos, atEnd };
};

type Reader = ReturnType<typeof createReader>;

const parseInteger = (text: string, position: number): number | bigint => {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+|0x[0-9a-f]+)$/i.test(trimmed)) return fail(`bad integer "${trimmed}"`, position);
  const negative = trimmed.startsWith("-");
  const magnitude = BigInt(trimmed.replace(/^[+-]/, ""));
  const value = negative ? -magnitude : magnitude;
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
};

const parseReal = (text: string, position: number): number => {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "nan") return Number.NaN;
  if (trimmed === "inf" || trimmed === "+inf" || trimmed === "infinity" || trimmed === "+infinity") return Infinity;
  if (trimmed === "-inf" || trimmed === "-infinity") return -Infinity;
  const value = Number(trimmed);
  return Number.isNaN(value) ? fail(`bad real "${trimmed}"`, position) : value;
};

const parseValue = (reader: Reader, tag: Tag, depth: number, maxDepth: number): PlistValue => {
  if (depth > maxDepth) fail("nesting too deep", tag.start);
  if (tag.closing) fail(`unexpected </${tag.name}>`, tag.start);

  switch (tag.name) {
    case "dict": {
      const entries: [string, PlistValue][] = [];
      if (tag.selfClosing) return createDict();
      for (;;) {
        const keyTag = reader.nextTag();
        if (keyTag.closing && keyTag.name === "dict") return createDict(entries);
        if (keyTag.name !== "key") fail(`expected <key>, got <${keyTag.name}>`, keyTag.start);
        const key = keyTag.selfClosing ? "" : reader.textUntilClose("key");
        entries.push([key, parseValue(reader, reader.nextTag(), depth + 1, maxDepth)]);
      }
    }
    case "array": {
      const items: PlistValue[] = [];
      if (tag.selfClosing) return items;
      for (;;) {
        const next = reader.nextTag();
        if (next.closing && next.name === "array") return items;
        items.push(parseValue(reader, next, depth + 1, maxDepth));
      }
    }
    case "string":
      return tag.selfClosing ? "" : reader.textUntilClose("string");
    case "integer":
      return parseInteger(tag.selfClosing ? "" : reader.textUntilClose("integer"), tag.start);
    case "real":
      return real(parseReal(tag.selfClosing ? "" : reader.textUntilClose("real"), tag.start));
    case "true":
    case "false":
      if (!tag.selfClosing && reader.nextTag().name !== tag.name) fail(`malformed <${tag.name}>`, tag.start);
      return tag.name === "true";
    case "data":
      return tag.selfClosing ? new Uint8Array(0) : fromBase64(reader.textUntilClose("data"));
    case "date": {
      const text = tag.selfClosing ? "" : reader.textUntilClose("date").trim();
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? fail(`bad date "${text}"`, tag.start) : date;
    }
    default:
      return fail(`unknown element <${tag.name}>`, tag.start);
  }
};

/** Parses an XML property list (bytes must be UTF-8). */
export const parseXmlPlist = (input: Uint8Array | string, limits: PlistLimits = DEFAULT_PLIST_LIMITS): PlistValue => {
  let xml: string;
  try {
    xml = typeof input === "string" ? input : utf8Decode(input);
  } catch (error) {
    throw new LoadstarError(ErrorCode.InvalidPlist, { message: "XML plist is not valid UTF-8", cause: error });
  }
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const reader = createReader(xml);
  const root = reader.nextTag();
  if (root.name !== "plist" || root.closing) fail("missing <plist> root", root.start);
  if (root.selfClosing) fail("empty <plist>", root.start);

  const value = parseValue(reader, reader.nextTag(), 0, limits.maxDepth);
  const close = reader.nextTag();
  if (!close.closing || close.name !== "plist") fail("expected </plist>", close.start);
  if (!reader.atEnd()) fail("trailing content after </plist>", reader.position());
  return value;
};
