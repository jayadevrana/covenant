# Covenant

Covenant is a governance-and-immunity layer for tool-using AI agents. It compiles plain-English rules into typed policies, deterministically intercepts tool calls, emits hash-linked receipts, and turns human corrections into regression evals plus approval-gated policy patches.

Created 2026-07-18 during the OpenAI Build Week submission period (Jul 13–21, 2026).

## Status

Milestones M0–M7 are implemented. The deterministic policy engine is the runtime authority; model-generated compiler output is always a suggestion and policy changes require human approval.

- `lib/engine/` is pure TypeScript: deterministic condition evaluation, derived facts, and canonical SHA-256 hashing.
- `lib/ai/` contains server-oriented, dependency-injected policy and correction compilers using the Responses API with strict Structured Outputs and mirrored Zod validation.
- Invalid compiler output is retried once with validation details, then returned as a visible error object with the raw output.
- `data/seed.ts` contains the seven-rule compiled fixture and golden trace for keyless demo mode.
- `lib/agent/` runs exactly one model turn per client-driven step and intercepts every proposed tool call before sandbox execution.
- `lib/receipts/` emits and verifies SHA-256 hash-linked event exports.
- `lib/immunity/` replays 12 seed evals plus generated correction cases through the pure engine with no model in the verification path.
- `sdk/` provides the framework-neutral `withCovenant(tools, policy, hooks)` interception wrapper.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or choose another port with `npm run dev -- --port 3010`.

## Integrate

The SDK is an in-repo TypeScript package for Node.js 20 or newer. It works with any agent framework that lets application code wrap tool execution. From a clone of this repository:

```bash
npm install
```

Wrap the tool map, pass a typed policy, and give approval-gated calls an explicit human callback. If the callback is absent, approval defaults to denied.

```ts
import { seedPolicy } from "./data/seed";
import { withCovenant } from "./sdk";

const covenant = withCovenant(
  {
    send_email: {
      name: "send_email",
      execute: async (args) => sandboxSend(args),
    },
  },
  seedPolicy,
  {
    onApprovalNeeded: async (action, decision) => showApproval(action, decision),
  },
);

const result = await covenant.tools.send_email.execute({
  recipients: ["reviewer@external.example"],
  data_classes: ["customer_data"],
});

console.log(result);                    // result or structured refusal
console.log(covenant.verifyReceipts()); // re-walk the hash chain
```

The web API keeps transport request bodies in camelCase while binding domain objects such as `Policy`, `Decision`, and `Correction` retain their specified snake_case fields:

| Endpoint | Request JSON |
|---|---|
| `POST /api/run/start` | `{ task, mode: "fixture" | "live" }` |
| `POST /api/run/step` | `{ runId }` |
| `POST /api/run/approval` | `{ runId, approved: boolean }` |
| `POST /api/correction/compile` | `{ runId, actionId, whatShouldHaveHappened }` |
| `POST /api/correction/decision` | `{ runId, decision: "approve" | "reject" }` |

Run the portable proof without an API key:

```bash
npx tsx examples/minimal-agent.ts
```

## Verification

```bash
npm test
npx playwright install chromium
npm run test:e2e
npx tsx examples/minimal-agent.ts
npm run lint
npm run build
npm run smoke:openai
npm run smoke:agent
npm run smoke:immunity
```

`smoke:openai` loads the server-side key from the environment or `.env.local`; when absent it exits successfully with `SMOKE DEFERRED — no key present`. A live run on 2026-07-18 resolved `gpt-5.6` to `gpt-5.6-sol`.

Canonical hashes encode UTF-8 stable JSON: object keys are recursively sorted, arrays retain order, `-0` is normalized to `0`, and undefined or non-finite values are rejected.

## Integrity and limitations

- Receipts are SHA-256 hash-linked and tamper-evident within an export; they are not cryptographic signatures.
- Fixture data is labeled `FIXTURE`; real model calls are labeled `LIVE · <model-id>`.
- Covenant is a prototype safety layer. In-process SDK enforcement is bypassable by code that does not route through it, and it is not proof that agents are universally safe.

## License

MIT
