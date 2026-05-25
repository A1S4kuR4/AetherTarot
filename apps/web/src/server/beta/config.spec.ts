import { describe, expect, it } from "vitest";
import {
  getBetaOpsConfig,
  getEncyclopediaQuotaConfig,
  getLlmTokenBudgetConfig,
  isEncyclopediaQueryEnabled,
} from "@/server/beta/config";

describe("beta ops config", () => {
  it("uses production beta defaults for reading limits", () => {
    expect(getBetaOpsConfig({})).toEqual({
      userDailyLimit: 10,
      ipMinuteLimit: 6,
    });
  });

  it("uses separate encyclopedia limits with the shared burst guard", () => {
    expect(getEncyclopediaQuotaConfig({})).toEqual({
      userDailyLimit: 20,
      ipMinuteLimit: 6,
    });
  });

  it("defaults the shared daily token budget to 200000", () => {
    expect(getLlmTokenBudgetConfig({})).toEqual({
      dailyTokenLimit: 200_000,
    });
  });

  it("keeps encyclopedia model queries disabled until explicitly enabled", () => {
    expect(isEncyclopediaQueryEnabled({})).toBe(false);
    expect(
      isEncyclopediaQueryEnabled({
        AETHERTAROT_ENCYCLOPEDIA_PROVIDER: "llm",
      }),
    ).toBe(true);
  });
});
