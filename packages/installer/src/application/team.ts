// Choosing the developer team: preselected when the choice is clear, otherwise the user picks one.
import { ask } from "@installer/application/ask.ts";
import type { InstallerDeps } from "@installer/deps.ts";
import { PromptKind } from "@installer/domain/prompts.ts";
import { preselectTeam, requireTeam } from "@installer/domain/team.ts";
import type { StepContext } from "@installer/pipeline/step.ts";
import type { DeveloperServices, Team } from "@loadstar/apple";

/** The team remembered for the saved account (the last one it installed with). */
export const rememberedTeamId = async (deps: InstallerDeps, accountId: string): Promise<string | undefined> =>
  (await deps.apple.accounts.list()).find((account) => account.id === accountId)?.teamId;

export interface TeamChoice {
  readonly accountId: string;
  readonly requested?: string | undefined;
}

export const chooseTeam = async (
  deps: InstallerDeps,
  developer: DeveloperServices,
  context: StepContext,
  choice: TeamChoice,
): Promise<Team> => {
  const teams = await developer.teams();
  const remembered = await rememberedTeamId(deps, choice.accountId);
  const preselected = preselectTeam(teams, { requested: choice.requested, remembered });
  if (preselected) return preselected;
  return requireTeam(teams, { requested: await ask(context, PromptKind.ChooseTeam, { teams }) });
};

/** The team a query works with; queries never ask, so an open choice is `installer.team_required`. */
export const queryTeam = async (deps: InstallerDeps, developer: DeveloperServices, choice: TeamChoice) =>
  requireTeam(await developer.teams(), {
    requested: choice.requested,
    remembered: await rememberedTeamId(deps, choice.accountId),
  });
