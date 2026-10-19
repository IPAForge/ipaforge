import type { DeviceContext } from '@device/application/context.ts'
import { openAfc, useInstallationProxy } from '@device/application/services.ts'
import type {
  DeviceSession,
  InstallIpaOptions,
  Report
} from '@device/application/types.ts'
import { PUBLIC_STAGING_DIR } from '@device/domain/constants.ts'
import { shortUdid } from '@device/domain/device.ts'
import type { AfcClient } from '@device/infrastructure/afc/types.ts'
import { withClient } from '@device/infrastructure/closeable.ts'
import { compact, type FileSource } from '@ipaforge/kernel'

/** Share of the overall progress taken by the upload; installation_proxy's own 0–100 fills the second half. */
const UPLOAD_SHARE = 50
const PERCENT_DONE = 100

const uploadPercent = (written: number, total: number | undefined): number =>
  total ? Math.floor((written / total) * UPLOAD_SHARE) : 0

const installPercent = (percent: number): number =>
  UPLOAD_SHARE + Math.floor(percent / 2)

const uploadIpa = async (
  afc: AfcClient,
  stagingPath: string,
  ipa: FileSource,
  report: Report,
  signal: AbortSignal | undefined
): Promise<void> => {
  if (!(await afc.exists(PUBLIC_STAGING_DIR)))
    await afc.mkdir(PUBLIC_STAGING_DIR)
  await afc.writeFile(
    stagingPath,
    ipa.stream(),
    compact({
      totalBytes: ipa.size,
      onProgress: (written: number, total: number | undefined) =>
        report(
          compact({
            stage: 'uploading' as const,
            percent: uploadPercent(written, total),
            stagePercent: total
              ? Math.floor((written / total) * PERCENT_DONE)
              : 0,
            sent: written,
            total
          })
        ),
      signal
    })
  )
  signal?.throwIfAborted()
}

const installStaged = (
  ctx: DeviceContext,
  session: DeviceSession,
  stagingPath: string,
  options: InstallIpaOptions,
  report: Report
): Promise<void> =>
  useInstallationProxy(ctx, session, (proxy) =>
    proxy.install(stagingPath, {
      upgrade: options.upgrade ?? true,
      onProgress: ({ percent, status }) =>
        report({
          stage: 'installing',
          percent: installPercent(percent),
          stagePercent: percent,
          status
        })
    })
  )

/** Uploads a signed IPA to `PublicStaging` and installs it. The staged copy is always removed. */
export const installIpa = async (
  ctx: DeviceContext,
  session: DeviceSession,
  ipa: FileSource,
  options: InstallIpaOptions = {}
): Promise<void> => {
  const { logger, clock } = ctx.deps
  const started = clock.now().getTime()
  const stagingPath = `${PUBLIC_STAGING_DIR}/${globalThis.crypto.randomUUID()}.ipa`
  const report = options.onProgress ?? (() => {})

  await withClient(await openAfc(ctx, session), async (afc) => {
    try {
      await uploadIpa(afc, stagingPath, ipa, report, options.signal)
      await installStaged(ctx, session, stagingPath, options, report)
    } finally {
      await afc
        .remove(stagingPath)
        .catch((error: unknown) =>
          logger.debug('staging cleanup failed', { cause: error })
        )
    }
  })

  report({ stage: 'done', percent: PERCENT_DONE, stagePercent: PERCENT_DONE })
  logger.info('installed', {
    device: shortUdid(session.device.udid),
    file: ipa.name,
    bytes: ipa.size,
    ms: clock.now().getTime() - started
  })
}
