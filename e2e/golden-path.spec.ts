import { expect, test } from "@playwright/test";

test("fixture golden path recovers from both visible failure states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The safety layer that learns from every correction." })).toBeVisible();
  await expect(page.getByText("Compile", { exact: true })).toBeVisible();
  await expect(page.getByText("Intercept", { exact: true })).toBeVisible();
  await expect(page.getByText("Prove", { exact: true })).toBeVisible();
  await expect(page.getByText("Immunize", { exact: true })).toBeVisible();
  await expect(page.getByText(/Prototype safety layer/)).toBeVisible();

  await page.route("**/api/run/start", async (route) => {
    const body = route.request().postDataJSON() as { mode?: string };
    if (body.mode === "live") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Live mode requires a server API key. Demo mode remains available." }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/run");
  await page.getByRole("button", { name: "Run live model" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Live mode requires a server API key" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Run seeded fixture" }).click();
  await expect(page.getByText("FIXTURE", { exact: true }).first()).toBeVisible();
  const approval = page.getByRole("button", { name: "Approve sandbox action" });
  await expect(approval).toBeVisible();
  await expect(approval).toBeFocused();
  await approval.press("Enter");

  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  await expect(page.getByText("allow", { exact: true })).toHaveCount(3);
  await expect(page.getByText("require approval", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("block", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Inspect receipt chain" }).click();
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByRole("status")).toContainText("Chain intact");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect((await download).suggestedFilename()).toMatch(/^covenant-receipts-.+\.json$/);

  await page.getByRole("link", { name: "Immunity" }).click();
  let injectInvalidOutput = true;
  await page.route("**/api/correction/compile", async (route) => {
    if (injectInvalidOutput) {
      injectInvalidOutput = false;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "invalid_model_output",
            message: "The model returned invalid structured output twice.",
            rawOutput: '{"id":"still-invalid"}',
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "Generate eval + patch" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "invalid structured output twice" }),
  ).toBeVisible();
  await page.getByText("Inspect invalid model output").click();
  await expect(page.getByText('{"id":"still-invalid"}')).toBeVisible();

  await page.getByRole("button", { name: "Generate eval + patch" }).click();
  await expect(page.getByText("Proposed policy diff")).toBeVisible();
  await expect(page.getByText("12/13", { exact: true })).toBeVisible();
  await expect(page.getByText("13/13", { exact: true })).toBeVisible();
  await expect(page.getByText("Zero regressions across all 12 seed evals.")).toBeVisible();
  await page.getByRole("button", { name: "Approve + activate v2" }).click();
  await expect(page.getByText(/Policy v2 is active and 13\/13 evals pass/)).toBeVisible();

  await page.screenshot({ path: "test-results/m6-golden-path.png", fullPage: true });
});
