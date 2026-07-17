import type { z } from "zod";

export const DEFAULT_AI_MODEL = "gpt-5.6";
export const MAX_COMPILER_OUTPUT_TOKENS = 2_000;

export interface ResponsesClient {
  responses: {
    create(request: StructuredResponseRequest): Promise<unknown>;
  };
}

export interface StructuredResponseRequest {
  model: string;
  reasoning: { effort: "low" | "medium" | "high" };
  max_output_tokens: number;
  input: Array<{
    role: "system" | "user";
    content: Array<{ type: "input_text"; text: string }>;
  }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: Record<string, unknown>;
    };
  };
}

export type CompilerErrorCode =
  | "api_error"
  | "empty_output"
  | "invalid_input"
  | "invalid_model_output";

export type CompilerResult<T> =
  | {
      ok: true;
      data: T;
      model: string;
      usage: unknown;
      attempts: number;
      rawOutput: string;
    }
  | {
      ok: false;
      error: {
        code: CompilerErrorCode;
        message: string;
        rawOutput?: string;
        validationIssues?: string;
      };
      model: string;
      attempts: number;
    };

export interface CompileStructuredOptions<T> {
  client: ResponsesClient;
  model?: string;
  formatName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort?: "low" | "medium";
}

type ResponseShape = {
  output_text?: unknown;
  model?: unknown;
  usage?: unknown;
  output?: Array<{
    content?: Array<{ type?: unknown; text?: unknown }>;
  }>;
};

function extractOutputText(response: ResponseShape): string | null {
  if (typeof response.output_text === "string" && response.output_text.length > 0) {
    return response.output_text;
  }

  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function validationMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function makeRequest<T>(options: CompileStructuredOptions<T>): StructuredResponseRequest {
  return {
    model: options.model ?? DEFAULT_AI_MODEL,
    reasoning: { effort: options.reasoningEffort ?? "low" },
    max_output_tokens: MAX_COMPILER_OUTPUT_TOKENS,
    input: [
      { role: "system", content: [{ type: "input_text", text: options.systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: options.userPrompt }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: options.formatName,
        strict: true,
        schema: options.jsonSchema,
      },
    },
  };
}

/**
 * Execute one strict Structured Outputs request and retry once only when the
 * returned JSON cannot be parsed or fails the mirrored Zod schema.
 */
export async function compileStructured<T>(
  options: CompileStructuredOptions<T>,
): Promise<CompilerResult<T>> {
  const request = makeRequest(options);
  let lastRawOutput: string | undefined;
  let lastValidationIssue: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let response: ResponseShape;
    try {
      response = (await options.client.responses.create(request)) as ResponseShape;
    } catch (error) {
      return {
        ok: false,
        error: { code: "api_error", message: validationMessage(error) },
        model: request.model,
        attempts: attempt,
      };
    }

    const rawOutput = extractOutputText(response);
    if (rawOutput === null) {
      return {
        ok: false,
        error: { code: "empty_output", message: "The model response contained no output text." },
        model: typeof response.model === "string" ? response.model : request.model,
        attempts: attempt,
      };
    }
    lastRawOutput = rawOutput;

    try {
      const parsedJson: unknown = JSON.parse(rawOutput);
      const parsed = options.zodSchema.safeParse(parsedJson);
      if (parsed.success) {
        return {
          ok: true,
          data: parsed.data,
          model: typeof response.model === "string" ? response.model : request.model,
          usage: response.usage ?? null,
          attempts: attempt,
          rawOutput,
        };
      }
      lastValidationIssue = parsed.error.message;
    } catch (error) {
      lastValidationIssue = validationMessage(error);
    }

    if (attempt === 1) {
      request.input.push({
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Your previous output was invalid. Return a corrected object that exactly matches the schema. Validation error: ${lastValidationIssue}`,
          },
        ],
      });
    }
  }

  return {
    ok: false,
    error: {
      code: "invalid_model_output",
      message: "The model returned invalid structured output twice.",
      rawOutput: lastRawOutput,
      validationIssues: lastValidationIssue,
    },
    model: request.model,
    attempts: 2,
  };
}
