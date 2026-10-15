// Test-only: a scriptable iPhone behind a fake usbmuxd (usbmux, lockdownd and the services Loadstar uses).

import { createFakeFs, type FakeFs, serveAfc } from "@device/__tests__/fake-device/fake-afc.ts";
import { createPipe } from "@device/__tests__/fake-device/pipe.ts";
import { DEFAULT_DEVICE_CONFIG } from "@device/domain/config.ts";
import { LOCKDOWN_PORT, Service, UsbmuxResult } from "@device/domain/constants.ts";
import { encodePem } from "@device/domain/pairing/pem.ts";
import type { DeviceTransport, TlsCredentials } from "@device/domain/ports/transport.ts";
import { summarizeProfile } from "@device/domain/profiles.ts";
import { createLink, type Link } from "@device/infrastructure/framing/link.ts";
import { type FrameLimits, receivePlist, sendPlist } from "@device/infrastructure/framing/plist-frames.ts";
import { encodeUsbmuxPacket, readUsbmuxPacket, toNetworkPort } from "@device/infrastructure/usbmux/protocol.ts";
import {
  createDict,
  isPlistDict,
  type PlistDict,
  type PlistValue,
  type SecretStore,
  utf8Decode,
  utf8Encode,
} from "@loadstar/kernel";
import * as pkijs from "pkijs";

const LIMITS: FrameLimits = {
  maxMessageBytes: DEFAULT_DEVICE_CONFIG.maxMessageBytes,
  plist: DEFAULT_DEVICE_CONFIG.plist,
};

export interface FakeApp {
  readonly bundleId: string;
  readonly name: string;
  readonly version: string;
  readonly container: FakeFs;
}

export interface FakeDeviceOptions {
  readonly udid?: string;
  readonly deviceId?: number;
  readonly productVersion?: string;
  readonly connectionType?: "USB" | "Network";
  /** Pair answers PairingDialogResponsePending this many times before accepting. */
  readonly pendingPolls?: number;
  /** Pair answers PasswordProtected this many times first. */
  readonly lockedPolls?: number;
  readonly denyPairing?: boolean;
  /** `undefined` = the device does not report it (before iOS 16). */
  readonly developerMode?: boolean | undefined;
  /** The screen is locked (lockdownd `PasswordProtected`). */
  readonly locked?: boolean;
  /** A passcode is set (Wi-Fi debugging needs one). */
  readonly hasPasscode?: boolean;
}

export interface FakeDevice {
  readonly udid: string;
  readonly deviceId: number;
  readonly connectionType: "USB" | "Network";
  readonly productVersion: string;
  readonly media: FakeFs;
  readonly apps: Map<string, FakeApp>;
  readonly profiles: Uint8Array[];
  readonly values: Map<string, PlistValue>;
  readonly acceptedHostIds: Set<string>;
  readonly requests: string[];
  readonly tlsUpgrades: TlsCredentials[];
  pendingPolls: number;
  lockedPolls: number;
  denyPairing: boolean;
  developerMode: boolean | undefined;
  locked: boolean;
  hasPasscode: boolean;
  /** The next install fails with this installation_proxy error. */
  nextInstallError: string | undefined;
  nextInstallDescription: string | undefined;
  devicePublicKeyPem: Uint8Array;
}

export interface FakeUsbmuxd {
  readonly transport: DeviceTransport;
  readonly devices: FakeDevice[];
  readonly pairRecords: Map<string, Uint8Array>;
  readonly buid: string;
  refuseSavePairRecord: boolean;
  /** usbmuxd is not running: every connection fails. */
  unavailable: boolean;
  attach(device: FakeDevice): void;
  detach(udid: string): void;
}

/** A real RSA key, as lockdownd reports `DevicePublicKey` (PKCS#1 PEM). */
const devicePublicKey = async (): Promise<Uint8Array> => {
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const spki = pkijs.PublicKeyInfo.fromBER(await crypto.subtle.exportKey("spki", keys.publicKey));
  return utf8Encode(encodePem("RSA PUBLIC KEY", new Uint8Array(spki.subjectPublicKey.valueBlock.valueHexView)));
};

