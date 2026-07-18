import { z } from "zod";

import type { Correction, ProposedAction } from "../schemas";
import { failureClasses } from "./correction-compiler";
import { compileStructured, type CompilerResult, type ResponsesClient } from "./structured";

export const FailureClassificationSchema = z
  .object({ failure_class: z.enum(failureClasses) })
  .strict();
export type FailureClassification = z.infer<typeof FailureClassificationSchema>;

export const FailureClassificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["failure_class"],
  properties: { failure_class: { type: "string", enum: failureClasses } },
} as const;

export function classifyFailure(options: {
  client: ResponsesClient;
  correction: Correction;
  selectedAction: ProposedAction;
}): Promise<CompilerResult<FailureClassification>> {
  return compileStructured({
    client: options.client,
    model: "gpt-5.6-terra",
    formatName: "covenant_failure_class",
    jsonSchema: FailureClassificationJsonSchema as unknown as Record<string, unknown>,
    zodSchema: FailureClassificationSchema,
    systemPrompt: "Classify the correction into exactly one governance failure class. Return only the strict object.",
    userPrompt: JSON.stringify({
      correction: options.correction,
      selected_action: options.selectedAction,
    }),
    reasoningEffort: "low",
    maxOutputTokens: 200,
  });
}
