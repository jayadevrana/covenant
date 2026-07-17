/goal Build "Covenant" — a complete, submission-ready OpenAI Build Week 2026 entry (Developer Tools track) — by working autonomously through the milestones below.

## 0. Role, provenance, and authority
You are the primary implementer. This thread is the PRIMARY PROJECT THREAD: the hackathon requires a `/feedback` Codex Session ID from the thread where the majority of core functionality was built — that is THIS thread, so all core implementation happens here. The concept is locked; do not redesign the product. The human (Jayadev Rana) decides scope changes, approves anything ambiguous about submission compliance, and reviews at milestone gates. Ask him only when a decision materially changes scope, cost, or compliance — otherwise proceed on the documented defaults. Before starting M2, skim https://openai.devpost.com/rules and https://developers.openai.com/api/docs/guides/structured-outputs — if anything there contradicts this document, STOP and flag it; never silently deviate.

Deadline context: submissions close Tue July 21, 2026 5:00 PM PDT. Internal target: everything in the Definition of Done true by Mon July 20, 11:00 PM IST.

## 1. What you are building (locked)
**Covenant** — a governance-and-immunity layer for tool-using AI agents.

One-sentence pitch: Covenant compiles plain-English rules into a typed policy, deterministically intercepts every agent tool call before execution (allow / block / require-approval), emits hash-linked action receipts, and converts each human correction into a regression eval plus an approval-gated policy patch — proving, before activation, that the same mistake can never silently happen again.

The four-part loop IS the product. Part 4 (correction → eval + patch → deterministic before/after proof) is the hero feature — build it best. Everything is a web app around a pure library; the SDK is a supporting artifact, not the pitch.

Product-integrity rules baked into UI copy and README:
- Never claim cryptographic signatures. Receipts are SHA-256 hash-linked and exportable: say "tamper-evident within the export", nothing stronger.
- Fixture data is labeled `FIXTURE`; real model calls are labeled `LIVE · <model-id>`. Never disguise fixtures as live inference.
- The policy compiler and correction compiler are GPT-5.6 *suggestions*; only the deterministic engine decides at runtime; only the human activates policy changes. The UI visually distinguishes: compiler suggestion → deterministic decision → human approval.
- No third-party brand names, logos, or trademarks anywhere in the UI (the demo video must not show trademarks). Mock tools use generic names.
- State limitations honestly on the landing page: prototype safety layer; in-process SDK enforcement is bypassable by code that doesn't route through it; not proof that agents are universally safe.

## 2. Verified platform facts (as of 2026-07-18 — use these, do not re-derive)
- Model IDs: `gpt-5.6` (alias routing to `gpt-5.6-sol`), `gpt-5.6-sol` (flagship), `gpt-5.6-terra` (cheaper), `gpt-5.6-luna` (cheapest). There are NO mini/nano variants.
- Use the **Responses API** for the agent loop and both compilers. `reasoning: { effort: "low" | "medium" | "high" }` is supported (model-dependent).
- Structured Outputs (Responses API): `text: { format: { type: "json_schema", strict: true, schema: {...} } }`. Every schema object needs `additionalProperties: false` and all fields in `required`.
- Function calling: tools array entries `{ type: "function", name, description, parameters, strict: true }`; `tool_choice: "auto"`.
- Do NOT use the hosted OpenAI Evals platform (being deprecated, read-only Oct 31 2026). Our eval runner is our own code.
- Do NOT use Programmatic Tool Calling, multi-agent beta, or persisted reasoning — not needed for the MVP; reliability first.
- Model routing for cost: agent loop + policy compiler + correction compiler → `gpt-5.6` (effort low or medium, `max_output_tokens` ≤ 2000 per turn). Cheap classification (failure class) → `gpt-5.6-terra`. Whole-project API budget < $15.
- FIRST ACTION of M2: one tiny live sanity call to confirm the key works and `gpt-5.6` is accessible; print model id + usage. If unavailable on this account, report the exact API error, fall back to the best available GPT-5.x, and record the substitution in EVIDENCE.md and README.

