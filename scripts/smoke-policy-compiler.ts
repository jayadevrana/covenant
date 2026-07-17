import OpenAI from "openai";

import { seedPolicyText } from "../data/seed";
import { compilePolicy, type ResponsesClient } from "../lib/ai";
import { hasOpenAIKey } from "./openai-env";

async function main() {
  if (!hasOpenAIKey()) {
    console.log("SMOKE DEFERRED — no key present");
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const client: ResponsesClient = {
    responses: {
      create: (request) => openai.responses.create(request as never),
    },
  };
  const result = await compilePolicy({ client, sourceText: seedPolicyText });

  if (!result.ok) {
    throw new Error(`code=${result.error.code} message=${result.error.message}`);
  }

  console.log(`model=${result.model}`);
  console.log(`usage=${JSON.stringify(result.usage)}`);
  console.log(`rules=${result.data.rules.length}`);

  if (result.data.rules.length !== 7) throw new Error("compiler did not return seven rules");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`compiler smoke failed: ${message}`);
  process.exitCode = 1;
});
