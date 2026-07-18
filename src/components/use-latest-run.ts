"use client";

import { useCallback, useEffect, useState } from "react";

import type { AgentRun } from "../../lib/agent";
import { fetchWithTimeout } from "./fetch-with-timeout";

const STORAGE_KEY = "covenant.latestRunId";

export function rememberRun(run: AgentRun): void {
  window.localStorage.setItem(STORAGE_KEY, run.id);
}

export function useLatestRun() {
  const [run, setRunState] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const setRun = useCallback((next: AgentRun | null) => {
    setRunState(next);
    if (next) rememberRun(next);
  }, []);

  const refresh = useCallback(async () => {
    const runId = window.localStorage.getItem(STORAGE_KEY);
    if (!runId) {
      setRunState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetchWithTimeout(`/api/run/${encodeURIComponent(runId)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { run?: AgentRun; error?: string };
      if (!response.ok || !payload.run) {
        if (response.status === 404) window.localStorage.removeItem(STORAGE_KEY);
        throw new Error(payload.error ?? "Sandbox session expired — start a fresh run.");
      }
      setRunState(payload.run);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setRunState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { run, setRun, loading, loadError, refresh };
}
