import OpenAI from "openai";

import type { ResponsesClient } from "./structured";

export function createCompilerResponsesClient(
  apiKey = process.env.OPENAI_API_KEY,
): ResponsesClient {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const openai = new OpenAI({ apiKey });
  return {
    responses: {
      create: (request) => openai.responses.create(request as never),
    },
  };
}