let sharedKey: Promise<Uint8Array> | undefined;
const sharedDevicePublicKey = (): Promise<Uint8Array> => {
  if (!sharedKey) sharedKey = devicePublicKey();
  return sharedKey;
};

export const createFakeDevice = async (options: FakeDeviceOptions = {}): Promise<FakeDevice> => ({
  udid: options.udid ?? "00008110-001A2B3C4D5E6F70",
  deviceId: options.deviceId ?? 7,
  connectionType: options.connectionType ?? "USB",
  productVersion: options.productVersion ?? "18.2",
  media: createFakeFs(),
  apps: new Map(),
  profiles: [],
  values: new Map(),
  acceptedHostIds: new Set(),
  requests: [],
  tlsUpgrades: [],
  pendingPolls: options.pendingPolls ?? 0,
  lockedPolls: options.lockedPolls ?? 0,
  denyPairing: options.denyPairing ?? false,
  developerMode: "developerMode" in options ? options.developerMode : true,
  locked: options.locked ?? false,
  hasPasscode: options.hasPasscode ?? true,
  nextInstallError: undefined,
  nextInstallDescription: undefined,
  devicePublicKeyPem: await sharedDevicePublicKey(),
});

export const addApp = (device: FakeDevice, bundleId: string, name = bundleId): FakeApp => {
  const app: FakeApp = { bundleId, name, version: "1", container: createFakeFs() };
  app.container.dirs.add("Documents");
  device.apps.set(bundleId, app);
  return app;
};

