import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout, TIMEOUT_MESSAGE } from "../src/components/fetch-with-timeout";

afterEach(() => vi.unstubAllGlobals());

describe("client request timeout", () => {
  it("turns an abort timeout into a visible recovery message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    }));

    await expect(fetchWithTimeout("/api/run/step", {}, 1)).rejects.toThrow(TIMEOUT_MESSAGE);
  });
});