## 3. Stack (change only with a documented reason in EVIDENCE.md)
- Next.js 15 App Router + TypeScript strict + Tailwind. shadcn/ui allowed for speed.
- Persistence: better-sqlite3 for local dev. For deployment choose ONE, reliability first: (a) Turso/libSQL free tier, or (b) in-memory per-session store seeded with demo data, honestly labeled "sandbox sessions are ephemeral". Do not burn >1 hour on database plumbing — option (b) is fully acceptable for judges.
- OpenAI official Node SDK, **server-side only**. Key from `process.env.OPENAI_API_KEY`. Ship `.env.example` with placeholder only. Never log or commit the key; add `.env*` to .gitignore in M0.
- Zod schemas mirroring every JSON Schema; every model output is Zod-validated after strict mode (belt and suspenders). On invalid: one automatic retry with the validation error appended; then a visible error state with raw output shown.
- Tests: Vitest (unit + integration with mocked OpenAI client). One Playwright smoke test walking the golden path in demo mode.
- Deploy: Vercel. The agent loop is CLIENT-DRIVEN: each `POST /api/run/step` executes exactly ONE model turn and returns the timeline delta (avoids serverless timeouts, gives a live-updating UI).
- Architecture rule: the policy engine is a PURE TypeScript library in `lib/engine/` — zero I/O, zero LLM calls, zero Date.now inside decision logic (timestamps passed in). It runs identically in live interception and eval replay.

## 4. Core schemas (implement as JSON Schema + mirrored Zod; field names are binding)
```ts
// Policy
{ id, version: number, title, source_text: string, rules: Rule[] }
// Rule
{ id, description, effect: "allow"|"block"|"require_approval",
  scope: { tools: string[] },            // "*" allowed
  condition: Cond | null,                 // null = always matches within scope
  risk: "low"|"medium"|"high", enforcement: "enforce"|"log_only", rationale: string }
// Cond — deterministic predicate tree
{ all?: Cond[], any?: Cond[], not?: Cond,
  field?: string,   // dot-path into { tool, args, derived }
  op?: "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"contains"|"not_contains"|"in"|"not_in"|"matches"|"count_gt"|"count_lte",
  value?: any }
// ProposedAction
{ id, run_id, step: number, tool: string, args: object, purpose: string }
// derived facts — computed by deterministic TS (lib/engine/derive.ts), NEVER by the model:
{ recipient_count, external_domains: string[], contains_customer_data: boolean, data_classes: string[], attachment_names: string[] }
// Decision
{ action_id, verdict: "allow"|"block"|"require_approval", matched_rule_ids: string[], explanation, policy_version, engine_version, timestamp }
// ReceiptEvent
{ seq, run_id, type: "task_started"|"model_call"|"action_proposed"|"decision"|"approval"|"tool_executed"|"tool_skipped"|"correction"|"error",
  payload: object, payload_hash, prev_hash, timestamp }   // sha256(canonical JSON); genesis prev_hash = "0".repeat(64)
// Correction
{ id, run_id, action_id, what_happened, what_should_have_happened, author: "human" }
// GeneratedEval
{ id, title, description, trace: ProposedAction[],        // captured or synthesized action trace
  expectations: { action_index: number, expected_verdict: "allow"|"block"|"require_approval" }[],
  origin: "correction"|"seed", correction_id?: string }
// Patch
{ id, correction_id, type: "rule_add"|"rule_modify", rule: Rule, diff_summary: string,
  rationale, status: "proposed"|"approved"|"rejected" }
// EvalResult
{ eval_id, policy_version, passed: boolean, per_expectation: { action_index, expected, actual, pass }[] }
```
Engine semantics: evaluate rules in order block > require_approval > allow when multiple match (most restrictive wins); no rule matched → allow with `matched_rule_ids: []` and an "unmatched" note; any engine exception → **block (fail closed)** with the error in the explanation. `log_only` rules record the match but never change the verdict.

## 5. Sandbox world (all mocked — no real email, files, or network side effects, ever)
Mock tools (generic names): `search_customers`, `read_document`, `draft_email`, `send_email`, `export_records`, `publish_report`. Each is a TS function over seeded fixture data returning realistic JSON; `send_email`/`publish_report`/`export_records` only append to the sandbox outbox/log — nothing leaves the process.
Seed data (`data/seed.ts`): 12 fake customers (obviously fake domains like `@customer-eleven.example`), 3 documents including `q2_usage_report` which embeds customer emails (so it derives `contains_customer_data: true`), one external partner contact `ben@partnerco.example`.
Seed policy (7 rules, compiled output shipped as fixture AND re-compilable live): includes "Never send customer data to an external domain" (block), "Any action contacting more than 5 people requires approval" (require_approval), "Never publish reports without approval" (require_approval), plus 4 sensible allows/log_only rules.
Golden demo task (seeded as one click): *"Email each customer affected by the July 12 outage an apology with their usage summary, and send the full incident report to our partner at PartnerCo."* Expected live behavior: several ALLOW steps → one REQUIRE_APPROVAL (bulk send to 8 customers) → one BLOCK (send_email to ben@partnerco.example with the customer-data report attached) → task completes compliantly after the human approves the bulk send; the leak never executes.

