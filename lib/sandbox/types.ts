import type { JsonValue } from "../schemas";

export interface SandboxToolResult {
  ok: boolean;
  data: JsonValue;
}

export interface SandboxWorld {
  outbox: JsonValue[];
  exportLog: JsonValue[];
  publicationLog: JsonValue[];
}

export interface SandboxTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, JsonValue>, world: SandboxWorld): Promise<SandboxToolResult>;
}

export type SandboxToolMap = Record<string, SandboxTool>;

export interface ExecutionRecord {
  tool: string;
  args: Record<string, JsonValue>;
}

export interface ExecutionRecorder {
  records: ExecutionRecord[];
  record(tool: string, args: Record<string, JsonValue>): void;
}

export function createExecutionRecorder(): ExecutionRecorder {
  const records: ExecutionRecord[] = [];
  return {
    records,
    record(tool, args) {
      records.push({ tool, args });
    },
  };
}

export function createSandboxWorld(): SandboxWorld {
  return { outbox: [], exportLog: [], publicationLog: [] };
}
