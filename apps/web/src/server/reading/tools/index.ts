import { drawCardsServerSideTool } from "@/server/reading/tools/draw-cards-server-side";
import { createReadingToolRegistry } from "@/server/reading/tools/registry";
import { retrieveTarotKnowledgeTool } from "@/server/reading/tools/retrieve-tarot-knowledge";
import {
  getSessionMemoryTool,
  writeSessionMemoryTool,
} from "@/server/reading/tools/session-memory";

export const readingToolRegistry = createReadingToolRegistry([
  retrieveTarotKnowledgeTool,
  drawCardsServerSideTool,
  getSessionMemoryTool,
  writeSessionMemoryTool,
]);

export {
  createReadingToolRegistry,
  drawCardsServerSideTool,
  getSessionMemoryTool,
  retrieveTarotKnowledgeTool,
  writeSessionMemoryTool,
};

export type { ReadingToolRegistry } from "@/server/reading/tools/registry";
export type {
  ReadingToolContext,
  ReadingToolDefinition,
  ReadingToolExecution,
  ReadingToolResult,
  ToolCallAuditEntry,
  ToolPermission,
  ToolRiskLevel,
} from "@/server/reading/tools/types";
