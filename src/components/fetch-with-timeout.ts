export const REQUEST_TIMEOUT_MS = 30_000;
export const TIMEOUT_MESSAGE = "Request timed out. Fixture mode remains available; try again.";

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(TIMEOUT_MESSAGE);
    }
    throw error;
  }
}
