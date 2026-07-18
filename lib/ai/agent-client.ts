import OpenAI from "openai";

import type { AgentResponsesClient } from "../agent";

export function createAgentResponsesClient(apiKey = process.env.OPENAI_API_KEY): AgentResponsesClient {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const openai = new OpenAI({ apiKey });
  return {
    responses: {
      create: (request) => openai.responses.create(request as never),
    },
  };
}
