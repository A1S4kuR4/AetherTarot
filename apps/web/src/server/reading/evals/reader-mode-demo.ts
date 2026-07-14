/**
 * Reader-mode demo: runs the SAME input through all three reader modes
 * (快速 / 日常 / 专业, internal ids lite / standard / sober) using the
 * deterministic placeholder provider, and prints each reading alongside the
 * strategy fields that drive the differences.
 *
 * Run with:
 *   npm run eval:reading -- -- # (not this; use the direct vite-node invocation)
 *   npx vite-node --config vitest.config.ts src/server/reading/evals/reader-mode-demo.ts
 *
 * The placeholder provider is the deterministic scaffolding that also backs the
 * eval suite; the live LLM receives the same mode strategy via the prompt built
 * by buildInitialReadingPrompt / buildFinalReadingPrompt.
 */
import {
  buildPlaceholderFinalReadingDraft,
  buildPlaceholderInitialReadingDraft,
  readerModeStrategies,
} from "@aethertarot/prompting";
import type { AgentProfile, ReadingRequestPayload } from "@aethertarot/shared-types";
import { runReadingGraphWithDiagnostics } from "@/server/reading/graph";
import type {
  FinalReadingContext,
  HydratedReadingContext,
  ReadingProvider,
} from "@/server/reading/types";

const MODES: AgentProfile[] = ["lite", "standard", "sober"];

/**
 * Deterministic placeholder provider (same one the eval suite uses), so the
 * demo does not depend on AETHERTAROT_READING_PROVIDER or a live LLM. The live
 * LLM receives the same mode strategy via the prompt built by
 * buildInitialReadingPrompt / buildFinalReadingPrompt.
 */
class DemoPlaceholderProvider implements ReadingProvider {
  async generateInitialRead(context: HydratedReadingContext) {
    return buildPlaceholderInitialReadingDraft(context);
  }

  async generateFinalRead(context: FinalReadingContext) {
    return buildPlaceholderFinalReadingDraft(context);
  }
}

const SHARED_INPUT: ReadingRequestPayload = {
  question: "我该如何看待当前的职业选择？",
  spreadId: "holy-triangle",
  drawnCards: [
    { positionId: "past", cardId: "high-priestess", isReversed: false },
    { positionId: "present", cardId: "hermit", isReversed: false },
    { positionId: "future", cardId: "star", isReversed: true },
  ],
};

function divider(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

async function main() {
  divider(`Reader-mode demo — same input, three modes`);
  console.log(`Question: ${SHARED_INPUT.question}`);
  console.log(`Spread: holy-triangle (3 cards: high-priestess / hermit / star-reversed)`);

  for (const mode of MODES) {
    const strategy = readerModeStrategies[mode];
    const result = await runReadingGraphWithDiagnostics(
      { ...SHARED_INPUT, agent_profile: mode },
      { provider: new DemoPlaceholderProvider() },
    );
    const reading = result.reading;

    divider(`${strategy.displayName}  (internal id: ${mode})`);
    console.log("[Strategy config driving this output]");
    console.log(`  goal: ${strategy.goal}`);
    console.log(
      `  detailLevel=${strategy.detailLevel}  terminology=${strategy.terminologyLevel}  clarification=${strategy.clarificationDepth}`,
    );
    console.log(
      `  alternativeInterpretation=${strategy.alternativeInterpretation}  uncertaintyStyle=${strategy.uncertaintyStyle}`,
    );
    console.log(
      `  guidanceItemCount=${strategy.guidanceItemCount}  maxFollowupQuestions=${strategy.maxFollowupQuestions}`,
    );
    console.log(`  targetLength: single ${strategy.outputLength.singleCard}; multi ${strategy.outputLength.multiCard}`);

    console.log("\n[Themes]");
    console.log(`  ${reading.themes.join(" | ")}`);

    console.log("\n[Synthesis]");
    console.log(`  ${reading.synthesis}`);

    console.log(`\n[Reflective guidance]  (${reading.reflective_guidance.length} items)`);
    reading.reflective_guidance.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });

    console.log(`\n[Follow-up questions]  (${reading.follow_up_questions.length})`);
    if (reading.follow_up_questions.length === 0) {
      console.log("  (none — quick mode defaults to no multi-round clarification)");
    } else {
      reading.follow_up_questions.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
      });
    }

    if (reading.safety_note) {
      console.log(`\n[Safety note]  ${reading.safety_note}`);
    }
  }

  console.log("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
