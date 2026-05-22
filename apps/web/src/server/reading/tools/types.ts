import type { z } from "zod";
import type { SessionMemoryStore } from "@/server/reading/memory";

export type ToolPermission = "public" | "session" | "private" | "admin";

export type ToolRiskLevel = "low" | "medium" | "high";

export interface ReadingToolContext {
  runId?: string;
  threadId?: string;
  userId?: string;
  requestId?: string;
  permissions?: ToolPermission[];
  now?: string;
  stateSnapshot?: unknown;
  sessionMemoryStore?: SessionMemoryStore;
}

export interface ReadingToolDefinition<Input, Output> {
  name: string;
  description: string;
  permission: ToolPermission;
  riskLevel: ToolRiskLevel;
  inputSchema: z.ZodType<Input>;
  outputSchema?: z.ZodType<Output>;
  timeoutMs: number;
  traceable: boolean;
  run: (input: Input, context: ReadingToolContext) => Promise<Output>;
}

export interface ReadingToolResult<Output> {
  ok: boolean;
  toolName: string;
  output?: Output;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  latencyMs: number;
}

export interface ToolCallAuditEntry {
  id: string;
  step: number;
  tool_name: string;
  permission: ToolPermission;
  risk_level: ToolRiskLevel;
  input_summary: unknown;
  output_summary?: unknown;
  ok: boolean;
  latency_ms: number;
  error?: {
    code: string;
    message: string;
  };
  decision_reason?: string;
  created_at: string;
}

export interface ReadingToolExecution<Output> {
  result: ReadingToolResult<Output>;
  auditEntry: ToolCallAuditEntry;
}
