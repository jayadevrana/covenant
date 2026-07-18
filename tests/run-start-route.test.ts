import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/run/start/route";
import { clearRunsForTests } from "../lib/agent/store";

function request(mode: "fixture" | "live", cookie?: string) {
  return new Request("https://covenant.example/api/run/start", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ mode }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  clearRunsForTests();
});

describe("run-start deployment controls", () => {
  it("keeps fixture mode available without a key while the kill switch is active", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("DAILY_SPEND_KILL", "1");

    const response = await POST(request("fixture"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.run.mode).toBe("fixture");
  });

  it("honors the live kill switch", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("DAILY_SPEND_KILL", "1");

    const response = await POST(request("live"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("kill switch") });
  });

  it("blocks the fourth live run and increments the secure session counter", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("DAILY_SPEND_KILL", "0");
    vi.stubEnv("MAX_LIVE_RUNS_PER_SESSION", "3");

    const allowed = await POST(request("live", "covenant_live_runs=2"));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("set-cookie")).toContain("covenant_live_runs=3");
    expect(allowed.headers.get("set-cookie")).toContain("HttpOnly");
    expect(allowed.headers.get("set-cookie")).toContain("Secure");

    const blocked = await POST(request("live", "covenant_live_runs=3"));
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toMatchObject({ error: expect.stringContaining("3-run") });
  });
});
