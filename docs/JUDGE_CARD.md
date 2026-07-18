# Covenant judge card

- Track: Developer Tools
- Live demo: https://covenant-umber.vercel.app
- Source: https://github.com/jayadevrana/covenant
- Login: none
- API key: not required for the recommended test
- Browser: current desktop Chrome, Firefox, or Safari

## 90-second test

| Time | Action | Expected result |
|---:|---|---|
| 0–10s | Open the demo. Read the headline and four cards. Click **Launch golden task**. | The compile → intercept → prove → immunize loop is understandable without setup. |
| 10–30s | Click **Run seeded fixture**. Watch the timeline until the approval dialog appears. | A `FIXTURE` badge is visible. Three ALLOW decisions arrive, then REQUIRE APPROVAL. No real model or external tool is used. |
| 30–42s | Click **Approve sandbox action**. | The approved bulk sandbox send executes; the following external customer-data send is BLOCKED and explicitly skipped. Status becomes completed. |
| 42–55s | Click **Inspect receipt chain**, then **Verify chain**. | Verification reports the chain intact. The head hash and Export JSON control are visible. |
| 55–78s | Open **Immunity**. Keep the prefilled blocked step and correction, then click **Generate eval + patch**. | A `FIXTURE` compiler suggestion, generated eval, typed rule diff, 12/13 before panel, 13/13 after panel, and zero-regression grid appear. |
| 78–90s | Click **Approve + activate v2**. | Policy v2 becomes active with 13/13 evals passing. Nothing activated before this click. |

## Expected golden verdicts

```text
allow → allow → allow → require_approval → block
blocked external send executed: false
immunity before: 12/13
immunity after: 13/13
seed regressions: 0
active policy after approval: v2
```

## Optional developer-tool proof

From a clone with Node.js 20+:

```bash
npm ci
npx tsx examples/minimal-agent.ts
```

Expected terminal lines include `verdict=block`, `tool_executed=false`, and `receipt_valid=true`.

To automate the same clean-browser path against production:

```bash
PLAYWRIGHT_BASE_URL=https://covenant-umber.vercel.app npm run test:e2e
```

## Troubleshooting

- **Sandbox session expired — start a fresh run:** the demo intentionally uses ephemeral in-memory sessions. Return to **Control room** and start a new fixture run.
- **Missing server API key:** only live mode needs a key. Choose **Run seeded fixture**; the complete judged path remains available.
- **Live limit reached:** each browser session permits at most three live starts. Fixture mode remains unlimited.
- **Live mode temporarily disabled:** the spend kill switch is active. Use fixture mode.
- **Request timed out:** retry or start a fresh fixture run. Each agent step is a separate client-driven request.
- **Invalid model output:** live compiler errors show the validation failure and raw output after one automatic retry. Fixture mode is unaffected.
- **Receipt verification fails:** refresh the receipt screen. A modified export should fail by design.

All sample identities and domains are fictional. Sandbox tools never send, publish, export, or access external systems.
