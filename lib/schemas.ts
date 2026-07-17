import { z } from "zod";

export const verdicts = ["allow", "block", "require_approval"] as const;
export const conditionOps = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "matches",
  "count_gt",
  "count_lte",
] as const;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export interface Cond {
  all: Cond[] | null;
  any: Cond[] | null;
  not: Cond | null;
  field: string | null;
  op: (typeof conditionOps)[number] | null;
  value: JsonValue;
}

export const CondSchema: z.ZodType<Cond> = z
  .object({
    all: z.array(z.lazy(() => CondSchema)).nullable(),
    any: z.array(z.lazy(() => CondSchema)).nullable(),
    not: z.lazy(() => CondSchema).nullable(),
    field: z.string().min(1).nullable(),
    op: z.enum(conditionOps).nullable(),
    value: JsonValueSchema,
  })
  .strict()
  .superRefine((condition, context) => {
    const shapes = [
      condition.all !== null,
      condition.any !== null,
      condition.not !== null,
      condition.field !== null || condition.op !== null,
    ].filter(Boolean).length;

    if (shapes !== 1) {
      context.addIssue({
        code: "custom",
        message: "A condition must contain exactly one of all, any, not, or a field/op leaf",
      });
    }

    if ((condition.field === null) !== (condition.op === null)) {
      context.addIssue({
        code: "custom",
        message: "Leaf conditions require both field and op",
      });
    }
  });

export const RuleSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    effect: z.enum(verdicts),
    scope: z.object({ tools: z.array(z.string().min(1)).min(1) }).strict(),
    condition: CondSchema.nullable(),
    risk: z.enum(["low", "medium", "high"]),
    enforcement: z.enum(["enforce", "log_only"]),
    rationale: z.string(),
  })
  .strict();

export const PolicySchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    source_text: z.string(),
    rules: z.array(RuleSchema),
  })
  .strict();

export const ProposedActionSchema = z
  .object({
    id: z.string().min(1),
    run_id: z.string().min(1),
    step: z.number().int().nonnegative(),
    tool: z.string().min(1),
    args: z.record(z.string(), JsonValueSchema),
    purpose: z.string(),
  })
  .strict();

export const DerivedFactsSchema = z
  .object({
    recipient_count: z.number().int().nonnegative(),
    external_domains: z.array(z.string()),
    contains_customer_data: z.boolean(),
    data_classes: z.array(z.string()),
    attachment_names: z.array(z.string()),
  })
  .strict();

export const DecisionSchema = z
  .object({
    action_id: z.string(),
    verdict: z.enum(verdicts),
    matched_rule_ids: z.array(z.string()),
    explanation: z.string(),
    policy_version: z.number().int().nonnegative(),
    engine_version: z.string(),
    timestamp: z.string(),
  })
  .strict();

export const ReceiptEventSchema = z
  .object({
    seq: z.number().int().nonnegative(),
    run_id: z.string(),
    type: z.enum([
      "task_started",
      "model_call",
      "action_proposed",
      "decision",
      "approval",
      "tool_executed",
      "tool_skipped",
      "correction",
      "error",
    ]),
    payload: z.record(z.string(), JsonValueSchema),
    payload_hash: z.string(),
    prev_hash: z.string(),
    timestamp: z.string(),
  })
  .strict();

export const CorrectionSchema = z
  .object({
    id: z.string(),
    run_id: z.string(),
    action_id: z.string(),
    what_happened: z.string(),
    what_should_have_happened: z.string(),
    author: z.literal("human"),
  })
  .strict();

export const GeneratedEvalSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    trace: z.array(ProposedActionSchema),
    expectations: z.array(
      z
        .object({
          action_index: z.number().int().nonnegative(),
          expected_verdict: z.enum(verdicts),
        })
        .strict(),
    ),
    origin: z.enum(["correction", "seed"]),
    correction_id: z.string().optional(),
  })
  .strict();

export const PatchSchema = z
  .object({
    id: z.string(),
    correction_id: z.string(),
    type: z.enum(["rule_add", "rule_modify"]),
    rule: RuleSchema,
    diff_summary: z.string(),
    rationale: z.string(),
    status: z.enum(["proposed", "approved", "rejected"]),
  })
  .strict();

