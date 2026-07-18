import { randomUUID } from "node:crypto";

import {
  evaluatePolicy,
  type Decision,
  type DerivationContext,
  type JsonValue,
  type Policy,
  type ProposedAction,
} from "../lib/engine";
import { appendReceipt, verifyReceiptChain } from "../lib/receipts";
import type { ReceiptEvent } from "../lib/schemas";

export interface CovenantTool<TResult = unknown> {
  name: string;
  description?: string;
  execute(args: Record<string, JsonValue>): TResult | Promise<TResult>;
}

export type CovenantToolMap = Record<string, CovenantTool>;

export interface CovenantHooks {
  runId?: string;
  now?: () => string;
  derivationContext?: DerivationContext;
  onApprovalNeeded?: (
    action: ProposedAction,
    decision: Decision,
  ) => boolean | Promise<boolean>;
  onReceipt?: (event: ReceiptEvent) => void;
}

export interface CovenantRefusal {
  ok: false;
  skipped: true;
  reason: "blocked_by_policy" | "approval_denied";
  decision: Decision;
}

export interface CovenantRuntime {
  tools: Record<string, CovenantTool<unknown | CovenantRefusal>>;
  receipts: ReceiptEvent[];
  verifyReceipts(): ReturnType<typeof verifyReceiptChain>;
}

function jsonValue(value: unknown): JsonValue {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError("Tool results must be JSON-serializable");
  return JSON.parse(encoded) as JsonValue;
}

export function withCovenant<TTools extends CovenantToolMap>(
  tools: TTools,
  policy: Policy,
  hooks: CovenantHooks = {},
): CovenantRuntime {
  const runId = hooks.runId ?? randomUUID();
  const now = hooks.now ?? (() => new Date().toISOString());
  const receipts: ReceiptEvent[] = [];
  let step = 0;

  const record = (type: ReceiptEvent["type"], payload: Record<string, JsonValue>) => {
    const event = appendReceipt(receipts, { run_id: runId, type, payload, timestamp: now() });
    hooks.onReceipt?.(event);
    return event;
  };

  record("task_started", { source: "sdk", policy_version: policy.version });

  const wrapped = Object.fromEntries(
    Object.entries(tools).map(([key, tool]) => {
      const execute = async (args: Record<string, JsonValue>) => {
        const action: ProposedAction = {
          id: `${runId}:${step}`,
          run_id: runId,
          step: step++,
          tool: tool.name,
          args,
          purpose: `Execute ${tool.name} through Covenant`,
        };
        record("action_proposed", { action: action as unknown as JsonValue });
        const decision = evaluatePolicy(policy, action, {
          timestamp: now(),
          derivationContext: hooks.derivationContext,
        });
        record("decision", { decision: decision as unknown as JsonValue });

        let approved = decision.verdict !== "require_approval";
        if (decision.verdict === "require_approval") {
          approved = (await hooks.onApprovalNeeded?.(action, decision)) ?? false;
          record("approval", {
            action_id: action.id,
            approved,
            policy_version: policy.version,
          });
        }

        if (decision.verdict === "block" || !approved) {
          const refusal: CovenantRefusal = {
            ok: false,
            skipped: true,
            reason: decision.verdict === "block" ? "blocked_by_policy" : "approval_denied",
            decision,
          };
          record("tool_skipped", { action_id: action.id, refusal: refusal as unknown as JsonValue });
          return refusal;
        }

        try {
          const result = await tool.execute(args);
          record("tool_executed", { action_id: action.id, result: jsonValue(result) });
          return result;
        } catch (error) {
          record("error", {
            action_id: action.id,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      };
      return [key, { ...tool, execute }];
    }),
  );

  return {
    tools: wrapped,
    receipts,
    verifyReceipts: () => verifyReceiptChain(receipts),
  };
}

export { verifyReceiptChain } from "../lib/receipts";
export type { Decision, Policy, ProposedAction, ReceiptEvent };
