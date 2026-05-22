import type { z } from "zod";
import type { ReadingToolDefinition } from "@/server/reading/tools/types";
import type { ReadingToolContext } from "@/server/reading/tools/types";

type ReadingToolRegistration = Omit<
  ReadingToolDefinition<never, unknown>,
  "inputSchema" | "outputSchema" | "run"
> & {
  inputSchema: z.ZodType;
  outputSchema?: z.ZodType;
  run: (input: never, context: ReadingToolContext) => Promise<unknown>;
};

export interface ReadingToolRegistry {
  getTool<Input = unknown, Output = unknown>(
    name: string,
  ): ReadingToolDefinition<Input, Output> | undefined;
  listTools(): ReadingToolDefinition<unknown, unknown>[];
  hasTool(name: string): boolean;
  registerTool(tool: ReadingToolRegistration): void;
}

export function createReadingToolRegistry(
  tools: ReadingToolRegistration[] = [],
): ReadingToolRegistry {
  const toolByName = new Map<string, ReadingToolDefinition<unknown, unknown>>();

  const registerTool = (tool: ReadingToolRegistration) => {
    if (toolByName.has(tool.name)) {
      throw new Error(`Reading tool "${tool.name}" is already registered.`);
    }

    toolByName.set(
      tool.name,
      tool as unknown as ReadingToolDefinition<unknown, unknown>,
    );
  };

  for (const tool of tools) {
    registerTool(tool);
  }

  return {
    getTool<Input = unknown, Output = unknown>(name: string) {
      return toolByName.get(name) as
        | ReadingToolDefinition<Input, Output>
        | undefined;
    },
    listTools() {
      return [...toolByName.values()];
    },
    hasTool(name) {
      return toolByName.has(name);
    },
    registerTool,
  };
}
