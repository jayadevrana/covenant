import { describe, expect, it, vi } from "vitest";

import { goldenTrace, seedPolicy, seedPolicyText } from "../data/seed";
import {
  CorrectionCompilationJsonSchema,
  compileCorrection,
  compilePolicy,
  type ResponsesClient,
  type StructuredResponseRequest,
} from "../lib/ai";
import { PolicyJsonSchema } from "../lib/schemas";

function response(output: unknown, model = "gpt-5.6") {
  return {
    output_text: typeof output === "string" ? output : JSON.stringify(output),
    model,
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  };
}

function mockedClient(...outputs: Array<unknown | Error>) {
  const requests: StructuredResponseRequest[] = [];
  const create = vi.fn(async (request: StructuredResponseRequest) => {
    requests.push(structuredClone(request));
    const next = outputs.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const client: ResponsesClient = { responses: { create } };
  return { client, create, requests };
}

function assertStrictObjects(node: unknown, path = "schema"): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const schema = node as Record<string, unknown>;
  if (schema.type === "object") {
    expect(schema.additionalProperties, `${path}.additionalProperties`).toBe(false);
    const properties = (schema.properties ?? {}) as Record<string, unknown>;
    expect(new Set(schema.required as string[]), `${path}.required`).toEqual(
      new Set(Object.keys(properties)),
    );
  }
  for (const [key, child] of Object.entries(schema)) {
    if (key !== "additionalProperties") assertStrictObjects(child, `${path}.${key}`);
  }
}

describe("policy compiler", () => {
  it("sends the binding strict Responses API request and Zod-validates output", async () => {
    const mock = mockedClient(response(seedPolicy));
    const result = await compilePolicy({ client: mock.client, sourceText: seedPolicyText });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rules).toHaveLength(7);
    expect(result.model).toBe("gpt-5.6");
    expect(mock.requests[0]).toMatchObject({
      model: "gpt-5.6",
      reasoning: { effort: "low" },
      max_output_tokens: 2_000,
      text: { format: { type: "json_schema", name: "covenant_policy", strict: true } },
    });
    assertStrictObjects(mock.requests[0].text.format.schema);
  });

  it("automatically retries once after invalid output and appends validation details", async () => {
    const invalid = { ...seedPolicy, rules: [{ bad: true }] };
    const mock = mockedClient(response(invalid), response(seedPolicy));
    const result = await compilePolicy({ client: mock.client, sourceText: seedPolicyText });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attempts).toBe(2);
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(mock.requests[1].input).toHaveLength(3);
    expect(mock.requests[1].input[2].content[0].text).toContain("Validation error:");
  });

  it("returns a visible raw-output error after two invalid responses", async () => {
    const mock = mockedClient(response("not json"), response({ id: "still-invalid" }));
    const result = await compilePolicy({ client: mock.client, sourceText: seedPolicyText });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_model_output", rawOutput: '{"id":"still-invalid"}' },
      attempts: 2,
    });
  });

  it("turns SDK failures into graceful error objects", async () => {
    const mock = mockedClient(new Error("mock transport unavailable"));
    const result = await compilePolicy({ client: mock.client, sourceText: seedPolicyText });

    expect(result).toEqual({
      ok: false,
      error: { code: "api_error", message: "mock transport unavailable" },
      model: "gpt-5.6",
      attempts: 1,
    });
  });
});

describe("correction compiler", () => {
  it("returns a Zod-validated eval and proposed patch with a fully strict request schema", async () => {
    const correction = {
      id: "correction-1",
      run_id: "golden-run",
      action_id: goldenTrace[4].id,
      what_happened: "The full report was blocked.",
      what_should_have_happened: "Send a redacted summary.",
      author: "human" as const,
    };
    const compilation = {
      failure_class: "policy_gap",
      generated_eval: {
        id: "eval-correction-1",
        title: "Use a redacted partner summary",
        description: "Regression case from correction",
        trace: [goldenTrace[4]],
        expectations: [{ action_index: 0, expected_verdict: "block" }],
        origin: "correction",
        correction_id: correction.id,
      },
      candidate_patch: {
        id: "patch-correction-1",
        correction_id: correction.id,
        type: "rule_modify",
        rule: seedPolicy.rules[0],
        diff_summary: "Clarify redacted summaries",
        rationale: "Permit a safe alternative while retaining the leak block.",
        status: "proposed",
      },
      explanation: "The existing block is correct; the policy needs a safe redacted path.",
    };
    const mock = mockedClient(response(compilation));
    const result = await compileCorrection({
      client: mock.client,
      correction,
      policy: seedPolicy,
      selectedAction: goldenTrace[4],
      failureClass: "execution_error",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.generated_eval.correction_id).toBe(correction.id);
    expect(result.data.failure_class).toBe("execution_error");
    expect(result.data.candidate_patch.status).toBe("proposed");
    expect(mock.requests[0].text.format).toMatchObject({
      type: "json_schema",
      name: "covenant_correction",
      strict: true,
    });
    assertStrictObjects(CorrectionCompilationJsonSchema);
  });
});

describe("compiler JSON schemas", () => {
  it("keeps every object closed with all declared properties required", () => {
    assertStrictObjects(PolicyJsonSchema);
    assertStrictObjects(CorrectionCompilationJsonSchema);
  });
});