## 6. The immunity loop (hero feature)
Correction flow: user selects the blocked (or any decided) step → types what should have happened (seed suggestion: "It should have sent PartnerCo a redacted summary with customer data removed") → one `gpt-5.6` structured-output call returns `{ failure_class, generated_eval, candidate_patch, explanation }` → UI shows the eval + patch as a reviewable diff → human clicks Approve → policy version bumps, patch recorded.
Eval mechanics — deterministic, no LLM in the verification path: the runner replays each GeneratedEval's `trace` through the PURE engine against a given policy version and compares verdicts to `expectations`. Before-patch: failing case red. After-patch: green — and ALL evals (seeded 12 + generated) re-run to prove zero regressions. Big before/after panel with pass counts. Ship 12 seed evals covering the seed policy so the regression grid is meaningful on day one.
Optional garnish (only if M0–M8 all green): one live agent re-run after the patch, labeled LIVE.

## 7. Receipts
Append every ReceiptEvent to the run's hash chain (payload_hash = sha256 of RFC-8785-style canonicalized JSON — a stable stringify with sorted keys is acceptable; document the exact canonicalization). Receipt screen: readable event chain, chain head hash, Verify button that re-walks the chain in the browser, Export JSON. `lib/receipts/verify.ts` is importable by the SDK example. Tests: verification passes on a genuine export; flipping one byte fails it.

## 8. SDK surface (Dev Tools track compliance: install instructions + supported platforms + judge test path)
`sdk/` in-repo package (npm publish NOT required): `withCovenant(tools, policy, hooks)` — a ~100-line TS wrapper that intercepts any `{name, execute}` tool map, consults the engine, calls `hooks.onApprovalNeeded`, and appends receipt events. Plus `examples/minimal-agent.ts` runnable with `npx tsx`, using the same engine — proof of portability. README gets an Integrate section: install (clone + `npm i`), supported platforms (Node ≥ 20, any agent framework that lets you wrap tool execution), copy-paste snippet.

## 9. Milestones with acceptance gates
Work strictly in order; keep a visible plan with exactly ONE task in progress; commit at every gate with a conventional message; update EVIDENCE.md at every gate (row: timestamp, task, human decision, Codex contribution, commit SHA, test evidence, demo-worthy moment). Git author: `jayadevrana <bluealgocapital@gmail.com>`. NO AI co-author trailers.

