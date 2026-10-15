import type { DeviceContext } from "@device/application/context.ts";
import { openAppContainer, withClient } from "@device/application/services.ts";
import type { DeviceSession } from "@device/application/session.ts";
import { shortUdid } from "@device/domain/device.ts";
import { pairingFile } from "@device/domain/pairing/pair-record.ts";
import type { ContainerMode } from "@device/infrastructure/house-arrest/client.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export interface AppFileTarget {
  readonly bundleId: string;
  /** Path inside the container, e.g. `Documents/pairingFile.plist`. */
  readonly path: string;
  /** Default `documents` (works for App Store and sideloaded apps that share Documents). */
  readonly mode?: ContainerMode;
}

export interface AppFileStatus {
  readonly target: AppFileTarget;
  readonly exists: boolean;
  readonly size?: number;
  /** Last modification, when the device reports it. */
  readonly modifiedAt?: Date;
}

const RETRY_DELAY_MS = 500;

const parentOf = (path: string): string | undefined => {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : undefined;
};

/** AFC over house_arrest drops occasionally (device locked, afcd hiccups): retry once after a short pause. */
const isTransient = (error: unknown): boolean =>
  error instanceof LoadstarError && (error.code === ErrorCode.DeviceDisconnected || error.code === ErrorCode.AfcError);

const withRetry = async <T>(ctx: DeviceContext, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (!isTransient(error)) throw error;
    ctx.deps.logger.warn("app container access failed; retrying once", { cause: error });
    await ctx.deps.sleep(RETRY_DELAY_MS);
    return run();
  }
};

const modeOf = (target: AppFileTarget): ContainerMode => target.mode ?? "documents";

/** Writes `data` into an app's container (creating parent folders) and checks the size that landed. */
export const writeAppFile = (
  ctx: DeviceContext,
  session: DeviceSession,
  target: AppFileTarget,
  data: Uint8Array,
): Promise<void> =>
  withRetry(ctx, async () =>
    withClient(await openAppContainer(ctx, session, target.bundleId, modeOf(target)), async (afc) => {
      const parent = parentOf(target.path);
      if (parent && !(await afc.exists(parent))) await afc.mkdir(parent);
      await afc.writeFile(target.path, data);
      const written = await afc.stat(target.path);
      if (written.size !== data.byteLength) {
        throw new LoadstarError(ErrorCode.AfcError, {
          message: `wrote ${data.byteLength} bytes but the device has ${written.size}`,
          data: { bundleId: target.bundleId, path: target.path },
        });
      }
      ctx.deps.logger.info("wrote app file", {
        device: shortUdid(session.device.udid),
        bundleId: target.bundleId,
        path: target.path,
        bytes: data.byteLength,
      });
    }),
  );

export const readAppFile = async (
  ctx: DeviceContext,
  session: DeviceSession,
  target: AppFileTarget,
): Promise<Uint8Array> =>
  withRetry(ctx, async () =>
    withClient(await openAppContainer(ctx, session, target.bundleId, modeOf(target)), (afc) =>
      afc.readFile(target.path),
    ),
  );

/** Whether each target file exists, with size and modification time. */
export const appFileStatus = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[],
): Promise<AppFileStatus[]> => {
  const statuses: AppFileStatus[] = [];
  for (const target of targets) {
    const status = await withRetry(ctx, async () =>
      withClient(await openAppContainer(ctx, session, target.bundleId, modeOf(target)), async (afc) => {
        if (!(await afc.exists(target.path))) return { target, exists: false };
        const stat = await afc.stat(target.path);
        const mtimeNs = stat.raw.st_mtime ? Number(stat.raw.st_mtime) : Number.NaN;
        return {
          target,
          exists: true,
          size: stat.size,
          ...(Number.isFinite(mtimeNs) ? { modifiedAt: new Date(mtimeNs / 1e6) } : {}),
        };
      }),
    );
    statuses.push(status);
  }
  return statuses;
};

export interface PlacePairingOptions {
  /**
   * Turn on Wi-Fi debugging first (default true). On-device tools (SideStore, StikDebug) reach lockdownd over
   * Wi-Fi/VPN with this file, which only works once it is enabled; it fails without a passcode.
   */
  readonly enableWifiDebugging?: boolean;
}

/** Places this host's pairing file (pair record + UDID) at each target, verifying every write. */
export const placePairingFile = async (
  ctx: DeviceContext,
  session: DeviceSession,
  targets: readonly AppFileTarget[],
  options: PlacePairingOptions = {},
): Promise<void> => {
  if (options.enableWifiDebugging ?? true) await session.enableWifiDebugging();
  const data = pairingFile(session.pairRecord, session.device.udid);
  for (const target of targets) await writeAppFile(ctx, session, target, data);
};
