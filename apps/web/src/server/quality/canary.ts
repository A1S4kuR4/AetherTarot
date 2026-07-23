import type { StructuredReading } from "@aethertarot/shared-types";
import type { LlmTokenGate } from "@/server/beta/token-budget";

export const CANARY_TOKEN_BUDGET = 12_000;
export const CANARY_CALL_LIMIT = 5;

export function createCanaryTokenGate(options?: {
  tokenBudget?: number;
  callLimit?: number;
}) {
  const tokenBudget = options?.tokenBudget ?? CANARY_TOKEN_BUDGET;
  const callLimit = options?.callLimit ?? CANARY_CALL_LIMIT;
  let settledTokens = 0;
  let reservations = 0;
  const settledReservationIds = new Set<string>();
  const gate: LlmTokenGate = {
    async reserve({ promptText, maxOutputTokens }) {
      reservations += 1;
      if (reservations > callLimit) {
        throw new Error(`Canary exceeded the fixed ${callLimit}-call limit.`);
      }
      const conservativeEstimate =
        Math.ceil(promptText.length / 4) + Math.min(maxOutputTokens, 1_200);
      if (settledTokens + conservativeEstimate > tokenBudget) {
        throw new Error(`Canary token budget would exceed ${tokenBudget} tokens.`);
      }
      return {
        id: `canary-${reservations}`,
        reservedTokens: conservativeEstimate,
      };
    },
    async settle({ reservation, actualTokens }) {
      if (settledReservationIds.has(reservation.id)) {
        throw new Error("Canary reservation was settled more than once.");
      }
      settledReservationIds.add(reservation.id);
      settledTokens += actualTokens ?? reservation.reservedTokens;
      if (settledTokens > tokenBudget) {
        throw new Error(`Canary actual usage exceeded ${tokenBudget} tokens.`);
      }
    },
  };
  return {
    gate,
    snapshot: () => ({
      settled_tokens: settledTokens,
      reservations,
      settled_reservations: settledReservationIds.size,
    }),
  };
}

export function assertFormalCanaryReading(reading: StructuredReading) {
  if (!reading.grounding) {
    throw new Error("Canary reading is missing grounding.");
  }
  const cardClaims = reading.grounding.claims.filter((claim) =>
    claim.path.startsWith("cards.")
  );
  if (
    cardClaims.length !== reading.cards.length
    || cardClaims.some((claim) => claim.source_refs.length === 0)
  ) {
    throw new Error("Canary reading does not cover every card with grounding.");
  }
  const refs = new Set(reading.grounding.sources.map((source) => source.ref));
  if (reading.grounding.claims.some((claim) =>
    claim.source_refs.some((ref) => !refs.has(ref))
  )) {
    throw new Error("Canary reading contains an invalid citation ref.");
  }
}

export function isCanaryReport(value: unknown): value is {
  version: 1;
  cases: unknown[];
  failures: string[];
  budget: {
    maximum_tokens: number;
    settled_tokens: number;
    reservations: number;
  };
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const report = value as Record<string, unknown>;
  const budget = report.budget as Record<string, unknown> | undefined;
  return report.version === 1
    && Array.isArray(report.cases)
    && Array.isArray(report.failures)
    && Boolean(budget)
    && typeof budget?.maximum_tokens === "number"
    && typeof budget?.settled_tokens === "number"
    && typeof budget?.reservations === "number";
}
