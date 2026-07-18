# Covenant 165-second demo script

Recording constraint: show only the Covenant UI and terminal. Do not show browser chrome, bookmarks, notifications, other applications, or third-party marks. Use the seeded fixture unless a shot explicitly says LIVE.

## 0:00–0:15 — The problem and promise

**Screen:** Landing page, centered on the headline and four loop cards.

**Voiceover:** “Tool-using agents can turn one mistaken judgment into a real side effect. Covenant is a governance and immunity layer: it compiles rules, intercepts every tool call deterministically, proves what happened with hash-linked receipts, and turns human corrections into regression-tested policy patches.”

**Action:** Point across Compile, Intercept, Prove, Immunize. Click **Launch golden task**.

## 0:15–0:48 — Intercept before execution

**Screen:** Run control room.

**Voiceover:** “Fixture mode is fully keyless and honestly labeled. Each client request advances one agent turn. The model or fixture may propose an action, but only the pure TypeScript engine decides whether it can run.”

**Action:** Click **Run seeded fixture**. Let three ALLOW chips arrive.

**Voiceover:** “Read-only search, document access, and drafting are allowed.”

**Action:** Pause on REQUIRE APPROVAL.

**Voiceover:** “A bulk send to eight fictional customers requires a human checkpoint. The tool has not executed.”

**Action:** Approve.

## 0:48–1:08 — The blocked leak

**Screen:** Timeline completes with BLOCK.

**Voiceover:** “Next, the agent proposes sending a customer-data incident report to an external partner. Derived facts identify the external domain and customer data. Covenant blocks it before execution and returns a structured refusal so the agent can adapt. An execution-recorder test proves this tool path is never invoked.”

**Action:** Expand the blocked action briefly, then click **Inspect receipt chain**.

## 1:08–1:28 — Tamper-evident receipts

**Screen:** Receipt chain.

**Voiceover:** “Every proposal, decision, approval, execution, and skip joins one SHA-256 hash-linked chain. It is tamper-evident within the export—not a cryptographic signature.”

**Action:** Click **Verify chain**; show the green result and head hash. Point to **Export JSON**. Open **Immunity**.

## 1:28–2:18 — Correction becomes immunity

**Screen:** Correction immunity lab.

**Voiceover:** “A block can be correct while the agent’s recovery is incomplete. The human says it should send a redacted public summary instead. GPT-5.6 can suggest a generated eval and a narrow typed policy patch, but neither is trusted automatically.”

**Action:** Click **Generate eval + patch**. Show the compiler-suggestion badge and diff.

**Voiceover:** “The deterministic runner replays all 12 seed evals plus the new case with no model in the verification path. Before the patch, 12 of 13 pass. After the proposed patch, 13 of 13 pass with zero prior regressions.”

**Action:** Scroll through the regression grid. Pause before the approval buttons.

**Voiceover:** “This is still only a suggestion. Reject changes nothing.”

**Action:** Click **Approve + activate v2**.

**Voiceover:** “Only this human action activates policy version two and permanently adds the correction-derived regression.”

## 2:18–2:40 — Portable developer surface

**Screen:** Terminal in the repository.

**Action:** Run `npx tsx examples/minimal-agent.ts`.

**Voiceover:** “Covenant is also a small framework-neutral wrapper for Node.js. The same engine blocks the underlying tool, emits four linked receipt events, and verifies the chain.”

**Highlight:** `verdict=block`, `tool_executed=false`, `receipt_valid=true`.

## 2:40–2:45 — Close

**Screen:** Return to the landing headline.

**Voiceover:** “Covenant makes every action accountable—and every correction testable before it becomes policy.”
