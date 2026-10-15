import { FREE_TEAM, OTHER_TEAM } from "@installer/__tests__/fakes.ts";
import { preselectTeam, requireTeam } from "@installer/domain/team.ts";
import { ErrorCode } from "@loadstar/kernel";
import { describe, expect, it } from "vitest";

const teams = [FREE_TEAM, OTHER_TEAM];

describe("team choice", () => {
  it("prefers the requested team, then the remembered one, then the only one", () => {
    expect(preselectTeam(teams, { requested: OTHER_TEAM.id, remembered: FREE_TEAM.id })).toBe(OTHER_TEAM);
    expect(preselectTeam(teams, { remembered: FREE_TEAM.id })).toBe(FREE_TEAM);
    expect(preselectTeam([OTHER_TEAM], {})).toBe(OTHER_TEAM);
    expect(preselectTeam(teams, {})).toBeUndefined();
  });

  it("fails clearly when there is nothing to choose from or the choice is open", () => {
    expect(() => preselectTeam([], {})).toThrow(expect.objectContaining({ code: ErrorCode.NoTeams }));
    expect(() => preselectTeam(teams, { requested: "NOPE" })).toThrow(
      expect.objectContaining({ code: ErrorCode.TeamRequired }),
    );
    expect(() => requireTeam(teams, {})).toThrow(expect.objectContaining({ code: ErrorCode.TeamRequired }));
  });
});
