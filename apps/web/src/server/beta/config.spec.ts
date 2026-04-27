import { describe, expect, it } from "vitest";
import { getBetaOpsConfig } from "@/server/beta/config";

describe("beta ops config", () => {
  it("uses conservative defaults for llm beta limits", () => {
    expect(getBetaOpsConfig({ AETHERTAROT_READING_PROVIDER: "llm" })).toEqual({
      emailDailyLimit: 5,
      ipMinuteLimit: 3,
      ipDailyLimit: 20,
      dailyLlmCostLimitUsd: 1,
      llmCostReservationUsd: 0.05,
    });
  });

  it("does not reserve llm budget for placeholder provider", () => {
    expect(getBetaOpsConfig({ AETHERTAROT_READING_PROVIDER: "placeholder" }))
      .toMatchObject({
        llmCostReservationUsd: 0,
      });
  });
});
