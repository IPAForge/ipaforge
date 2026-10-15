import type { DeviceContext } from "@device/application/context.ts";
import { openAfc, openInstallationProxy, withClient } from "@device/application/services.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { PUBLIC_STAGING_DIR } from "@device/domain/constants.ts";
import { shortUdid } from "@device/domain/device.ts";
import type { FileSource } from "@loadstar/kernel";

export type InstallStage = "uploading" | "installing" | "done";

export interface InstallIpaProgress {
  readonly stage: InstallStage;
  /** 0–100 across the whole install (upload is the first half). */
  readonly percent: number;
  readonly status?: string;
}

export interface InstallIpaOptions {
  /** Replace an existing app with the same bundle ID, keeping its data. Default true. */
  readonly upgrade?: boolean;
  readonly onProgress?: (progress: InstallIpaProgress) => void;
  readonly signal?: AbortSignal;
}

const UPLOAD_SHARE = 50;

/** Uploads a signed IPA to `PublicStaging` and installs it. The staged copy is always removed. */
export const installIpa = async (
  ctx: DeviceContext,
  session: DeviceSession,
  ipa: FileSource,
  options: InstallIpaOptions = {},
): Promise<void> => {
  const { logger, clock } = ctx.deps;
  const started = clock.now().getTime();
  const stagingPath = `${PUBLIC_STAGING_DIR}/${globalThis.crypto.randomUUID()}.ipa`;
  const report = options.onProgress ?? (() => {});

  await withClient(await openAfc(ctx, session), async (afc) => {
    try {
      if (!(await afc.exists(PUBLIC_STAGING_DIR))) await afc.mkdir(PUBLIC_STAGING_DIR);
      await afc.writeFile(stagingPath, ipa.stream(), {
        totalBytes: ipa.size,
        onProgress: (written, total) =>
          report({ stage: "uploading", percent: total ? Math.floor((written / total) * UPLOAD_SHARE) : 0 }),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      options.signal?.throwIfAborted();

      await withClient(await openInstallationProxy(ctx, session), (proxy) =>
        proxy.install(stagingPath, {
          upgrade: options.upgrade ?? true,
          onProgress: ({ percent, status }) =>
            report({ stage: "installing", percent: UPLOAD_SHARE + Math.floor(percent / 2), status }),
        }),
      );
    } finally {
      await afc.remove(stagingPath).catch((error: unknown) => logger.debug("staging cleanup failed", { cause: error }));
    }
  });

  report({ stage: "done", percent: 100 });
  logger.info("installed", {
    device: shortUdid(session.device.udid),
    file: ipa.name,
    bytes: ipa.size,
    ms: clock.now().getTime() - started,
  });
};
