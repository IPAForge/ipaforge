// `install-probe plan <ipa|catalogAppId>`: read-only. Prints what installing would do; writes nothing to Apple or
// the device (a catalog app is downloaded into the probe's download cache to be inspected).
import { existsSync } from "node:fs";
import { nodeFileSource } from "@desktop/main/adapters/file-source.ts";
import type { InstallProbe } from "@desktop/probes/install/context.ts";
import type { AppSource, InstallPlan } from "@loadstar/installer";
import { compact } from "@loadstar/kernel";

const day = (date: Date | undefined): string => (date ? date.toISOString().slice(0, 10) : "?");

const sourceOf = async (target: string): Promise<AppSource> =>
  existsSync(target) ? { kind: "file", file: await nodeFileSource(target) } : { kind: "catalog", appId: target };

const printInspection = ({ inspection, identity }: InstallPlan): void => {
  const { app } = inspection;
  console.log(
    `\nApp: ${app.name} ${app.version ?? ""} (${app.identifier}), minimum iOS ${app.minimumOSVersion ?? "?"}`,
  );
  for (const bundle of inspection.nested) console.log(`  ${bundle.kind}: ${bundle.name} (${bundle.identifier})`);
  console.log(
    `New identity: ${identity.newMainBundleId}${identity.appGroup ? `, app group ${identity.appGroup}` : ""}`,
  );
  for (const bundle of identity.bundles) console.log(`  App ID ${bundle.identifier} ("${bundle.name}")`);
};

const printBudget = ({ appIds }: InstallPlan): void => {
  const verdict = appIds.enough ? "fits" : `does NOT fit; next free slot ${day(appIds.nextSlotAt)}`;
  console.log(
    `App IDs: ${appIds.create.length} to create, ${appIds.reuse.length} reused, ${appIds.available} available — ${verdict}`,
  );
};

const printFreeSlots = ({ freeSlots }: InstallPlan): void => {
  if (!freeSlots) {
    console.log("Free-app limit: not a free team");
    return;
  }
  const { occupied, limit } = freeSlots;
  const verdict = occupied.length >= limit ? "an app must be removed first" : "room left";
  console.log(`Free-app slots: ${occupied.length} of ${limit} used — ${verdict}`);
  for (const app of occupied) console.log(`  ${app.name ?? "?"} (${app.bundleId})`);
};

const printCertificate = ({ certificate, sharesCertificate }: InstallPlan): void => {
  const status = certificate.reusable
    ? "stored one is reused"
    : certificate.stored
      ? "stored one is gone"
      : "none stored";
  console.log(`Certificate: ${status}; ${certificate.onTeam} on the team`);
  console.log(`Certificate shared into the app: ${sharesCertificate ? "yes (SideStore inside)" : "no"}`);
};

export const planCommand = (probe: InstallProbe) => async (): Promise<void> => {
  const [target] = probe.args.rest;
  if (!target) throw new Error("usage: plan <file.ipa | catalog app id>");
  console.log("Read-only: nothing is created or changed on Apple's side or on the device.");
  const udid = await probe.pickUdid();
  const accountId = await probe.pickAccount();
  const source = await sourceOf(target);
  const plan = await probe.engine.planInstall(compact({ udid, accountId, source, teamId: probe.args.option("team") }));
  console.log(`Device ${probe.show(udid)}, team ${plan.team.name}${plan.team.isFree ? " (free)" : ""}`);
  printInspection(plan);
  printBudget(plan);
  printFreeSlots(plan);
  printCertificate(plan);
};
