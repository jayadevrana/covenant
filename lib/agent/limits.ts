export const LIVE_RUN_COOKIE = "covenant_live_runs";
export const DEFAULT_MAX_LIVE_RUNS = 3;

export interface LiveRunGate {
  allowed: boolean;
  status: 200 | 429 | 503;
  error?: string;
}

export function configuredLiveRunLimit(value = process.env.MAX_LIVE_RUNS_PER_SESSION): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_LIVE_RUNS;
  return Math.min(parsed, DEFAULT_MAX_LIVE_RUNS);
}

export function liveRunCount(cookieHeader: string | null): number {
  const cookie = cookieHeader
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${LIVE_RUN_COOKIE}=`));
  const parsed = Number(cookie?.slice(LIVE_RUN_COOKIE.length + 1));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function checkLiveRunGate(options: {
  hasApiKey: boolean;
  killSwitch?: string;
  count: number;
  limit: number;
}): LiveRunGate {
  if (options.killSwitch === "1") {
    return {
      allowed: false,
      status: 503,
      error: "Live mode is temporarily disabled by the daily spend kill switch. Fixture mode remains available.",
    };
  }
  if (!options.hasApiKey) {
    return {
      allowed: false,
      status: 503,
      error: "Live mode requires a server API key. Fixture mode remains available.",
    };
  }
  if (options.count >= options.limit) {
    return {
      allowed: false,
      status: 429,
      error: `This sandbox session reached its ${options.limit}-run live limit. Fixture mode remains available.`,
    };
  }
  return { allowed: true, status: 200 };
}