- **M0 — Scaffold + hygiene.** `git init`; Next.js 15 TS Tailwind scaffold; MIT LICENSE; `.gitignore` (incl. `.env*`); `.env.example`; README skeleton with dated line "Created 2026-07-18/19 during the OpenAI Build Week submission period (Jul 13–21, 2026)"; EVIDENCE.md ledger table. **Gate:** `npm run dev` serves; first commit pushed.
- **M1 — Pure engine.** `lib/engine/` (evaluate, derive, canonical hash util) + all schemas + Zod mirrors. **Gate:** `npm test` green with: every Cond op tested; most-restrictive-wins; unmatched→allow; thrown-error→block (fail closed); log_only never changes verdict; seed policy × golden trace produces the expected allow/require_approval/block sequence.
- **M2 — OpenAI layer.** `lib/ai/`: policy compiler + correction compiler using Responses API strict structured outputs; Zod re-validation; one auto-retry on invalid with the validation error appended; graceful error objects (never throw raw into UI). `npm run smoke:openai` = one tiny live call printing model id + token usage. **Gate:** smoke passes live; invalid-output retry path unit-tested with a mocked client; compiler turns the 7-rule seed text into a valid Policy live (also stored as fixture for demo mode).
- **M3 — Sandbox agent + control room.** Agent loop (Responses API + function calling, client-driven one turn per `/api/run/step`); every proposed tool call routed through the engine BEFORE execution; timeline UI with allow/block/require_approval chips; approval modal (approve/deny feeds back to the agent); blocked/denied tools return a structured refusal to the model so it can adapt. **Gate:** golden task runs live end-to-end producing all three verdicts; a test asserts via an execution recorder that a blocked tool's `execute` is NEVER invoked.
- **M4 — Receipts.** Chain, screen, verify, export. **Gate:** tamper test red/green as specified in §7.
- **M5 — Immunity loop.** Correction form → generated eval + patch → diff review → approve → version bump → deterministic replay before/after panel → full regression grid (12 seed evals + generated). **Gate:** live demo of §6 works; before ✗ / after ✓ with 0 regressions; a rejected patch changes nothing (test).
- **M6 — UX + reliability pass.** Landing page that explains the product in ≤15 seconds of reading; loading/empty/error states everywhere; FIXTURE vs LIVE badges; demo mode works with NO API key (fixtures); keyboard focus + AA contrast; the two failure paths (missing key/timeout banner; invalid model output surface). **Gate:** Playwright smoke walks the full golden path in demo mode headless, green.
- **M7 — SDK + example + Integrate docs** (§8). **Gate:** `npx tsx examples/minimal-agent.ts` demonstrates a block + receipt in terminal output.
- **M8 — Ship.** Deploy to Vercel: demo mode keyless; live mode server-key with per-session caps (max 3 live runs/session, `max_output_tokens` caps, `DAILY_SPEND_KILL=1` env kill-switch honored). Complete README: setup from fresh clone, sample data, testing instructions, architecture diagram (Mermaid fine), Related Work paragraph (honest prior-art: AWS AgentCore Policy, Invariant/Snyk, HumanLayer, Latitude, Trinitite, Progent paper — and exactly what Covenant does that they don't), "How GPT-5.6 is integrated" map (3 surfaces), "How Codex built this" narrative + human-decision log, license/asset inventory (no third-party assets beyond OSS deps). Produce: `docs/JUDGE_CARD.md` (demo URL, 90-second test script, expected results, troubleshooting), `docs/DEMO_SCRIPT.md` (165-second beat sheet matching §5 golden path), `docs/DEVPOST_DRAFT.md` (description mapped to the four judging criteria). **Gate:** fresh-clone README walkthrough works; deployed URL passes the golden path in a clean browser; the full Definition of Done below printed with per-item evidence.

## 10. Definition of done (print this checklist with evidence at the end; every box must be genuinely true)
- Stranger understands the product in 15 seconds on the landing page.
- Golden path works from a fresh browser session on the DEPLOYED url, demo mode (no key) and live mode.
- At least one action allowed, one blocked, one requiring approval in the golden run.
- A blocked action cannot execute through the normal tool path (test-proven).
- Correction → valid reviewable eval + patch; nothing activates without human approval; rejected patch changes nothing.
- Failing case passes after patch; all prior evals still pass; shown in UI.
- Every model output schema-validated; invalid path visible, not silent.
- Fixtures labeled FIXTURE; live labeled LIVE with model id.
- Graceful states: missing key, timeout, malformed output, invalid policy, denied action.
- No secrets/PII in repo, logs, or UI; `.env.example` only; no third-party trademarks in UI.
- README + JUDGE_CARD + DEMO_SCRIPT + DEVPOST_DRAFT complete; fresh-clone setup verified.
- `npm test` and Playwright smoke green at HEAD; EVIDENCE.md current through M8.

## 11. Working agreement
- Run the app and LOOK at it after every meaningful UI change; screenshot at each milestone gate for EVIDENCE.md.
- Write the tests for a feature before declaring the feature complete. Never fabricate test output, usage numbers, or evidence — if a gate fails, report it and fix it.
- Do not add features beyond this document. Ahead of schedule → deepen tests and polish, not scope.
- Cut-first list if behind: M7 SDK example → live-rerun garnish → landing polish → Turso (switch to in-memory). NEVER cut: golden path, the immunity loop, receipts verify, the blocked-action guarantee test.
- Blocked on something only the human can do (API key missing, Vercel account, model access)? Pause, state exactly what's needed and the one-line command/click to do it, then continue on whatever isn't blocked.
- Stop only when the Definition of Done is objectively satisfied or a genuine blocker requires human authority.

Begin with M0 now.

