# Covenant

Covenant is a governance-and-immunity layer for tool-using AI agents. It compiles plain-English rules into typed policies, deterministically intercepts tool calls, emits hash-linked receipts, and turns human corrections into regression evals plus approval-gated policy patches.

Created 2026-07-18 during the OpenAI Build Week submission period (Jul 13–21, 2026).

## Status

Milestones M0–M2 are implemented. The deterministic policy engine is the runtime authority; model-generated compiler output is always a suggestion and policy changes require human approval.

- `lib/engine/` is pure TypeScript: deterministic condition evaluation, derived facts, and canonical SHA-256 hashing.
- `lib/ai/` contains server-oriented, dependency-injected policy and correction compilers using the Responses API with strict Structured Outputs and mirrored Zod validation.
- Invalid compiler output is retried once with validation details, then returned as a visible error object with the raw output.
- `data/seed.ts` contains the seven-rule compiled fixture and golden trace for keyless demo mode.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm test
npm run lint
npm run build
npm run smoke:openai
```

`smoke:openai` loads the server-side key from the environment or `.env.local`; when absent it exits successfully with `SMOKE DEFERRED — no key present`. A live run on 2026-07-18 resolved `gpt-5.6` to `gpt-5.6-sol`.

Canonical hashes encode UTF-8 stable JSON: object keys are recursively sorted, arrays retain order, `-0` is normalized to `0`, and undefined or non-finite values are rejected.

## Integrity and limitations

- Receipts are SHA-256 hash-linked and tamper-evident within an export; they are not cryptographic signatures.
- Fixture data is labeled `FIXTURE`; real model calls are labeled `LIVE · <model-id>`.
- Covenant is a prototype safety layer. In-process SDK enforcement is bypassable by code that does not route through it, and it is not proof that agents are universally safe.

## License

MIT
