import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildPlaceholderFinalReadingDraft,
  buildPlaceholderInitialReadingDraft,
} from "@aethertarot/prompting";
import type { ReadingRequestPayload } from "@aethertarot/shared-types";
import { isReadingServiceError } from "@/server/reading/errors";
import type { ReadingEvalRunResult } from "@/server/reading/evals/assertions";
import { readingEvalCases, type ReadingEvalCase } from "@/server/reading/evals/cases";
import {
  buildReadingEvalCaseReport,
  buildReadingEvalReport,
  type ReadingEvalCaseReport,
  type ReadingEvalReport,
} from "@/server/reading/evals/report";
import { runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import {
  createInMemorySessionMemoryStore,
  type SessionMemoryStore,
} from "@/server/reading/memory";
import type { ReadingAgentDecider } from "@/server/reading/reading-agent-core";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingProvider,
} from "@/server/reading/types";
import {
  createReadingToolRegistry,
  drawCardsServerSideTool,
  type ReadingToolDefinition,
} from "@/server/reading/tools";
import {
  retrieveTarotKnowledgeInputSchema,
  retrieveTarotKnowledgeOutputSchema,
  type RetrieveTarotKnowledgeInput,
  type RetrieveTarotKnowledgeOutput,
} from "@/server/reading/tools/retrieve-tarot-knowledge";

const DEFAULT_SPREAD_ID = "single";
const DEFAULT_POSITION_ID = "focus";
const DEFAULT_CARD_ID = "star";
const DEFAULT_REPORT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../outputs/evals/reading-eval-report.json",
);

class EvalPlaceholderReadingProvider implements ReadingProvider {
  async generateInitialRead(context: HydratedReadingContext) {
    return buildPlaceholderInitialReadingDraft(context);
  }

  async generateFinalRead(context: FinalReadingContext) {
    return buildPlaceholderFinalReadingDraft(context);
  }
}

function buildPayload(evalCase: ReadingEvalCase): ReadingRequestPayload {
  const cards = evalCase.input.cards?.length
    ? evalCase.input.cards
    : [{ id: DEFAULT_CARD_ID, orientation: "upright" as const }];

  return {
    question: evalCase.input.question,
    spreadId: DEFAULT_SPREAD_ID,
    drawnCards: cards.map((card, index) => ({
      positionId: index === 0 ? DEFAULT_POSITION_ID : `${DEFAULT_POSITION_ID}-${index + 1}`,
      cardId: card.id,
      isReversed: card.orientation === "reversed",
    })),
    agent_profile: evalCase.input.agent_profile,
    thread_id: evalCase.runtime?.fixture === "thread_memory_followup"
      ? "eval-thread-memory-followup"
      : undefined,
  };
}

function buildThreadMemorySeedPayload(): ReadingRequestPayload {
  return {
    question: "我在职业上是不是该离职？",
    spreadId: DEFAULT_SPREAD_ID,
    drawnCards: [
      {
        positionId: DEFAULT_POSITION_ID,
        cardId: "hanged-man",
        isReversed: true,
      },
    ],
    thread_id: "eval-thread-memory-followup",
    agent_profile: "lite",
  };
}

function createEmptyRetrievalTool(): ReadingToolDefinition<
  RetrieveTarotKnowledgeInput,
  RetrieveTarotKnowledgeOutput
> {
  return {
    name: "retrieve_tarot_knowledge",
    description: "Eval-only retrieve tool that returns no grounded chunks.",
    permission: "public",
    riskLevel: "low",
    inputSchema: retrieveTarotKnowledgeInputSchema,
    outputSchema: retrieveTarotKnowledgeOutputSchema,
    timeoutMs: 100,
    traceable: true,
    async run() {
      return {
        groundingStatus: "none",
        chunks: [],
      };
    },
  };
}

function buildRepeatRetrieveDecider(): ReadingAgentDecider {
  return () => ({
    type: "retrieve_knowledge",
    reason: "Eval fixture repeatedly requests retrieval to verify max_agent_steps.",
    query: "repeat retrieve eval fixture",
  });
}

function buildRunOptions(
  evalCase: ReadingEvalCase,
  sessionMemoryStore?: SessionMemoryStore,
) {
  const fixture = evalCase.runtime?.fixture ?? "default";

  return {
    provider: new EvalPlaceholderReadingProvider(),
    maxAgentSteps: evalCase.runtime?.max_agent_steps,
    sessionMemoryStore,
    agentDecider:
      fixture === "repeat_retrieve" ? buildRepeatRetrieveDecider() : undefined,
    toolRegistry:
      fixture === "empty_retrieval"
        ? createReadingToolRegistry([
            createEmptyRetrievalTool(),
            drawCardsServerSideTool,
          ])
        : undefined,
  };
}

export async function runReadingEvalCase(
  evalCase: ReadingEvalCase,
): Promise<ReadingEvalCaseReport> {
  const payload = buildPayload(evalCase);
  const sessionMemoryStore = evalCase.runtime?.fixture === "thread_memory_followup"
    ? createInMemorySessionMemoryStore()
    : undefined;

  try {
    if (sessionMemoryStore) {
      await runReadingGraphWithDiagnostics(buildThreadMemorySeedPayload(), {
        provider: new EvalPlaceholderReadingProvider(),
        sessionMemoryStore,
      });
    }

    const result = await runReadingGraphWithDiagnostics(
      payload,
      buildRunOptions(evalCase, sessionMemoryStore),
    );
    return buildReadingEvalCaseReport({
      case: evalCase,
      reading: result.reading,
      agentState: result.agentState,
      trace: result.trace,
    });
  } catch (error) {
    const runResult: ReadingEvalRunResult = {
      case: evalCase,
      error,
      trace: isReadingServiceError(error) ? error.diagnosticTrace : undefined,
    };

    return buildReadingEvalCaseReport(runResult);
  }
}

export async function runReadingEvalSuite(
  cases: ReadingEvalCase[] = readingEvalCases,
): Promise<ReadingEvalReport> {
  const startedAt = new Date().toISOString();
  const reports: ReadingEvalCaseReport[] = [];

  for (const evalCase of cases) {
    reports.push(await runReadingEvalCase(evalCase));
  }

  return buildReadingEvalReport({
    startedAt,
    endedAt: new Date().toISOString(),
    cases: reports,
  });
}

export async function writeReadingEvalReport(
  report: ReadingEvalReport,
  reportPath = DEFAULT_REPORT_PATH,
) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return reportPath;
}

function isDirectRun() {
  if (process.env.VITEST === "true") {
    return false;
  }

  if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    return true;
  }

  return process.argv.some(
    (item) => path.basename(item) === "runner.ts"
      && path.normalize(item).includes(path.normalize("reading/evals")),
  ) || process.argv.some((item) => item.includes("vite-node"));
}

async function main() {
  const report = await runReadingEvalSuite();
  const reportPath = await writeReadingEvalReport(report);

  console.log(JSON.stringify(report, null, 2));
  console.log(`Reading eval report written to ${reportPath}`);

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

if (isDirectRun()) {
  void main();
}
