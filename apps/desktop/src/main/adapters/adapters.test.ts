import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect, createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TLSSocket } from "node:tls";
import { nodeFileSource } from "@desktop/main/adapters/file-source.ts";
import { createNodeConnection } from "@desktop/main/adapters/node-connection.ts";
import { resolveUsbmuxdEndpoint } from "@desktop/main/adapters/usbmux-transport.ts";
import { createPairRecord, decodePem, type PairRecord, tlsCredentials } from "@loadstar/device";
import { ErrorCode, LoadstarError, utf8Decode, utf8Encode } from "@loadstar/kernel";
import { afterEach, describe, expect, it } from "vitest";

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

/** A device stand-in: plaintext until "STARTTLS\n", then TLS with the device certificate, then echo. */
const startDevice = async (record: PairRecord, deviceKeyPem: string): Promise<number> => {
  const server = createServer((socket: Socket) => {
    socket.once("data", (data) => {
      if (data.toString() !== "STARTTLS\n") return socket.destroy();
      socket.write("OK\n", () => {
        const secure = new TLSSocket(socket, {
          isServer: true,
          cert: utf8Decode(record.deviceCertificate),
          key: deviceKeyPem,
          ca: [utf8Decode(record.rootCertificate)],
          requestCert: true,
          rejectUnauthorized: true,
          ciphers: "DEFAULT:@SECLEVEL=0",
        });
        secure.on("data", (chunk) => secure.write(chunk));
        secure.on("error", () => secure.destroy());
      });
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return address.port;
};

const pairing = async () => {
  const device = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const record = await createPairRecord({
    devicePublicKey: utf8Encode(device.publicKey.export({ type: "pkcs1", format: "pem" }).toString()),
    systemBuid: "BUID",
    now: new Date(Date.now() - 60_000),
  });
  return { record, deviceKeyPem: device.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
};

const plainConnect = (port: number) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port }, () => resolve(socket));
    socket.once("error", reject);
  });

const readLine = async (connection: ReturnType<typeof createNodeConnection>): Promise<string> => {
  let text = "";
  while (!text.endsWith("\n")) {
    const chunk = await connection.read();
    if (!chunk) break;
    text += utf8Decode(chunk);
  }
  return text;
};

describe("Node connection", () => {
  it("upgrades to TLS in place, authenticating the device by its pinned certificate", async () => {
    const { record, deviceKeyPem } = await pairing();
    const connection = createNodeConnection(await plainConnect(await startDevice(record, deviceKeyPem)));
    await connection.write(utf8Encode("STARTTLS\n"));
    expect(await readLine(connection)).toBe("OK\n");
    await connection.startTls(tlsCredentials(record));
    await connection.write(utf8Encode("over tls\n"));
    expect(await readLine(connection)).toBe("over tls\n");
    await connection.close();
  });

  it("rejects a device whose certificate is not the pinned one", async () => {
    const { record, deviceKeyPem } = await pairing();
    const other = await pairing();
    const connection = createNodeConnection(await plainConnect(await startDevice(record, deviceKeyPem)));
    await connection.write(utf8Encode("STARTTLS\n"));
    await readLine(connection);
    const credentials = {
      ...tlsCredentials(record),
      expectedPeerCertificate: decodePem(other.record.deviceCertificate).der,
    };
    const error = await connection.startTls(credentials).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoadstarError);
    expect((error as LoadstarError).code).toBe(ErrorCode.InvalidPairRecord);
    await connection.close();
  });

  it("reports end of stream as null", async () => {
    const server = createServer((socket) => socket.end("bye"));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const connection = createNodeConnection(await plainConnect(address.port));
    expect(utf8Decode((await connection.read()) ?? new Uint8Array())).toBe("bye");
    expect(await connection.read()).toBeNull();
  });
});

describe("usbmuxd endpoint", () => {
  it("uses the per-OS default and honours USBMUXD_SOCKET_ADDRESS", () => {
    expect(resolveUsbmuxdEndpoint("darwin", undefined)).toEqual({ kind: "unix", path: "/var/run/usbmuxd" });
    expect(resolveUsbmuxdEndpoint("linux", undefined)).toEqual({ kind: "unix", path: "/var/run/usbmuxd" });
    expect(resolveUsbmuxdEndpoint("win32", undefined)).toEqual({ kind: "tcp", host: "127.0.0.1", port: 27015 });
    expect(resolveUsbmuxdEndpoint("linux", "UNIX:/tmp/mux")).toEqual({ kind: "unix", path: "/tmp/mux" });
    expect(resolveUsbmuxdEndpoint("darwin", "10.0.0.2:27015")).toEqual({ kind: "tcp", host: "10.0.0.2", port: 27015 });
    expect(() => resolveUsbmuxdEndpoint("darwin", "nonsense")).toThrow(LoadstarError);
  });
});

describe("file source", () => {
  it("streams and slices a file on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loadstar-"));
    try {
      const path = join(dir, "App.ipa");
      await writeFile(path, "0123456789");
      const source = await nodeFileSource(path);
      expect(source).toMatchObject({ name: "App.ipa", size: 10 });
      expect(utf8Decode(await source.slice(2, 5))).toBe("234");
      expect(utf8Decode(await source.slice(8, 50))).toBe("89");
      const chunks: Uint8Array[] = [];
      for await (const chunk of source.stream()) chunks.push(chunk);
      expect(utf8Decode(Buffer.concat(chunks))).toBe("0123456789");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("HTTP redirects", () => {
  it("refuses HTTPS → HTTP and drops identifying headers on cross-host redirects", async () => {
    const { redirectTarget } = await import("@desktop/main/adapters/http-client.ts");
    const from = new URL("https://gsa.apple.com/auth");
    const headers = { "X-Apple-Identity-Token": "secret", "X-Apple-I-MD": "md", Accept: "application/json" };
    expect(() => redirectTarget(from, "http://gsa.apple.com/auth", headers)).toThrow(LoadstarError);
    expect(redirectTarget(from, "/other", headers).headers).toEqual(headers);
    expect(redirectTarget(from, "https://elsewhere.example/x", headers).headers).toEqual({
      Accept: "application/json",
    });
  });
});

describe("file secret store", () => {
  it("persists values in a 0600 file and routes by prefix", async () => {
    const { createFileSecretStore, createRoutedSecretStore } = await import(
      "@desktop/main/adapters/file-secret-store.ts"
    );
    const { createMemorySecretStore } = await import("@desktop/main/adapters/memory-secret-store.ts");
    const { stat } = await import("node:fs/promises");
    const dir = await mkdtemp(join(tmpdir(), "loadstar-secrets-"));
    try {
      const path = join(dir, "nested", "store.json");
      const store = createRoutedSecretStore(["anisette/"], createFileSecretStore(path), createMemorySecretStore());
      await store.set("anisette/state", utf8Encode("machine"));
      await store.set("apple/session", utf8Encode("in memory only"));
      const reopened = createFileSecretStore(path);
      expect(utf8Decode((await reopened.get("anisette/state")) ?? new Uint8Array())).toBe("machine");
      expect(await reopened.get("apple/session")).toBeUndefined();
      if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
      await reopened.delete("anisette/state");
      expect(await createFileSecretStore(path).get("anisette/state")).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
