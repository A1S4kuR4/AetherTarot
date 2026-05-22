import { z } from "zod";
import type { ReadingToolRegistry } from "@/server/reading/tools/registry";
import type {
  ReadingToolContext,
  ReadingToolExecution,
  ReadingToolResult,
  ToolCallAuditEntry,
} from "@/server/reading/tools/types";

interface ExecuteReadingToolOptions {
  toolName: string;
  input: unknown;
  context?: ReadingToolContext;
  registry: ReadingToolRegistry;
  decisionReason?: string;
  step?: number;
}

function getLatency(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function getCreatedAt(context: ReadingToolContext | undefined) {
  return context?.now ?? new Date().toISOString();
}

function summarizeInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return input;
  }

  const value = input as Record<string, unknown>;

  return {
    query: value.query,
    card: value.card,
    orientation: value.orientation,
    topic: value.topic,
    spreadType: value.spreadType,
    count: value.count,
    allowReversed: value.allowReversed,
    hasSeed: typeof value.seed === "string" && value.seed.length > 0,
    threadId: value.threadId,
    patch_keys:
      value.patch && typeof value.patch === "object"
        ? Object.keys(value.patch as Record<string, unknown>)
        : undefined,
  };
}

function summarizeOutput(output: unknown) {
  if (!output || typeof output !== "object") {
    return output;
  }

  const value = output as Record<string, unknown>;

  if (Array.isArray(value.chunks) || typeof value.groundingStatus === "string") {
    return {
      chunk_count: Array.isArray(value.chunks) ? value.chunks.length : undefined,
      grounding_status: value.groundingStatus,
    };
  }

  if (Array.isArray(value.cards) || typeof value.source === "string") {
    return {
      card_count: Array.isArray(value.cards) ? value.cards.length : undefined,
      source: value.source,
    };
  }

  if ("memory" in value) {
    const memory = value.memory as Record<string, unknown> | null;

    return {
      has_memory: Boolean(memory),
      topic_count: Array.isArray(memory?.topics) ? memory.topics.length : undefined,
      card_count: Array.isArray(memory?.cards) ? memory.cards.length : undefined,
      has_last_advice: typeof memory?.last_advice_summary === "string",
      updated: value.updated,
    };
  }

  return {
    keys: Object.keys(value),
  };
}

function buildAuditEntry({
  id,
  step,
  toolName,
  permission,
  riskLevel,
  input,
  output,
  ok,
  latencyMs,
  error,
  decisionReason,
  createdAt,
}: {
  id: string;
  step: number;
  toolName: string;
  permission: ToolCallAuditEntry["permission"];
  riskLevel: ToolCallAuditEntry["risk_level"];
  input: unknown;
  output?: unknown;
  ok: boolean;
  latencyMs: number;
  error?: { code: string; message: string };
  decisionReason?: string;
  createdAt: string;
}): ToolCallAuditEntry {
  return {
    id,
    step,
    tool_name: toolName,
    permission,
    risk_level: riskLevel,
    input_summary: summarizeInput(input),
    output_summary: ok ? summarizeOutput(output) : undefined,
    ok,
    latency_ms: latencyMs,
    error,
    decision_reason: decisionReason,
    created_at: createdAt,
  };
}

function buildResult<Output>({
  ok,
  toolName,
  output,
  error,
  latencyMs,
}: ReadingToolResult<Output>): ReadingToolResult<Output> {
  return {
    ok,
    toolName,
    output,
    error,
    latencyMs,
  };
}

