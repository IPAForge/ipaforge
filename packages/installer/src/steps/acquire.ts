// Getting a catalog app's IPA: resolve the release (the requested channel, else the one recommended for this
// iOS version), then download it. The download is checksum-verified, which is what makes it trusted.
import type { FlowRuntime } from '@installer/application/runtime.ts'
import { StepLabel } from '@installer/domain/labels.ts'
import { StepWeight } from '@installer/domain/step-weights.ts'
import type { AppSource, InstallState } from '@installer/domain/types.ts'
import type { Step } from '@installer/pipeline/types.ts'
import {
  appStepId,
  jobAt,
  required,
  updateJob
} from '@installer/steps/app-job.ts'
import { compact, ErrorCode, IPAForgeError } from '@ipaforge/kernel'

type CatalogSource = Extract<AppSource, { kind: 'catalog' }>

const catalogSource = (state: InstallState, index: number): CatalogSource => {
  const { source } = jobAt(state, index)
  if (source.kind === 'catalog') return source
  throw new IPAForgeError(ErrorCode.Unexpected, {
    message: 'only catalog apps are downloaded'
  })
}

export const resolveReleaseStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('resolve', index),
  labelKey: StepLabel.resolve,
  weight: StepWeight.check,
  idempotent: true,
  run: async (state, context) => {
    const { catalog } = runtime.deps
    const source = catalogSource(state, index)
    const channel =
      source.channel ??
      (await catalog.recommendedChannel(source.appId, state.device?.iosVersion))
    const release = await catalog.resolve(
      source.appId,
      channel,
      context.signal,
      source.version
    )
    context.detail({
      kind: 'release',
      version: release.version,
      channel: release.channel
    })

    return updateJob(state, index, { release })
  }
})

export const downloadStep = (
  runtime: FlowRuntime,
  index: number
): Step<InstallState> => ({
  id: appStepId('download', index),
  labelKey: StepLabel.download,
  weight: StepWeight.download,
  idempotent: true,
  run: async (state, context) => {
    const release = required(jobAt(state, index).release, 'release')
    const started = runtime.deps.clock.now().getTime()
    const { file, sha256, cached } = await runtime.deps.catalog.download(
      release,
      {
        onProgress: ({ received, total }) =>
          context.progress(
            total ? received / total : 0,
            compact({
              received,
              total,
              elapsedMs: runtime.deps.clock.now().getTime() - started
            })
          ),
        signal: context.signal
      }
    )
    context.detail({ kind: 'download', bytes: file.size, cached })

    return updateJob(state, index, {
      file,
      trust: { kind: 'catalog', appId: release.appId, sha256 }
    })
  }
})
