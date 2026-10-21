import { modelName } from '@ui/features/devices/utils/model-name.ts'
import { connectionKeys } from '@ui/features/install/run/constants.ts'
import type { StepReportTexts } from '@ui/features/install/run/types.ts'

/**
 * What each kind of step report says, in words: the model and iOS checked, the release found, the session used,
 * the team, the certificate, the App IDs, and so on. A report kind without words here fails typecheck.
 */
export const stepReportTexts: StepReportTexts = {
  device: (report, { t }) =>
    t('install.run.report.device', {
      model: modelName(report.productType),
      ios: report.iosVersion,
      connection: t(connectionKeys[report.connection])
    }),
  release: (report, { t, appName }) =>
    t('install.run.report.release', {
      app: appName,
      version: report.version,
      channel: t(`install.channel.${report.channel}`)
    }),
  download: (report, { t, fileSize }) =>
    t(
      report.cached
        ? 'install.run.report.downloadCached'
        : 'install.run.report.download',
      { size: fileSize(report.bytes) }
    ),
  app: (report, { t }) =>
    t('install.run.report.app', {
      app: report.version ? `${report.name} ${report.version}` : report.name,
      extensions: report.extensions
    }),
  session: (report, { t }) => t(`install.run.report.session.${report.how}`),
  team: (report, { t }) =>
    report.isFree ? t('accounts.freeTeam', { name: report.name }) : report.name,
  saved: (report, { t }) =>
    t('install.run.report.saved', { path: report.path }),
  'device-registration': (report, { t }) =>
    t(
      report.isNew
        ? 'install.run.report.registered'
        : 'install.run.report.alreadyRegistered'
    ),
  certificate: (report, { t }) =>
    t(`install.run.report.certificate.${report.how}`),
  'app-ids': (report, { t }) =>
    t('install.plan.appIdsValue', {
      created: report.created,
      reused: report.reused,
      left: report.left
    }),
  'free-apps': (report, { t }) => {
    const used = t('install.plan.freeAppsValue', {
      used: report.used,
      limit: report.limit
    })

    return report.removed
      ? t('install.run.report.removed', { app: report.removed, used })
      : used
  },
  profiles: (report, { t }) =>
    t('install.run.report.profiles', { count: report.count }),
  signed: (report, { t }) =>
    t(
      report.compressed
        ? 'install.run.report.signedCompressed'
        : 'install.run.report.signed',
      { count: report.bundles }
    ),
  'install-phase': (report, { t }) =>
    t(`install.run.report.phase.${report.phase}`),
  pairing: (report, { t, list }) =>
    t(
      report.remote
        ? 'install.run.report.pairingRemote'
        : 'install.run.report.pairing',
      { apps: list(report.apps) }
    ),
  'certificate-shared': (report, { t }) =>
    t(
      report.isShared
        ? 'install.run.report.shared'
        : 'install.run.report.notShared'
    )
}
