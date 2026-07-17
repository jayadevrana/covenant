import OpenAI from "openai";

import { hasOpenAIKey } from "./openai-env";

async function main() {
  if (!hasOpenAIKey()) {
    console.log("SMOKE DEFERRED — no key present");
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const candidates = ["gpt-5.6", "gpt-5.4", "gpt-5"];
  let lastError: unknown;

  for (const model of candidates) {
    try {
      const response = await client.responses.create({
        model,
        input: "Reply with exactly: OK",
        reasoning: { effort: "low" },
        max_output_tokens: 32,
      });
      console.log(`model=${response.model}`);
      console.log(`usage=${JSON.stringify(response.usage ?? null)}`);
      return;
    } catch (error) {
      lastError = error;
      const status = error instanceof OpenAI.APIError ? error.status : "unknown";
      const code = error instanceof OpenAI.APIError ? error.code : "unknown";
      const message = error instanceof Error ? error.message : String(error);
      console.error(`model=${model} status=${status} code=${code} error=${message}`);
      if (!/model|access|permission|not found/i.test(message)) break;
    }
  }

  throw lastError;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`smoke failed: ${message}`);
  process.exitCode = 1;
});
