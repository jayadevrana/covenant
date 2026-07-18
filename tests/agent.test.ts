import { describe, expect, it, vi } from "vitest";

import {
  GOLDEN_TASK,
  createAgentRun,
  resolveApproval,
  stepAgent,
  type AgentResponseRequest,
  type AgentResponsesClient,
} from "../lib/agent";
import { createExecutionRecorder, createSandboxTools } from "../lib/sandbox";

const now = () => "2026-07-18T04:00:00.000Z";

function functionResponse(name: string, args: object, model = "gpt-5.6-sol") {
  return {
    model,
    output: [
      {
        type: "function_call",
        name,
        arguments: JSON.stringify(args),
        call_id: `call-${name}`,
      },
    ],
  };
}

function mockClient(...responses: unknown[]) {
  const requests: AgentResponseRequest[] = [];
  const create = vi.fn(async (request: AgentResponseRequest) => {
    requests.push(structuredClone(request));
    return responses.shift() ?? { model: "gpt-5.6-sol", output_text: "done", output: [] };
  });
  const client: AgentResponsesClient = { responses: { create } };
  return { client, create, requests };
}

describe("client-driven sandbox agent", () => {
  it("runs the fixture golden path with allow, approval, and block", async () => {
    const recorder = createExecutionRecorder();
    const tools = createSandboxTools(recorder);
    const run = createAgentRun({ id: "fixture-run", task: GOLDEN_TASK, timestamp: now() });

    while (run.status === "running" && run.fixtureActionIndex < 4) {
      await stepAgent(run, { tools, now });
    }

    expect(run.status).toBe("awaiting_approval");
    expect(recorder.records.filter((record) => record.tool === "send_email")).toHaveLength(0);

    await resolveApproval(run, true, { tools, now });
    while (run.status === "running") await stepAgent(run, { tools, now });

    const verdicts = run.timeline
      .filter((entry) => entry.type === "decision")
      .map((entry) => entry.decision?.verdict);
    expect(verdicts).toEqual(["allow", "allow", "allow", "require_approval", "block"]);
    expect(run.status).toBe("completed");
    expect(run.world.outbox).toHaveLength(1);
    expect(recorder.records.filter((record) => record.tool === "send_email")).toHaveLength(1);
    expect(
      recorder.records.some((record) => JSON.stringify(record.args).includes("partnerco.example")),
    ).toBe(false);
  });

  it("makes exactly one model call in one live step with strict function tools", async () => {
    const mock = mockClient(
      functionResponse("search_customers", { affected_by: "2026-07-12-outage" }),
    );
    const run = createAgentRun({ id: "live-run", mode: "live", timestamp: now() });
    const delta = await stepAgent(run, { client: mock.client, now });

    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(delta.entries.some((entry) => entry.type === "tool_executed")).toBe(true);
    expect(mock.requests[0]).toMatchObject({
      model: "gpt-5.6",
      reasoning: { effort: "low" },
      max_output_tokens: 2_000,
      tool_choice: "auto",
      parallel_tool_calls: false,
    });
    expect(mock.requests[0].tools).toHaveLength(6);
    expect(mock.requests[0].tools.every((tool) => tool.strict)).toBe(true);
  });

  it("provably never invokes execute for a blocked live tool call", async () => {
    const recorder = createExecutionRecorder();
    const tools = createSandboxTools(recorder);
    const mock = mockClient(
      functionResponse("send_email", {
        recipients: ["ben@partnerco.example"],
        subject: "Full report",
        body: "Customer details",
        attachments: [
          { name: "july_12_incident_report", data_classes: ["customer_data"] },
        ],
        data_classes: ["customer_data"],
      }),
    );
    const run = createAgentRun({ id: "blocked-run", mode: "live", timestamp: now() });
    await stepAgent(run, { client: mock.client, tools, now });

    expect(run.timeline.find((entry) => entry.type === "decision")?.decision?.verdict).toBe(
      "block",
    );
    expect(run.timeline.some((entry) => entry.type === "tool_skipped")).toBe(true);
    expect(recorder.records).toEqual([]);
    expect(run.world.outbox).toEqual([]);
  });

  it("does not execute a human-denied approval action", async () => {
    const recorder = createExecutionRecorder();
    const tools = createSandboxTools(recorder);
    const run = createAgentRun({ id: "denied-run", timestamp: now() });

    for (let index = 0; index < 4; index += 1) await stepAgent(run, { tools, now });
    expect(run.status).toBe("awaiting_approval");
    await resolveApproval(run, false, { tools, now });

    expect(recorder.records.filter((record) => record.tool === "send_email")).toEqual([]);
    expect(run.timeline.some((entry) => entry.title.includes("denied and skipped"))).toBe(true);
  });
});
