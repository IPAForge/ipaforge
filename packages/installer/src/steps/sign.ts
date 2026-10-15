// Signs the app for the team and device. Only an app with a stated trust (a checksum-verified catalog release, or
// the user's approval) gets SideStore's certificate additions; the signed IPA waits in the scratch store.
import { loadTeamCertificate } from "@installer/application/certificate.ts";
import type { FlowRuntime } from "@installer/application/runtime.ts";
import { StepLabel } from "@installer/domain/labels.ts";
import type { AppJob, InstallState } from "@installer/domain/state.ts";
import { StepWeight } from "@installer/domain/step-weights.ts";
import type { Step } from "@installer/pipeline/step.ts";
import { sideStoreCertificateAdditions } from "@installer/sidestore/certificate.ts";
import { appStepId, jobAt, required, updateJob } from "@installer/steps/app-job.ts";
import type { CertificateIdentity } from "@loadstar/apple";
import { compact } from "@loadstar/kernel";
import type { BundleAdditions } from "@loadstar/signer";

const SIGNED_PREFIX = "signed";

const certificateAdditions = (
  job: AppJob,
  identity: CertificateIdentity,
  der: Uint8Array,
): BundleAdditions | undefined =>
  job.trust &&
  sideStoreCertificateAdditions(
    {
      certificate: der,
      privateKey: identity.privateKey,
      serialNumber: identity.certificate.serialNumber,
      machineId: identity.certificate.machineId,
    },
    job.trust,
  );

export const signStep = (runtime: FlowRuntime, index: number): Step<InstallState> => ({
  id: appStepId("sign", index),
  labelKey: StepLabel.sign,
  weight: StepWeight.sign,
  run: async (state, context) => {
    const { signer, scratch } = runtime.deps;
    const job = jobAt(state, index);
    const team = required(state.team, "team");
    const identity = required(job.identity, "identity plan");
    const owner = { accountId: state.accountId, team };
    const certificate = await loadTeamCertificate(
      runtime.deps,
      owner,
      required(state.certificateSerial, "certificate"),
    );
    const der = required(certificate.certificate.content, "certificate content");
    const stream = await signer.sign(
      required(job.file, "IPA file"),
      compact({
        teamId: team.id,
        certificate: der,
        privateKey: certificate.privateKey,
        newMainBundleId: identity.newMainBundleId,
        profiles: required(job.profiles, "profiles"),
        appGroups: identity.appGroups,
        deviceUdid: state.udid,
        additions: certificateAdditions(job, certificate, der),
        onProgress: (fraction: number) => context.progress(fraction),
        signal: context.signal,
      }),
    );
    const key = `${SIGNED_PREFIX}/${globalThis.crypto.randomUUID()}.ipa`;
    return updateJob(state, index, { signed: { key, file: await scratch.put(key, stream) } });
  },
});
