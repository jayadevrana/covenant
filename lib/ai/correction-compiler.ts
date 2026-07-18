import { z } from "zod";

import {
  CorrectionSchema,
  GeneratedEvalSchema,
  PatchSchema,
  PolicyJsonSchema,
  PolicySchema,
  ProposedActionSchema,
  type Correction,
  type Patch,
  type Policy,
  type ProposedAction,
} from "../schemas";
import {
  compileStructured,
  type CompilerResult,
  type ResponsesClient,
} from "./structured";

export const failureClasses = [
  "policy_gap",
  "policy_too_permissive",
  "policy_too_restrictive",
  "execution_error",
  "ambiguous_intent",
] as const;

export const CorrectionCompilationSchema = z
  .object({
    failure_class: z.enum(failureClasses),
    generated_eval: GeneratedEvalSchema,
    candidate_patch: PatchSchema,
    explanation: z.string(),
  })
  .strict();

export type CorrectionCompilation = z.infer<typeof CorrectionCompilationSchema>;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nullableStrings = {
  anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
} as const;
const strictArgsProperties = {
  affected_by: nullableString,
  query: nullableString,
  document_id: nullableString,
  recipients: nullableStrings,
  to: nullableStrings,
  cc: nullableStrings,
  bcc: nullableStrings,
  subject: nullableString,
  body: nullableString,
  attachments: {
    anyOf: [
      {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "data_classes"],
          properties: { name: { type: "string" }, data_classes: { type: "array", items: { type: "string" } } },
        },
      },
      { type: "null" },
    ],
  },
  data_classes: nullableStrings,
  record_ids: nullableStrings,
  report_id: nullableString,
  audience: nullableString,
} as const;

const strictActionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "run_id", "step", "tool", "args", "purpose"],
  properties: {
    id: { type: "string" },
    run_id: { type: "string" },
    step: { type: "integer", minimum: 0 },
    tool: { type: "string" },
    args: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(strictArgsProperties),
      properties: strictArgsProperties,
    },
    purpose: { type: "string" },
  },
} as const;

export const CorrectionCompilationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["failure_class", "generated_eval", "candidate_patch", "explanation"],
  properties: {
    failure_class: { type: "string", enum: failureClasses },
    generated_eval: {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "description", "trace", "expectations", "origin", "correction_id"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        trace: { type: "array", items: strictActionSchema },
        expectations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action_index", "expected_verdict"],
            properties: {
              action_index: { type: "integer", minimum: 0 },
              expected_verdict: {
                type: "string",
                enum: ["allow", "block", "require_approval"],
              },
            },
          },
        },
        origin: { type: "string", enum: ["correction"] },
        correction_id: { type: "string" },
      },
    },
    candidate_patch: {
      type: "object",
      additionalProperties: false,
      required: ["id", "correction_id", "type", "rule", "diff_summary", "rationale", "status"],
      properties: {
        id: { type: "string" },
        correction_id: { type: "string" },
        type: { type: "string", enum: ["rule_add", "rule_modify"] },
        rule: { $ref: "#/$defs/rule" },
        diff_summary: { type: "string" },
        rationale: { type: "string" },
        status: { type: "string", enum: ["proposed"] },
      },
    },
    explanation: { type: "string" },
  },
  $defs: PolicyJsonSchema.$defs,
} as const;

const CORRECTION_COMPILER_PROMPT = `Turn one human correction into a regression eval and one candidate policy patch.
This is a suggestion only: the human must approve it, and deterministic replay verifies it.
The generated eval must have origin correction and reference the correction id.
The patch status must be proposed. Do not claim it is active.
Every trace args object must include every schema key, using null for unused keys.
Condition nodes include every key; unused keys are null and non-leaf value is null.
The generated eval must fail against the supplied current policy and pass only after the candidate patch.
Never weaken the existing block on customer data sent externally.
For a correction asking for a redacted partner summary, synthesize that redacted send with attachment name redacted_incident_summary and public data; expect require_approval; add a narrow require_approval rule matching an external domain, that attachment name, and contains_customer_data=false.`;

export interface CompileCorrectionOptions {
  client: ResponsesClient;
  correction: Correction;
  policy: Policy;
  selectedAction: ProposedAction;
  failureClass?: (typeof failureClasses)[number];
  model?: string;
}

export async function compileCorrection(
  options: CompileCorrectionOptions,
): Promise<CompilerResult<CorrectionCompilation>> {
  const input = z
    .object({
      correction: CorrectionSchema,
      policy: PolicySchema,
      selectedAction: ProposedActionSchema,
    })
    .safeParse(options);
  if (!input.success) {
    return {
      ok: false,
      error: {
        code: "invalid_input",
        message: "Correction compiler input failed validation.",
        validationIssues: input.error.message,
      },
      model: options.model ?? "gpt-5.6",
      attempts: 0,
    };
  }
  const result = await compileStructured({
    client: options.client,
    model: options.model,
    formatName: "covenant_correction",
    jsonSchema: CorrectionCompilationJsonSchema as unknown as Record<string, unknown>,
    zodSchema: CorrectionCompilationSchema,
    systemPrompt: CORRECTION_COMPILER_PROMPT,
    userPrompt: JSON.stringify({
      correction: input.data.correction,
      preclassified_failure: options.failureClass ?? null,
      current_policy: input.data.policy,
      selected_action: input.data.selectedAction,
    }),
    reasoningEffort: "low",
  });
  if (result.ok && options.failureClass) {
    return {
      ...result,
      data: { ...result.data, failure_class: options.failureClass },
    };
  }
  return result;
}

export type { Patch };
