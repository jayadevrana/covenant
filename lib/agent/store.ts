import type { AgentRun } from "./types";

const globalStore = globalThis as typeof globalThis & {
  covenantRuns?: Map<string, AgentRun>;
};

const runs = globalStore.covenantRuns ?? new Map<string, AgentRun>();
globalStore.covenantRuns = runs;

export function saveRun(run: AgentRun): AgentRun {
  runs.set(run.id, run);
  return run;
}

export function getRun(runId: string): AgentRun | undefined {
  return runs.get(runId);
}

export function clearRunsForTests(): void {
  runs.clear();
}
