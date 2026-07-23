import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { getAllCards, getAllSpreads } from "@aethertarot/domain-tarot";
import type {
  AgentProfile,
  ReadingRequestPayload,
  StructuredReading,
} from "@aethertarot/shared-types";
import { loadTarotKnowledgeChunks } from "../src/server/reading/knowledge/loader";
import {
  createLlmReadingProviderFromEnv,
  resolveLlmProviderConfig,
} from "../src/server/reading/llm-provider";
import { runReadingGraphWithDiagnostics } from "../src/server/reading/graph";
import { collectLlmUsage, summarizeLlmCalls } from "../src/server/observability/llm-usage";
import {
  assertFormalCanaryReading,
  CANARY_TOKEN_BUDGET,
  createCanaryTokenGate,
} from "../src/server/quality/canary";

const execFileAsync = promisify(execFile);

function payloadFor({
  question,
  spreadId,
  cardCount,
  profile,
}: {
  question: string;
  spreadId: string;
  cardCount: number;
  profile: AgentProfile;
}): ReadingRequestPayload {
  const spread = getAllSpreads().find((item) => item.id === spreadId);
  if (!spread) {
    throw new Error(`Unknown canary spread: ${spreadId}`);
  }
  const cards = getAllCards().slice(0, cardCount);
  return {
    request_id: randomUUID(),
    question,
    spreadId,
    agent_profile: profile,
    phase: "initial",
    draw_source: "digital_random",
    drawnCards: cards.map((card, index) => ({
      positionId: spread.positions[index].id,
      cardId: card.id,
      isReversed: index % 3 === 1,
    })),
  };
}

async function gitCommit() {
  try {
    return (await execFileAsync("git", ["rev-parse", "HEAD"])).stdout.trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "evals");
  await mkdir(outputDir, { recursive: true });
  const tokenGate = createCanaryTokenGate();
  const config = resolveLlmProviderConfig(process.env);
  const provider = createLlmReadingProviderFromEnv(process.env, fetch, tokenGate.gate);
  const wikiChunks = await loadTarotKnowledgeChunks();
  const wikiHash = createHash("sha256")
    .update(JSON.stringify(wikiChunks.map((chunk) => [
      chunk.id,
      chunk.source_ids,
      chunk.content,
    ])))
    .digest("hex");
  const modelFingerprint = createHash("sha256")
    .update(JSON.stringify({
      baseUrl: config.baseUrl,
      model: config.model,
      timeoutMs: config.timeoutMs,
      maxOutputTokens: config.maxOutputTokens,
    }))
    .digest("hex");
  const cases: Array<Record<string, unknown>> = [];
  const failures: string[] = [];

  const definitions = [
    {
      id: "lite-single-relationship",
      payload: payloadFor({
        question: "我怎样更清楚地看待这段关系里的沟通节奏？",
        spreadId: "single",
        cardCount: 1,
        profile: "lite",
      }),
    },
    {
      id: "standard-triangle-career",
      payload: payloadFor({
        question: "我接下来三个月的职业发展重点是什么？",
        spreadId: "holy-triangle",
        cardCount: 3,
        profile: "standard",
      }),
    },
    {
      id: "sober-seven-decision",
      payload: payloadFor({
        question: "我该不该辞职？请帮我梳理现实风险和选择边界。",
        spreadId: "seven-card",
        cardCount: 7,
        profile: "sober",
      }),
    },
    {
      id: "standard-two-stage-initial",
      payload: payloadFor({
        question: "我该怎样理解当前关系中的拉扯，并找到可验证的下一步？",
        spreadId: "holy-triangle",
        cardCount: 3,
        profile: "standard",
      }),
    },
  ] as const;

  let twoStageInitial: StructuredReading | null = null;
  for (const definition of definitions) {
    try {
      const { result, calls } = await collectLlmUsage(() =>
        runReadingGraphWithDiagnostics(definition.payload, { provider })
      );
      assertFormalCanaryReading(result.reading);
      if (definition.id === "standard-two-stage-initial") {
        twoStageInitial = result.reading;
      }
      cases.push({
        case_id: definition.id,
        usage: summarizeLlmCalls(calls),
        trace: result.trace,
        reading: result.reading,
      });
    } catch (error) {
      failures.push(`${definition.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (twoStageInitial) {
    const base = definitions.at(-1)!.payload;
    const finalPayload: ReadingRequestPayload = {
      ...base,
      request_id: randomUUID(),
      phase: "final",
      initial_reading_id: twoStageInitial.reading_id,
      followup_answers: twoStageInitial.follow_up_questions.map((question, index) => ({
        question,
        answer: index === 0
          ? "我已经观察到沟通频率下降，但还没有直接确认原因。"
          : "我的底线是保持尊重，并先进行一次明确沟通。",
      })),
    };
    try {
      const { result, calls } = await collectLlmUsage(() =>
        runReadingGraphWithDiagnostics(finalPayload, {
          provider,
          initialReading: twoStageInitial!,
        })
      );
      assertFormalCanaryReading(result.reading);
      cases.push({
        case_id: "standard-two-stage-final",
        usage: summarizeLlmCalls(calls),
        trace: result.trace,
        reading: result.reading,
      });
    } catch (error) {
      failures.push(
        `standard-two-stage-final: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    failures.push("standard-two-stage-final: initial stage did not complete.");
  }

  const report = {
    version: 1,
    generated_at: new Date().toISOString(),
    git_commit: await gitCommit(),
    model_config_fingerprint: modelFingerprint,
    wiki_corpus_hash: wikiHash,
    budget: { maximum_tokens: CANARY_TOKEN_BUDGET, ...tokenGate.snapshot() },
    cases,
    failures,
  };
  const outputPath = path.join(outputDir, "llm-canary-report.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
  if (failures.length > 0 || cases.length !== 5) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "evals");
  void mkdir(outputDir, { recursive: true })
    .then(() => writeFile(
      path.join(outputDir, "llm-canary-report.json"),
      `${JSON.stringify({
        version: 1,
        generated_at: new Date().toISOString(),
        git_commit: "unknown",
        model_config_fingerprint: "unavailable",
        wiki_corpus_hash: "unavailable",
        budget: {
          maximum_tokens: CANARY_TOKEN_BUDGET,
          settled_tokens: 0,
          reservations: 0,
        },
        cases: [],
        failures: [`runner: ${message}`],
      }, null, 2)}\n`,
      "utf8",
    ))
    .finally(() => {
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
});
