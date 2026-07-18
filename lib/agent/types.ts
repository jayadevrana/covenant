import type { Decision, JsonValue, Policy, ProposedAction, ReceiptEvent } from "../schemas";
import type { SandboxToolResult, SandboxWorld } from "../sandbox";

export type RunMode = "fixture" | "live";
export type RunStatus = "running" | "awaiting_approval" | "completed" | "error";

export type TimelineType =
  | "task_started"
  | "model_call"
  | "action_proposed"
  | "decision"
  | "approval"
  | "tool_executed"
  | "tool_skipped"
  | "task_completed"
  | "error";

export interface TimelineEntry {
  seq: number;
  type: TimelineType;
  title: string;
  detail: string;
  timestamp: string;
  provenance: "FIXTURE" | `LIVE · ${string}`;
  action?: ProposedAction;
  decision?: Decision;
  result?: SandboxToolResult | { ok: false; data: JsonValue };
}

export interface AgentRun {
  id: string;
  task: string;
  mode: RunMode;
  modelId: string;
  policy: Policy;
  status: RunStatus;
  turn: number;
  fixtureActionIndex: number;
  timeline: TimelineEntry[];
  receipts: ReceiptEvent[];
  observations: JsonValue[];
  pendingAction: ProposedAction | null;
  pendingDecision: Decision | null;
  world: SandboxWorld;
}

export interface AgentResponseRequest {
  model: string;
  instructions: string;
  input: string;
  reasoning: { effort: "low" };
  max_output_tokens: number;
  tools: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: true;
  }>;
  tool_choice: "auto";
  parallel_tool_calls: false;
}

export interface AgentResponsesClient {
  responses: {
    create(request: AgentResponseRequest): Promise<unknown>;
  };
}

export interface AgentStepDelta {
  run: AgentRun;
  entries: TimelineEntry[];
}