export const EvalResultSchema = z
  .object({
    eval_id: z.string(),
    policy_version: z.number().int().positive(),
    passed: z.boolean(),
    per_expectation: z.array(
      z
        .object({
          action_index: z.number().int().nonnegative(),
          expected: z.enum(verdicts),
          actual: z.enum(verdicts),
          pass: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();

export type Rule = z.infer<typeof RuleSchema>;
export type Policy = z.infer<typeof PolicySchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;
export type DerivedFacts = z.infer<typeof DerivedFactsSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type ReceiptEvent = z.infer<typeof ReceiptEventSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type GeneratedEval = z.infer<typeof GeneratedEvalSchema>;
export type Patch = z.infer<typeof PatchSchema>;
export type EvalResult = z.infer<typeof EvalResultSchema>;

export const CoreZodSchemas = {
  policy: PolicySchema,
  rule: RuleSchema,
  proposedAction: ProposedActionSchema,
  derivedFacts: DerivedFactsSchema,
  decision: DecisionSchema,
  receiptEvent: ReceiptEventSchema,
  correction: CorrectionSchema,
  generatedEval: GeneratedEvalSchema,
  patch: PatchSchema,
  evalResult: EvalResultSchema,
} as const;

const condJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["all", "any", "not", "field", "op", "value"],
  properties: {
    all: { anyOf: [{ type: "array", items: { $ref: "#/$defs/cond" } }, { type: "null" }] },
    any: { anyOf: [{ type: "array", items: { $ref: "#/$defs/cond" } }, { type: "null" }] },
    not: { anyOf: [{ $ref: "#/$defs/cond" }, { type: "null" }] },
    field: { type: ["string", "null"] },
    op: { anyOf: [{ type: "string", enum: conditionOps }, { type: "null" }] },
    value: {
      anyOf: [
        { type: "null" },
        { type: "boolean" },
        { type: "number" },
        { type: "string" },
        {
          type: "array",
          items: {
            anyOf: [{ type: "null" }, { type: "boolean" }, { type: "number" }, { type: "string" }],
          },
        },
      ],
    },
  },
} as const;

const ruleJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "description", "effect", "scope", "condition", "risk", "enforcement", "rationale"],
  properties: {
    id: { type: "string" },
    description: { type: "string" },
    effect: { type: "string", enum: verdicts },
    scope: {
      type: "object",
      additionalProperties: false,
      required: ["tools"],
      properties: { tools: { type: "array", minItems: 1, items: { type: "string" } } },
    },
    condition: { anyOf: [{ $ref: "#/$defs/cond" }, { type: "null" }] },
    risk: { type: "string", enum: ["low", "medium", "high"] },
    enforcement: { type: "string", enum: ["enforce", "log_only"] },
    rationale: { type: "string" },
  },
} as const;

const proposedActionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "run_id", "step", "tool", "args", "purpose"],
  properties: {
    id: { type: "string" },
    run_id: { type: "string" },
    step: { type: "integer", minimum: 0 },
    tool: { type: "string" },
    args: { type: "object", additionalProperties: true },
    purpose: { type: "string" },
  },
} as const;

export const PolicyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version", "title", "source_text", "rules"],
  properties: {
    id: { type: "string" },
    version: { type: "integer", minimum: 1 },
    title: { type: "string" },
    source_text: { type: "string" },
    rules: { type: "array", items: { $ref: "#/$defs/rule" } },
  },
  $defs: { cond: condJsonSchema, rule: ruleJsonSchema },
} as const;

export const ProposedActionJsonSchema = proposedActionJsonSchema;

export const GeneratedEvalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "description", "trace", "expectations", "origin", "correction_id"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    trace: { type: "array", items: proposedActionJsonSchema },
    expectations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action_index", "expected_verdict"],
        properties: {
          action_index: { type: "integer", minimum: 0 },
          expected_verdict: { type: "string", enum: verdicts },
        },
      },
    },
    origin: { type: "string", enum: ["correction", "seed"] },
    correction_id: { type: ["string", "null"] },
  },
} as const;

export const RuleJsonSchema = { ...ruleJsonSchema, $defs: { cond: condJsonSchema } } as const;

export const CoreJsonSchemas = {
  policy: PolicyJsonSchema,
  rule: RuleJsonSchema,
  proposedAction: ProposedActionJsonSchema,
  derivedFacts: z.toJSONSchema(DerivedFactsSchema),
  decision: z.toJSONSchema(DecisionSchema),
  receiptEvent: z.toJSONSchema(ReceiptEventSchema),
  correction: z.toJSONSchema(CorrectionSchema),
  generatedEval: z.toJSONSchema(GeneratedEvalSchema),
  patch: z.toJSONSchema(PatchSchema),
  evalResult: z.toJSONSchema(EvalResultSchema),
} as const;
