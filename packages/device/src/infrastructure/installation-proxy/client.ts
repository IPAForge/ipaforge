import { classifyInstallError } from "@device/domain/install-errors.ts";
import type { Link } from "@device/infrastructure/framing/link.ts";
import { type FrameLimits, receivePlist, sendPlist } from "@device/infrastructure/framing/plist-frames.ts";
import { createDict, isPlistDict, LoadstarError, type Logger, type PlistDict, type PlistValue } from "@loadstar/kernel";

export type ApplicationType = "User" | "System" | "Any";

export interface InstallProgress {
  readonly percent: number;
  readonly status: string;
}

export interface InstalledApp {
  readonly bundleId: string;
  readonly name?: string;
  readonly version?: string;
  readonly shortVersion?: string;
  readonly signerIdentity?: string;
  /** Every attribute the device returned. */
  readonly raw: PlistDict;
}

export interface InstallationProxy {
  install(
    packagePath: string,
    options?: { upgrade?: boolean; onProgress?: (p: InstallProgress) => void },
  ): Promise<void>;
  uninstall(bundleId: string, options?: { onProgress?: (p: InstallProgress) => void }): Promise<void>;
  browse(options?: { applicationType?: ApplicationType; attributes?: readonly string[] }): Promise<InstalledApp[]>;
  lookup(bundleIds: readonly string[], attributes?: readonly string[]): Promise<Map<string, InstalledApp>>;
  close(): Promise<void>;
}

export const DEFAULT_APP_ATTRIBUTES = [
  "CFBundleIdentifier",
  "CFBundleDisplayName",
  "CFBundleName",
  "CFBundleVersion",
  "CFBundleShortVersionString",
  "SignerIdentity",
  "ApplicationType",
] as const;

const str = (dict: PlistDict, key: string): string | undefined => {
  const value = dict[key];
  return typeof value === "string" ? value : undefined;
};

export const toInstalledApp = (raw: PlistDict): InstalledApp | undefined => {
  const bundleId = str(raw, "CFBundleIdentifier");
  if (!bundleId) return undefined;
  const name = str(raw, "CFBundleDisplayName") ?? str(raw, "CFBundleName");
  const version = str(raw, "CFBundleVersion");
  const shortVersion = str(raw, "CFBundleShortVersionString");
  const signerIdentity = str(raw, "SignerIdentity");
  return {
    bundleId,
    raw,
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    ...(shortVersion ? { shortVersion } : {}),
    ...(signerIdentity ? { signerIdentity } : {}),
  };
};

const percentOf = (value: PlistValue | undefined): number =>
  typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : 0;

const failure = (response: PlistDict, command: string, subject: string): LoadstarError => {
  const error = String(response.Error);
  const description = str(response, "ErrorDescription");
  const classified = classifyInstallError(error, description);
  return new LoadstarError(classified.code, {
    message: `installation_proxy ${command} failed for ${subject}: ${error}${description ? ` (${description})` : ""}`,
    data: {
      installError: error,
      command,
      subject,
      ...(description ? { description } : {}),
      ...(response.ErrorDetail === undefined ? {} : { detail: String(response.ErrorDetail) }),
      ...(classified.installdCode ? { installdCode: classified.installdCode } : {}),
      ...(classified.freeProfileApps ? { freeProfileApps: classified.freeProfileApps } : {}),
    },
  });
};

export const createInstallationProxy = (
  link: Link,
  options: { limits: FrameLimits; logger: Logger },
): InstallationProxy => {
  const { limits, logger } = options;

  /** Sends a command and reads status messages until `Complete`. */
  const run = async (
    command: string,
    subject: string,
    fields: readonly (readonly [string, PlistValue])[],
    onMessage: (message: PlistDict) => void = () => {},
  ): Promise<void> => {
    await sendPlist(link, createDict([["Command", command], ...fields]));
    for (;;) {
      const response = await receivePlist(link, limits, "installation_proxy");
      if (response.Error !== undefined) throw failure(response, command, subject);
      onMessage(response);
      if (response.Status === "Complete") return;
    }
  };

  const progress =
    (onProgress: ((p: InstallProgress) => void) | undefined) =>
    (message: PlistDict): void => {
      const status = str(message, "Status");
      if (!status) return;
      logger.debug("installation_proxy status", { status, percent: message.PercentComplete });
      onProgress?.({ status, percent: status === "Complete" ? 100 : percentOf(message.PercentComplete) });
    };

  const attributesDict = (applicationType: ApplicationType | undefined, attributes: readonly string[]) =>
    createDict([
      ...(applicationType ? [["ApplicationType", applicationType] as const] : []),
      ["ReturnAttributes", [...attributes]],
    ]);

  return {
    install: (packagePath, installOptions = {}) =>
      run(
        installOptions.upgrade ? "Upgrade" : "Install",
        packagePath,
        [
          ["PackagePath", packagePath],
          ["ClientOptions", createDict()],
        ],
        progress(installOptions.onProgress),
      ),

    uninstall: (bundleId, uninstallOptions = {}) =>
      run(
        "Uninstall",
        bundleId,
        [
          ["ApplicationIdentifier", bundleId],
          ["ClientOptions", createDict()],
        ],
        progress(uninstallOptions.onProgress),
      ),

    browse: async (browseOptions = {}) => {
      const apps: InstalledApp[] = [];
      await run(
        "Browse",
        "apps",
        [
          [
            "ClientOptions",
            attributesDict(browseOptions.applicationType ?? "User", browseOptions.attributes ?? DEFAULT_APP_ATTRIBUTES),
          ],
        ],
        (message) => {
          const list = message.CurrentList;
          if (!Array.isArray(list)) return;
          for (const entry of list) {
            const app = isPlistDict(entry) ? toInstalledApp(entry) : undefined;
            if (app) apps.push(app);
          }
        },
      );
      return apps;
    },

    lookup: async (bundleIds, attributes = DEFAULT_APP_ATTRIBUTES) => {
      const found = new Map<string, InstalledApp>();
      await run(
        "Lookup",
        bundleIds.join(","),
        [
          [
            "ClientOptions",
            createDict([
              ["BundleIDs", [...bundleIds]],
              ["ReturnAttributes", [...attributes]],
            ]),
          ],
        ],
        (message) => {
          const result = message.LookupResult;
          if (!isPlistDict(result)) return;
          for (const value of Object.values(result)) {
            const app = isPlistDict(value) ? toInstalledApp(value) : undefined;
            if (app) found.set(app.bundleId, app);
          }
        },
      );
      return found;
    },

    close: () => link.close(),
  };
};
