import { getAllCards } from "@aethertarot/domain-tarot";
import { z } from "zod";
import type { ReadingToolDefinition } from "@/server/reading/tools/types";

const DEFAULT_CUSTOM_COUNT = 1;
const REVERSED_RATE = 0.2;

export const drawCardsInputSchema = z.object({
  spreadType: z.enum(["single", "three_card", "custom"]),
  count: z.number().int().positive().max(78).optional(),
  allowReversed: z.boolean().optional(),
  seed: z.string().trim().min(1).optional(),
});

export const drawCardsOutputSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      orientation: z.enum(["upright", "reversed"]),
      position: z.string().min(1).optional(),
    }),
  ),
  source: z.literal("server_side_tool"),
});

export type DrawCardsInput = z.infer<typeof drawCardsInputSchema>;

export type DrawCardsOutput = z.infer<typeof drawCardsOutputSchema>;

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed?: string) {
  if (!seed) {
    return Math.random;
  }

  let value = hashSeed(seed);

  return () => {
    value = Math.imul(value + 0x6d2b79f5, 1);
    let next = value;
    next ^= next >>> 15;
    next = Math.imul(next, next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getDrawCount(input: DrawCardsInput) {
  if (input.spreadType === "single") {
    return 1;
  }

  if (input.spreadType === "three_card") {
    return 3;
  }

  return input.count ?? DEFAULT_CUSTOM_COUNT;
}

function getPosition(spreadType: DrawCardsInput["spreadType"], index: number) {
  if (spreadType === "single") {
    return "focus";
  }

  if (spreadType === "three_card") {
    return ["past", "present", "future"][index];
  }

  return `position_${index + 1}`;
}

export const drawCardsServerSideTool: ReadingToolDefinition<
  DrawCardsInput,
  DrawCardsOutput
> = {
  name: "draw_cards_server_side",
  description:
    "Server-side tarot card draw tool for future agent-driven draw entry points. It reuses the runtime deck and does not replace the current frontend draw flow.",
  permission: "public",
  riskLevel: "low",
  inputSchema: drawCardsInputSchema,
  outputSchema: drawCardsOutputSchema,
  timeoutMs: 2_000,
  traceable: true,
  async run(input) {
    const deck = [...getAllCards()];
    const count = getDrawCount(input);
    const random = createRandom(input.seed);
    const allowReversed = input.allowReversed ?? true;
    const cards: DrawCardsOutput["cards"] = [];

    if (count > deck.length) {
      throw new Error("Requested draw count exceeds the available runtime deck.");
    }

    for (let index = 0; index < count; index += 1) {
      const selectedIndex = Math.floor(random() * deck.length);
      const [card] = deck.splice(selectedIndex, 1);

      cards.push({
        id: card.id,
        name: card.name,
        orientation:
          allowReversed && random() < REVERSED_RATE ? "reversed" : "upright",
        position: getPosition(input.spreadType, index),
      });
    }

    return {
      cards,
      source: "server_side_tool",
    };
  },
};
