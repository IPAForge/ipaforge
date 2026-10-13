import { ErrorCode, equalBytes, fromBase64, LoadstarError, type Logger, silentLogger } from "@loadstar/kernel";
import { APPLE_CERTIFICATES } from "@signer/infrastructure/cms/apple-certificates.ts";
import { parseCertificate } from "@signer/infrastructure/cms/certificate.ts";
import * as pkijs from "pkijs";

const OID_AUTHORITY_INFO_ACCESS = "1.3.6.1.5.5.7.1.1";
const OID_CA_ISSUERS = "1.3.6.1.5.5.7.48.2";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";

/** Downloads a certificate (DER or PEM) from an AIA `caIssuers` URL. Provided by the caller (HttpClient port). */
export type IssuerFetcher = (url: string, signal?: AbortSignal) => Promise<Uint8Array>;

export interface ChainResolution {
  /** Intermediate(s) then root, as embedded in the CMS after the leaf. */
  readonly chain: readonly Uint8Array[];
  readonly source: "bundled" | "fetched";
  readonly fetchedFrom?: string;
}

export interface ResolveChainOptions {
  /** Used only when the leaf's issuer is not bundled. Without it, unknown issuers fail. */
  readonly fetchIssuer?: IssuerFetcher;
  /** Trust anchors (default: the bundled Apple roots). Tests inject their own. */
  readonly roots?: readonly Uint8Array[];
  /** Known intermediates (default: the bundled Apple WWDR CAs). */
  readonly intermediates?: readonly Uint8Array[];
  readonly logger?: Logger;
  readonly signal?: AbortSignal;
}

const bundled = (kind: "root" | "intermediate"): Uint8Array[] =>
  APPLE_CERTIFICATES.filter((c) => c.kind === kind).map((c) => fromBase64(c.der));

const nameDer = (name: pkijs.RelativeDistinguishedNames): Uint8Array => new Uint8Array(name.toSchema().toBER(false));

const unknownIssuer = (message: string, data: Record<string, unknown> = {}): LoadstarError =>
  new LoadstarError(ErrorCode.UnknownIssuer, { message, data });

/** `caIssuers` URLs from the leaf's Authority Information Access extension. */
export const caIssuerUrls = (certificate: pkijs.Certificate): string[] => {
  const extension = certificate.extensions?.find((e) => e.extnID === OID_AUTHORITY_INFO_ACCESS);
  const parsed = extension?.parsedValue;
  if (!(parsed instanceof pkijs.InfoAccess)) return [];
  return parsed.accessDescriptions
    .filter((d) => d.accessMethod === OID_CA_ISSUERS && d.accessLocation.type === 6) // uniformResourceIdentifier
    .map((d) => String(d.accessLocation.value));
};

const isCa = (certificate: pkijs.Certificate): boolean => {
  const parsed = certificate.extensions?.find((e) => e.extnID === OID_BASIC_CONSTRAINTS)?.parsedValue;
  return parsed instanceof pkijs.BasicConstraints && parsed.cA === true;
};

const isValidAt = (certificate: pkijs.Certificate, now: Date): boolean =>
  certificate.notBefore.value.getTime() <= now.getTime() && now.getTime() <= certificate.notAfter.value.getTime();

/** True when `issuer` is named as the subject's issuer AND its key verifies the subject's signature. */
const issued = async (issuer: pkijs.Certificate, subject: pkijs.Certificate): Promise<boolean> =>
  equalBytes(nameDer(issuer.subject), nameDer(subject.issuer)) && (await subject.verify(issuer).catch(() => false));

const decodeCertificate = (bytes: Uint8Array): pkijs.Certificate => {
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, 64));
  if (text.includes("-----BEGIN CERTIFICATE-----")) {
    const pem = new TextDecoder().decode(bytes);
    return parseCertificate(fromBase64(pem.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, "")));
  }
  return parseCertificate(bytes);
};

/**
 * Resolves the chain to embed for a leaf certificate (signer-spec §5.1):
 *  1. a bundled intermediate that verifiably issued the leaf, plus the bundled root that issued it;
 *  2. otherwise the leaf's AIA `caIssuers` certificate, fetched and accepted only if it verifiably
 *     issued the leaf, is a valid CA, and is itself verifiably issued by a trusted root.
 * Roots are the only trust anchors; downloads can fill in intermediates, never replace roots.
 */
export const resolveChain = async (
  leafDer: Uint8Array,
  options: ResolveChainOptions = {},
): Promise<ChainResolution> => {
  const logger = options.logger ?? silentLogger;
  const leaf = parseCertificate(leafDer);
  const roots = (options.roots ?? bundled("root")).map((der) => ({ der, cert: parseCertificate(der) }));
  const intermediates = (options.intermediates ?? bundled("intermediate")).map((der) => ({
    der,
    cert: parseCertificate(der),
  }));

  const rootFor = async (intermediate: pkijs.Certificate) => {
    for (const root of roots) if (await issued(root.cert, intermediate)) return root;
    return undefined;
  };

  for (const intermediate of intermediates) {
    if (!(await issued(intermediate.cert, leaf))) continue;
    const root = await rootFor(intermediate.cert);
    if (root) return { chain: [intermediate.der, root.der], source: "bundled" };
  }

  const urls = caIssuerUrls(leaf);
  if (!options.fetchIssuer || urls.length === 0) {
    throw unknownIssuer(
      urls.length === 0
        ? "certificate issuer is not a known Apple CA and the certificate names no issuer download"
        : "certificate issuer is not bundled; issuer download is not available here",
      { urls },
    );
  }

  const now = new Date();
  const failures: string[] = [];
  for (const url of urls) {
    options.signal?.throwIfAborted();
    try {
      const der = await options.fetchIssuer(url, options.signal);
      const candidate = decodeCertificate(der);
      if (!(await issued(candidate, leaf))) throw new Error("downloaded certificate did not issue this certificate");
      if (!isCa(candidate)) throw new Error("downloaded certificate is not a CA");
      if (!isValidAt(candidate, now)) throw new Error("downloaded certificate is expired or not yet valid");
      const root = await rootFor(candidate);
      if (!root) throw new Error("downloaded certificate does not chain to a trusted Apple root");
      const candidateDer = new Uint8Array(candidate.toSchema(true).toBER(false));
      logger.warn("using an Apple intermediate that is not bundled; update apple-certificates.ts", { url });
      return { chain: [candidateDer, root.der], source: "fetched", fetchedFrom: url };
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw unknownIssuer("could not establish a trusted chain for this certificate", { failures });
};

/** Bundled Apple certificates expiring before `before` (for maintenance warnings). */
export const expiringAppleCertificates = (before: Date): { name: string; notAfter: Date }[] =>
  APPLE_CERTIFICATES.map((c) => ({
    name: c.name,
    notAfter: parseCertificate(fromBase64(c.der)).notAfter.value,
  })).filter((c) => c.notAfter.getTime() < before.getTime());
