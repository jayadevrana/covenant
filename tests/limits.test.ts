import { describe, expect, it } from "vitest";

import {
  checkLiveRunGate,
  configuredLiveRunLimit,
  liveRunCount,
} from "../lib/agent";

describe("live-run spend controls", () => {
  it("caps configuration at three and defaults invalid values to three", () => {
    expect(configuredLiveRunLimit("9")).toBe(3);
    expect(configuredLiveRunLimit("2")).toBe(2);
    expect(configuredLiveRunLimit("invalid")).toBe(3);
    expect(configuredLiveRunLimit("0")).toBe(3);
  });

  it("reads the HttpOnly-compatible run count from a cookie header", () => {
    expect(liveRunCount("theme=dark; covenant_live_runs=2; other=value")).toBe(2);
    expect(liveRunCount("covenant_live_runs=invalid")).toBe(0);
    expect(liveRunCount(null)).toBe(0);
  });

  it("honors the kill switch before key or quota checks", () => {
    expect(checkLiveRunGate({ hasApiKey: true, killSwitch: "1", count: 0, limit: 3 }))
      .toMatchObject({ allowed: false, status: 503, error: expect.stringContaining("kill switch") });
  });

  it("requires a server key and blocks the fourth live run", () => {
    expect(checkLiveRunGate({ hasApiKey: false, count: 0, limit: 3 }))
      .toMatchObject({ allowed: false, status: 503 });
    expect(checkLiveRunGate({ hasApiKey: true, count: 3, limit: 3 }))
      .toMatchObject({ allowed: false, status: 429 });
    expect(checkLiveRunGate({ hasApiKey: true, count: 2, limit: 3 }))
      .toEqual({ allowed: true, status: 200 });
  });
});
