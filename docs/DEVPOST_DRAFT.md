# Devpost draft — Covenant

## Submission fields

**Title:** Covenant

**Tagline:** Deterministic governance that turns every human correction into regression-tested agent immunity.

**Track:** Developer Tools

**Repository:** https://github.com/jayadevrana/covenant

**Demo URL:** https://covenant-umber.vercel.app

**Video URL:** `YOUTUBE_URL_PENDING`

## Short description

Covenant is a portable governance-and-immunity layer for tool-using AI agents. Plain-English rules become typed policy suggestions; a pure engine intercepts every proposed tool call before execution; hash-linked receipts record the action path; and each human correction becomes a generated regression eval plus an approval-gated policy patch. Deterministic before/after replay proves the fix and checks all prior cases before activation.

## The problem

Agent instructions are probabilistic, but tool side effects are real. A prompt saying “never leak customer data” is not an enforcement boundary, an audit log does not prevent execution, and a one-off human correction does not guarantee that the mistake stays fixed. Developers need a small layer that can stop unsafe tool calls, explain the decision, preserve evidence, and convert feedback into a verified policy change without letting the model approve its own work.

## What Covenant does

1. **Compile:** GPT-5.6 suggests a strict typed policy from plain-English governance rules. Zod validates the result after strict Structured Outputs.
2. **Intercept:** A pure TypeScript engine derives facts from tool arguments and returns allow, block, or require approval before the sandbox tool can execute.
3. **Prove:** Every proposal, decision, approval, execution, and skip joins an exportable SHA-256 hash-linked receipt chain.
4. **Immunize:** A human correction is classified, compiled into a generated eval and candidate rule patch, replayed deterministically against 12 seed evals plus the new case, and activated only after explicit human approval.

The one-click golden task yields allow ×3 → require approval → block. The blocked external customer-data send is execution-recorder proven never to invoke its tool. The correction flow moves from 12/13 passing before the patch to 13/13 after it with zero regressions and activates policy v2 only after approval.

## Judging criterion 1 — Technological Implementation

Covenant is a non-trivial full-stack implementation built through one primary Codex project thread. Its core is a pure policy engine with all condition operators tested, most-restrictive precedence, fail-closed behavior, deterministic derived facts, and no model or I/O in the decision path. The client-driven Responses API loop advances exactly one turn per request and routes every function call through the engine. Both compilers use strict closed JSON Schemas, mirrored Zod validation, one diagnostic retry, and visible raw-output failure. Receipt tampering, rejected patches, blocked execution, spend caps, and the 12-seed replay are test-covered. An in-repo Node.js SDK proves portability beyond the demo UI.

## Judging criterion 2 — Design

The product experience follows one coherent four-screen story: a landing page explains the loop; the control room shows a live decision timeline and approval modal; the receipt screen verifies and exports evidence; and the immunity lab presents the correction, generated eval, policy diff, before/after counts, regression grid, and approve/reject decision. `FIXTURE` and `LIVE · model-id` provenance is visible wherever data differs. Empty, loading, timeout, missing-key, session-expired, malformed-output, denied-action, and invalid-policy states fail visibly and recover toward fixture mode.

## Judging criterion 3 — Potential Impact

The target user is a developer shipping agents that can communicate, publish, or move data. Covenant addresses the gap between “the agent was instructed” and “the action was actually authorized.” It can reduce accidental side effects, make approvals payload-specific, give incident reviewers a tamper-evident export, and turn production corrections into repeatable regression coverage. The framework-neutral wrapper works anywhere Node.js tool execution can be intercepted.

The timing is concrete: the EU AI Act's record-keeping obligations (Article 12) begin applying to high-risk AI systems from August 2, 2026 — two weeks after this hackathon — and require automatically recorded, traceable event logs over a system's lifetime. Covenant's hash-linked, exportable action receipts and policy-versioned decisions are exactly the shape of evidence those audits ask for, produced as a side effect of normal agent operation rather than as an afterthought.

## Judging criterion 4 — Quality of the Idea

Policy engines, approval systems, eval platforms, and audit products exist separately. Covenant’s novel product unit is the complete correction-immunity transaction: a human describes what should have happened; GPT-5.6 proposes both a regression case and a typed rule change; the pure runtime engine proves the new case fails before and passes after; every prior eval replays; and a human decides whether policy version two exists. The model cannot silently edit its own guardrail.

## How Codex and GPT-5.6 were used

Codex implemented the project milestone by milestone from a locked human-authored specification in the primary project thread. It accelerated mirrored schema implementation, exhaustive condition tests, API/UI wiring, mocked Responses API coverage, execution-recorder proof, receipt canonicalization and tamper tests, the correction replay runner, Playwright automation, SDK extraction, deployment controls, and submission auditing. The human made the product, scope, compliance, model-routing, cost, persistence, approval, and gate decisions and independently verified each milestone before committing.

GPT-5.6 has three bounded product roles: policy compilation, one-turn agent tool proposals, and correction compilation. GPT-5.6-terra performs cheap failure classification. Every model output is schema constrained and Zod validated. No model participates in runtime policy evaluation or before/after eval verification.

## Built with

- OpenAI Responses API
- GPT-5.6 and GPT-5.6-terra
- Codex
- Next.js 15, React 19, TypeScript, Tailwind CSS
- Zod, Vitest, Playwright
- Vercel
- `@noble/hashes` for portable SHA-256

## Testing path

Use the public demo with no login or key and follow `docs/JUDGE_CARD.md`. For the SDK proof:

```bash
git clone https://github.com/jayadevrana/covenant.git
cd covenant
npm ci
npx tsx examples/minimal-agent.ts
```

All sample data is fictional and all tools are sandboxed in memory. Sessions are ephemeral by design.
