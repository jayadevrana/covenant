Read docs/prompts/master-spec.md in full — it is the locked /goal specification for this project and this thread is the PRIMARY project thread for the hackathon.

For THIS run, execute milestones M0, M1, and M2 only, then stop with a gate report. Adjustments for non-interactive operation:

1. You are running via `codex exec` — there is no human at the keyboard mid-run. Never wait for input; when a small decision is ambiguous, take the documented default from the spec and log it in EVIDENCE.md.
2. Git is already initialized (branch `main`, author configured). Commit at every milestone gate exactly as the spec says. There is NO remote yet — do not push.
3. The OpenAI API key may not be present yet. Build M2 completely: compiler + correction-compiler modules, strict structured-output request shapes, Zod re-validation, retry-on-invalid path fully unit-tested against a mocked OpenAI client, and the `npm run smoke:openai` script ready. Then attempt the live smoke ONLY if `OPENAI_API_KEY` exists in the environment or in `.env.local`; if absent, print `SMOKE DEFERRED — no key present` in the gate report instead of failing. Do not block on it.
4. Spec §0 says to skim the two URLs before M2 — if you have no network access to those pages from the sandbox, skip the skim and note it; the spec's embedded API shapes in §2 are verified as of 2026-07-18 and are binding.
5. End the run by printing: a gate report for M0/M1/M2 (each gate's acceptance criteria with actual command output evidence, e.g. `npm test` summary), the list of commits made, any deviations taken with reasons, and what M3 needs from the human (nothing expected except the API key for the live smoke).

Work autonomously until M2's gate report is printed. Begin now.