/** A fake signed profile: junk bytes around an XML plist, like a CMS-wrapped `.mobileprovision`. */
export const fakeProfile = (fields: {
  uuid: string;
  name: string;
  teamId: string;
  bundleId: string;
  expires: Date;
}) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>
<key>UUID</key><string>${fields.uuid}</string><key>Name</key><string>${fields.name}</string>
<key>TeamIdentifier</key><array><string>${fields.teamId}</string></array>
<key>ExpirationDate</key><date>${fields.expires.toISOString().replace(/\.\d+Z$/, "Z")}</date>
<key>Entitlements</key><dict><key>application-identifier</key><string>${fields.teamId}.${fields.bundleId}</string></dict>
</dict></plist>`;
  return new Uint8Array([0x30, 0x82, 0x01, ...utf8Encode(body), 0xa0, 0x00]);
};

const deviceValues = (device: FakeDevice): PlistDict =>
  createDict([
    ["UniqueDeviceID", device.udid],
    ["DeviceName", "Test iPhone"],
    ["ProductType", "iPhone17,1"],
    ["ProductVersion", device.productVersion],
    ["BuildVersion", "22C152"],
    ["DeviceClass", "iPhone"],
    ["CPUArchitecture", "arm64e"],
    ["ActivationState", "Activated"],
    ["PasswordProtected", device.locked],
  ]);

const serveLockdown = async (link: Link, device: FakeDevice, ports: Map<number, string>): Promise<void> => {
  let nextPort = 49_152 + ports.size;
  for (;;) {
    let message: PlistDict;
    try {
      message = await receivePlist(link, LIMITS);
    } catch {
      return;
    }
    const request = String(message.Request);
    device.requests.push(`lockdown:${request}`);
    const answer = (fields: readonly (readonly [string, PlistValue])[]) =>
      sendPlist(link, createDict([["Request", request], ...fields]));
    const fail = (error: string) => answer([["Error", error]]);

    switch (request) {
      case "QueryType":
        await answer([["Type", "com.apple.mobile.lockdown"]]);
        break;
      case "GetValue": {
        const key = typeof message.Key === "string" ? message.Key : undefined;
        const domain = typeof message.Domain === "string" ? message.Domain : undefined;
        if (key === "DevicePublicKey") await answer([["Value", device.devicePublicKeyPem]]);
        else if (key === "WiFiAddress") await answer([["Value", "aa:bb:cc:dd:ee:ff"]]);
        else if (domain === "com.apple.security.mac.amfi" && key === "DeveloperModeStatus") {
          if (device.developerMode === undefined) await fail("MissingValue");
          else await answer([["Value", device.developerMode]]);
        } else if (!key) await answer([["Value", deviceValues(device)]]);
        else {
          const value = device.values.get(`${domain ?? ""}/${key}`) ?? deviceValues(device)[key];
          if (value === undefined) await fail("MissingValue");
          else await answer([["Value", value]]);
        }
        break;
      }
      case "SetValue":
        if (message.Key === "EnableWifiDebugging" && !device.hasPasscode) {
          await fail("MissingValue");
          break;
        }
        device.values.set(`${String(message.Domain)}/${String(message.Key)}`, message.Value ?? "");
        await answer([]);
        break;
      case "Pair": {
        const record = isPlistDict(message.PairRecord) ? message.PairRecord : createDict();
        if (device.lockedPolls > 0) {
          device.lockedPolls--;
          await fail("PasswordProtected");
        } else if (device.denyPairing) await fail("UserDeniedPairing");
        else if (device.pendingPolls > 0) {
          device.pendingPolls--;
          await fail("PairingDialogResponsePending");
        } else {
          device.acceptedHostIds.add(String(record.HostID));
          await answer([["EscrowBag", utf8Encode("escrow")]]);
        }
        break;
      }
      case "StartSession":
        if (!device.acceptedHostIds.has(String(message.HostID))) await fail("InvalidHostID");
        else
          await answer([
            ["SessionID", "SESSION-1"],
            ["EnableSessionSSL", true],
          ]);
        break;
      case "StartService": {
        const service = String(message.Service);
        if (!Object.values(Service).includes(service as never)) {
          await fail("InvalidService");
          break;
        }
        const port = nextPort++;
        ports.set(port, service);
        await answer([
          ["Port", port],
          ["Service", service],
          ["EnableServiceSSL", service !== Service.Afc],
        ]);
        break;
      }
      case "StopSession":
        await answer([]);
        break;
      default:
        await fail("UnknownRequest");
    }
  }
};

const serveInstallationProxy = async (link: Link, device: FakeDevice): Promise<void> => {
  for (;;) {
    let message: PlistDict;
    try {
      message = await receivePlist(link, LIMITS);
    } catch {
      return;
    }
    const command = String(message.Command);
    device.requests.push(`installation_proxy:${command}`);
    const send = (fields: readonly (readonly [string, PlistValue])[]) => sendPlist(link, createDict(fields));
    if (command === "Install" || command === "Upgrade") {
      const path = String(message.PackagePath);
      const ipa = device.media.files.get(path);
      if (device.nextInstallError) {
        const error = device.nextInstallError;
        const description = device.nextInstallDescription ?? `fake: ${error}`;
        device.nextInstallError = undefined;
        device.nextInstallDescription = undefined;
        await send([
          ["Error", error],
          ["ErrorDescription", description],
        ]);
        continue;
      }
      if (!ipa) {
        await send([["Error", "PackageNotFound"]]);
        continue;
      }
      // Fake IPAs are the text "IPA:<bundle id>".
      const bundleId = utf8Decode(ipa).replace(/^IPA:/, "");
      for (const [status, percent] of [
        ["CreatingStagingDirectory", 5],
        ["VerifyingApplication", 40],
        ["InstallingApplication", 80],
      ] as const) {
        await send([
          ["Status", status],
          ["PercentComplete", percent],
        ]);
      }
      addApp(device, bundleId);
      await send([["Status", "Complete"]]);
    } else if (command === "Uninstall") {
      device.apps.delete(String(message.ApplicationIdentifier));
      await send([["Status", "Complete"]]);
    } else if (command === "Browse") {
      const list = [...device.apps.values()].map((app) =>
        createDict([
          ["CFBundleIdentifier", app.bundleId],
          ["CFBundleName", app.name],
          ["CFBundleVersion", app.version],
        ]),
      );
      await send([
        ["Status", "BrowsingApplications"],
        ["CurrentList", list],
        ["Total", list.length],
      ]);
      await send([["Status", "Complete"]]);
    } else if (command === "Lookup") {
      const options = isPlistDict(message.ClientOptions) ? message.ClientOptions : createDict();
      const ids = Array.isArray(options.BundleIDs) ? options.BundleIDs.map(String) : [];
      const result = createDict(
        ids.filter((id) => device.apps.has(id)).map((id) => [id, createDict([["CFBundleIdentifier", id]])] as const),
      );
      await send([
        ["LookupResult", result],
        ["Status", "Complete"],
      ]);
    } else {
      await send([["Error", "UnknownCommand"]]);
    }
  }
};

const serveMisagent = async (link: Link, device: FakeDevice): Promise<void> => {
  for (;;) {
    let message: PlistDict;
    try {
      message = await receivePlist(link, LIMITS);
    } catch {
      return;
    }
    const type = String(message.MessageType);
    device.requests.push(`misagent:${type}`);
    if (type === "CopyAll") {
      await sendPlist(
        link,
        createDict([
          ["Payload", [...device.profiles]],
          ["Status", 0],
        ]),
      );
    } else if (type === "Install" && message.Profile instanceof Uint8Array) {
      device.profiles.push(message.Profile);
      await sendPlist(link, createDict([["Status", 0]]));
    } else if (type === "Remove") {
      const index = device.profiles.findIndex((raw) => summarizeProfile(raw)?.uuid === message.ProfileID);
      if (index >= 0) device.profiles.splice(index, 1);
      await sendPlist(link, createDict([["Status", index >= 0 ? 0 : 0xe8008015]]));
    } else {
      await sendPlist(link, createDict([["Status", 1]]));
    }
  }
};

const serveHouseArrest = async (link: Link, device: FakeDevice): Promise<void> => {
  let message: PlistDict;
  try {
    message = await receivePlist(link, LIMITS);
  } catch {
    return;
  }
  device.requests.push(`house_arrest:${String(message.Command)}`);
  const app = device.apps.get(String(message.Identifier));
  if (!app) {
    await sendPlist(link, createDict([["Error", "ApplicationLookupFailed"]]));
    return;
  }
  await sendPlist(link, createDict([["Status", "Complete"]]));
  await serveAfc(link, app.container);
};

const serveAmfi = async (link: Link, device: FakeDevice): Promise<void> => {
  const message = await receivePlist(link, LIMITS).catch(() => undefined);
  if (!message) return;
  device.requests.push(`amfi:${String(message.action)}`);
  await sendPlist(link, createDict([["success", true]]));
};

const serveService = (service: string, link: Link, device: FakeDevice): Promise<void> => {
  switch (service) {
    case Service.Afc:
      return serveAfc(link, device.media);
    case Service.InstallationProxy:
      return serveInstallationProxy(link, device);
    case Service.Misagent:
      return serveMisagent(link, device);
    case Service.HouseArrest:
      return serveHouseArrest(link, device);
    case Service.Amfi:
      return serveAmfi(link, device);
    default:
      return Promise.resolve();
  }
};

export const createFakeUsbmuxd = (devices: FakeDevice[] = []): FakeUsbmuxd => {
  const listeners = new Set<(packet: Uint8Array) => void>();
  const ports = new Map<FakeDevice, Map<number, string>>();
  const portsOf = (device: FakeDevice) => {
    let map = ports.get(device);
    if (!map) {
      map = new Map();
      ports.set(device, map);
    }
    return map;
  };

  const attachedPacket = (device: FakeDevice) =>
    encodeUsbmuxPacket(
      0,
      createDict([
        ["MessageType", "Attached"],
        ["DeviceID", device.deviceId],
        [
          "Properties",
          createDict([
            ["ConnectionType", device.connectionType],
            ["DeviceID", device.deviceId],
            ["SerialNumber", device.udid],
            ["ProductID", 4776],
          ]),
        ],
      ]),
    );

  const fake: FakeUsbmuxd = {
    devices,
    pairRecords: new Map(),
    buid: "11111111-2222-3333-4444-555555555555",
    refuseSavePairRecord: false,
    unavailable: false,
    attach: (device) => {
      devices.push(device);
      for (const listener of listeners) listener(attachedPacket(device));
    },
    detach: (udid) => {
      const index = devices.findIndex((device) => device.udid === udid);
      const [device] = index >= 0 ? devices.splice(index, 1) : [];
      if (!device) return;
      const packet = encodeUsbmuxPacket(
        0,
        createDict([
          ["MessageType", "Detached"],
          ["DeviceID", device.deviceId],
        ]),
      );
      for (const listener of listeners) listener(packet);
    },
    transport: {
      connectUsbmux: async () => {
        if (fake.unavailable) throw new Error("ENOENT: /var/run/usbmuxd");
        const pipe = createPipe();
        void serve(createLink(pipe.server), pipe.onTls);
        return pipe.client;
      },
    },
  };

  const serve = async (link: Link, onTls: (handler: (credentials: TlsCredentials) => void) => void): Promise<void> => {
    for (;;) {
      let packet: Awaited<ReturnType<typeof readUsbmuxPacket>>;
      try {
        packet = await readUsbmuxPacket(link, LIMITS);
      } catch {
        return;
      }
      const { tag, message } = packet;
      const reply = (fields: readonly (readonly [string, PlistValue])[]) =>
        link.write(encodeUsbmuxPacket(tag, createDict(fields)));
      const result = (number: number) =>
        reply([
          ["MessageType", "Result"],
          ["Number", number],
        ]);
      switch (message.MessageType) {
        case "ListDevices":
          await reply([
            [
              "DeviceList",
              devices.map((device) =>
                createDict([
                  ["DeviceID", device.deviceId],
                  ["MessageType", "Attached"],
                  [
                    "Properties",
                    createDict([
                      ["ConnectionType", device.connectionType],
                      ["DeviceID", device.deviceId],
                      ["SerialNumber", device.udid],
                    ]),
                  ],
                ]),
              ),
            ],
          ]);
          break;
        case "Listen":
          await result(UsbmuxResult.Ok);
          for (const device of devices) await link.write(attachedPacket(device));
          listeners.add((bytes) => void link.write(bytes));
          break;
        case "Connect": {
          const device = devices.find((candidate) => candidate.deviceId === message.DeviceID);
          const port = toNetworkPort(Number(message.PortNumber));
          if (!device) {
            await result(UsbmuxResult.BadDevice);
            break;
          }
          const service = port === LOCKDOWN_PORT ? "lockdown" : portsOf(device).get(port);
          if (!service) {
            await result(UsbmuxResult.ConnectionRefused);
            break;
          }
          await result(UsbmuxResult.Ok);
          // From here on the connection belongs to the device.
          onTls((credentials) => device.tlsUpgrades.push(credentials));
          if (service === "lockdown") await serveLockdown(link, device, portsOf(device));
          else await serveService(service, link, device);
          return;
        }
        case "ReadBUID":
          await reply([["BUID", fake.buid]]);
          break;
        case "ReadPairRecord": {
          const record = fake.pairRecords.get(String(message.PairRecordID));
          if (record) await reply([["PairRecordData", record]]);
          else await result(UsbmuxResult.BadDevice);
          break;
        }
        case "SavePairRecord":
          if (fake.refuseSavePairRecord || !(message.PairRecordData instanceof Uint8Array)) {
            await result(UsbmuxResult.BadCommand);
          } else {
            fake.pairRecords.set(String(message.PairRecordID), message.PairRecordData);
            await result(UsbmuxResult.Ok);
          }
          break;
        case "DeletePairRecord":
          fake.pairRecords.delete(String(message.PairRecordID));
          await result(UsbmuxResult.Ok);
          break;
        default:
          await result(UsbmuxResult.BadCommand);
      }
    }
  };

  return fake;
};

/** An in-memory SecretStore. */
export const memorySecrets = (): SecretStore & { readonly values: Map<string, Uint8Array> } => {
  const values = new Map<string, Uint8Array>();
  return {
    values,
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
  };
};