function runWithTimeout<Output>(
  operation: Promise<Output>,
  timeoutMs: number,
  toolName: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          `Reading tool "${toolName}" timed out after ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export async function executeReadingTool<Output = unknown>({
  toolName,
  input,
  context,
  registry,
  decisionReason,
  step = 0,
}: ExecuteReadingToolOptions): Promise<ReadingToolExecution<Output>> {
  const startedAt = Date.now();
  const auditId = crypto.randomUUID();
  const createdAt = getCreatedAt(context);
  const tool = registry.getTool<unknown, Output>(toolName);

  if (!tool) {
    const latencyMs = getLatency(startedAt);
    const error = {
      code: "TOOL_NOT_FOUND",
      message: `Reading tool "${toolName}" is not registered.`,
      retryable: false,
    };

    return {
      result: buildResult({
        ok: false,
        toolName,
        error,
        latencyMs,
      }),
      auditEntry: buildAuditEntry({
        id: auditId,
        step,
        toolName,
        permission: "public",
        riskLevel: "low",
        input,
        ok: false,
        latencyMs,
        error: {
          code: error.code,
          message: error.message,
        },
        decisionReason,
        createdAt,
      }),
    };
  }

  if (
    tool.permission !== "public"
    && !context?.permissions?.includes(tool.permission)
  ) {
    const latencyMs = getLatency(startedAt);
    const error = {
      code: "TOOL_PERMISSION_DENIED",
      message: `Reading tool "${toolName}" requires "${tool.permission}" permission.`,
      retryable: false,
    };

    return {
      result: buildResult({
        ok: false,
        toolName,
        error,
        latencyMs,
      }),
      auditEntry: buildAuditEntry({
        id: auditId,
        step,
        toolName,
        permission: tool.permission,
        riskLevel: tool.riskLevel,
        input,
        ok: false,
        latencyMs,
        error: {
          code: error.code,
          message: error.message,
        },
        decisionReason,
        createdAt,
      }),
    };
  }

  const parsedInput = tool.inputSchema.safeParse(input);

  if (!parsedInput.success) {
    const latencyMs = getLatency(startedAt);
    const error = {
      code: "TOOL_INVALID_INPUT",
      message: z.prettifyError(parsedInput.error),
      retryable: false,
    };

    return {
      result: buildResult({
        ok: false,
        toolName,
        error,
        latencyMs,
      }),
      auditEntry: buildAuditEntry({
        id: auditId,
        step,
        toolName,
        permission: tool.permission,
        riskLevel: tool.riskLevel,
        input,
        ok: false,
        latencyMs,
        error: {
          code: error.code,
          message: error.message,
        },
        decisionReason,
        createdAt,
      }),
    };
  }

  try {
    const output = await runWithTimeout(
      tool.run(parsedInput.data, context ?? {}),
      tool.timeoutMs,
      toolName,
    );
    const parsedOutput = tool.outputSchema
      ? tool.outputSchema.safeParse(output)
      : { success: true, data: output } as const;

    if (!parsedOutput.success) {
      const latencyMs = getLatency(startedAt);
      const error = {
        code: "TOOL_INVALID_OUTPUT",
        message: z.prettifyError(parsedOutput.error),
        retryable: false,
      };

      return {
        result: buildResult({
          ok: false,
          toolName,
          error,
          latencyMs,
        }),
        auditEntry: buildAuditEntry({
          id: auditId,
          step,
          toolName,
          permission: tool.permission,
          riskLevel: tool.riskLevel,
          input,
          ok: false,
          latencyMs,
          error: {
            code: error.code,
            message: error.message,
          },
          decisionReason,
          createdAt,
        }),
      };
    }

    const latencyMs = getLatency(startedAt);

    return {
      result: buildResult({
        ok: true,
        toolName,
        output: parsedOutput.data,
        latencyMs,
      }),
      auditEntry: buildAuditEntry({
        id: auditId,
        step,
        toolName,
        permission: tool.permission,
        riskLevel: tool.riskLevel,
        input,
        output: parsedOutput.data,
        ok: true,
        latencyMs,
        decisionReason,
        createdAt,
      }),
    };
  } catch (error) {
    const latencyMs = getLatency(startedAt);
    const message = error instanceof Error ? error.message : "Unknown tool error.";
    const isTimeout = message.includes("timed out after");
    const resultError = {
      code: isTimeout ? "TOOL_TIMEOUT" : "TOOL_EXECUTION_FAILED",
      message,
      retryable: true,
    };

    return {
      result: buildResult({
        ok: false,
        toolName,
        error: resultError,
        latencyMs,
      }),
      auditEntry: buildAuditEntry({
        id: auditId,
        step,
        toolName,
        permission: tool.permission,
        riskLevel: tool.riskLevel,
        input,
        ok: false,
        latencyMs,
        error: {
          code: resultError.code,
          message,
        },
        decisionReason,
        createdAt,
      }),
    };
  }
}
