import { ErrorCode, fromBase64, LoadstarError, toBase64, toHex, utf8Encode } from "@loadstar/kernel";
import { createCertificate, type TestCertificate } from "@signer/__tests__/pki.ts";
import { APPLE_CERTIFICATES } from "@signer/infrastructure/cms/apple-certificates.ts";
import { parseCertificate } from "@signer/infrastructure/cms/certificate.ts";
import { caIssuerUrls, expiringAppleCertificates, resolveChain } from "@signer/infrastructure/cms/chain.ts";
import { beforeAll, describe, expect, it } from "vitest";

const URL_INTERMEDIATE = "http://certs.example.test/intermediate.der";

let root: TestCertificate;
let intermediate: TestCertificate;
let leaf: TestCertificate;

beforeAll(async () => {
  root = await createCertificate({ commonName: "Test Root CA", ca: true });
  intermediate = await createCertificate({ commonName: "Test WWDR CA G9", ca: true, issuer: root });
  leaf = await createCertificate({
    commonName: "Apple Development: Test (ABCDE12345)",
    organizationalUnit: "ABCDE12345",
    issuer: intermediate,
    issuerUrl: URL_INTERMEDIATE,
  });
});

const expectCode = async (promise: Promise<unknown>, code: string): Promise<LoadstarError> => {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(LoadstarError);
  expect((error as LoadstarError).code).toBe(code);
  return error as LoadstarError;
};

describe("resolveChain — bundled intermediates", () => {
  it("returns [intermediate, root] when a known intermediate verifiably issued the leaf", async () => {
    const result = await resolveChain(leaf.der, { roots: [root.der], intermediates: [intermediate.der] });
    expect(result.source).toBe("bundled");
    expect(result.chain.map(toHex)).toEqual([toHex(intermediate.der), toHex(root.der)]);
  });

  it("rejects a leaf that only *claims* a bundled Apple intermediate as issuer", async () => {
    const g3 = APPLE_CERTIFICATES.find((c) => c.name === "Apple WWDR CA G3");
    const forged = await createCertificate({
      commonName: "Apple Development: Forged (ABCDE12345)",
      claimedIssuer: parseCertificate(fromBase64(g3?.der ?? "")).subject,
    });
    await expectCode(resolveChain(forged.der), ErrorCode.UnknownIssuer);
  });
});

describe("resolveChain — issuer download (AIA caIssuers)", () => {
  it("reads the caIssuers URL from the leaf", () => {
    expect(caIssuerUrls(leaf.cert)).toEqual([URL_INTERMEDIATE]);
  });

  it("fetches an unbundled intermediate and accepts it after verifying it", async () => {
    const requested: string[] = [];
    const result = await resolveChain(leaf.der, {
      roots: [root.der],
      intermediates: [],
      fetchIssuer: async (url) => {
        requested.push(url);
        return intermediate.der;
      },
    });
    expect(requested).toEqual([URL_INTERMEDIATE]);
    expect(result).toMatchObject({ source: "fetched", fetchedFrom: URL_INTERMEDIATE });
    expect(result.chain.map(toHex)).toEqual([toHex(intermediate.der), toHex(root.der)]);
  });

  it("accepts PEM downloads", async () => {
    const pem = `-----BEGIN CERTIFICATE-----\n${toBase64(intermediate.der)
      .match(/.{1,64}/g)
      ?.join("\n")}\n-----END CERTIFICATE-----\n`;
    const result = await resolveChain(leaf.der, {
      roots: [root.der],
      intermediates: [],
      fetchIssuer: async () => utf8Encode(pem),
    });
    expect(result.source).toBe("fetched");
  });

  it("rejects a download that did not issue the leaf", async () => {
    const impostor = await createCertificate({ commonName: "Test WWDR CA G9", ca: true, issuer: root }); // same name, other key
    const error = await expectCode(
      resolveChain(leaf.der, { roots: [root.der], intermediates: [], fetchIssuer: async () => impostor.der }),
      ErrorCode.UnknownIssuer,
    );
    expect(JSON.stringify(error.data)).toContain("did not issue");
  });

  it("rejects a download that does not chain to a trusted root", async () => {
    const otherRoot = await createCertificate({ commonName: "Other Root", ca: true });
    const error = await expectCode(
      resolveChain(leaf.der, { roots: [otherRoot.der], intermediates: [], fetchIssuer: async () => intermediate.der }),
      ErrorCode.UnknownIssuer,
    );
    expect(JSON.stringify(error.data)).toContain("trusted Apple root");
  });

  it("rejects a download that is not a CA", async () => {
    const notCa = await createCertificate({ commonName: "Not A CA", issuer: root });
    const child = await createCertificate({ commonName: "Child", issuer: notCa, issuerUrl: URL_INTERMEDIATE });
    const error = await expectCode(
      resolveChain(child.der, { roots: [root.der], intermediates: [], fetchIssuer: async () => notCa.der }),
      ErrorCode.UnknownIssuer,
    );
    expect(JSON.stringify(error.data)).toContain("not a CA");
  });

  it("reports download failures and the missing fetcher clearly", async () => {
    await expectCode(
      resolveChain(leaf.der, {
        roots: [root.der],
        intermediates: [],
        fetchIssuer: async () => {
          throw new Error("offline");
        },
      }),
      ErrorCode.UnknownIssuer,
    );
    await expectCode(resolveChain(leaf.der, { roots: [root.der], intermediates: [] }), ErrorCode.UnknownIssuer);
  });
});

describe("bundled Apple certificate health", () => {
  it("contains no expired certificates", () => {
    expect(expiringAppleCertificates(new Date())).toEqual([]);
  });

  it("warns when a bundled certificate expires within 12 months", () => {
    const soon = new Date(Date.now() + 365 * 24 * 3600 * 1000);
    for (const cert of expiringAppleCertificates(soon)) {
      console.warn(
        `[apple-certificates] ${cert.name} expires ${cert.notAfter.toISOString()} — run update-apple-certificates`,
      );
    }
    expect(true).toBe(true);
  });
});
