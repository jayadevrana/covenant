import { PolicyJsonSchema, PolicySchema, type Policy } from "../schemas";
import {
  compileStructured,
  type CompilerResult,
  type ResponsesClient,
} from "./structured";

const POLICY_COMPILER_PROMPT = `You compile plain-English governance rules into a typed Covenant policy suggestion.
The deterministic engine, not you, makes runtime decisions. Preserve the source text exactly.
Return condition nodes with every key present: use null for unused all, any, not, field, and op keys; value is null for non-leaf nodes.
Use only deterministic predicates over tool, args, and derived. Never invent model-derived facts.
Order rules clearly, but runtime precedence remains block > require_approval > allow.
Only the human may activate this suggestion.`;

export interface CompilePolicyOptions {
  client: ResponsesClient;
  sourceText: string;
  model?: string;
}

export function compilePolicy(options: CompilePolicyOptions): Promise<CompilerResult<Policy>> {
  if (options.sourceText.trim().length === 0) {
    return Promise.resolve({
      ok: false,
      error: { code: "invalid_input", message: "Policy source text cannot be empty." },
      model: options.model ?? "gpt-5.6",
      attempts: 0,
    });
  }
  return compileStructured({
    client: options.client,
    model: options.model,
    formatName: "covenant_policy",
    jsonSchema: PolicyJsonSchema as unknown as Record<string, unknown>,
    zodSchema: PolicySchema,
    systemPrompt: POLICY_COMPILER_PROMPT,
    userPrompt: `Compile this policy text:\n\n${options.sourceText}`,
    reasoningEffort: "low",
  });
}
