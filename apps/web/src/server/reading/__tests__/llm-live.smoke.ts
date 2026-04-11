import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { generateStructuredReading } from "@/server/reading/service";

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `缺少 ${name}。请在 apps/web/.env.local 中配置 llm baseline 所需环境变量后再运行 npm run test:llm -w @aethertarot/web。`,
    );
  }

  return value;
}

beforeAll(() => {
  loadDotEnvFile(path.resolve(process.cwd(), ".env.local"));

  if ((process.env.AETHERTAROT_READING_PROVIDER ?? "").trim() !== "llm") {
    throw new Error(
      "llm live smoke 需要设置 AETHERTAROT_READING_PROVIDER=llm。",
    );
  }

  requireEnv("AETHERTAROT_LLM_BASE_URL");
  requireEnv("AETHERTAROT_LLM_MODEL");
});

describe("llm live smoke", () => {
  it(
    "can generate a standard initial reading through the configured llm provider",
    async () => {
      const reading = await generateStructuredReading({
        question: "我该如何看待当前的职业选择？",
        spreadId: "holy-triangle",
        drawnCards: [
          {
            positionId: "past",
            cardId: "high-priestess",
            isReversed: false,
          },
          {
            positionId: "present",
            cardId: "hermit",
            isReversed: false,
          },
          {
            positionId: "future",
            cardId: "star",
            isReversed: true,
          },
        ],
        agent_profile: "standard",
        phase: "initial",
      });

      expect(reading.agent_profile).toBe("standard");
      expect(reading.reading_phase).toBe("initial");
      expect(reading.cards).toHaveLength(3);
      expect(reading.themes.length).toBeGreaterThanOrEqual(2);
      expect(reading.themes.length).toBeLessThanOrEqual(4);
      expect(reading.reflective_guidance.length).toBeGreaterThanOrEqual(2);
      expect(reading.reflective_guidance.length).toBeLessThanOrEqual(4);
      expect(reading.follow_up_questions.length).toBeGreaterThanOrEqual(1);
      expect(reading.follow_up_questions.length).toBeLessThanOrEqual(2);
      expect(reading.safety_note).toBeNull();
    },
    180_000,
  );
});
