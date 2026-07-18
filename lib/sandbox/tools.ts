import { seedCustomers, seedDocuments } from "../../data/seed";
import type { JsonValue } from "../schemas";
import type {
  ExecutionRecorder,
  SandboxTool,
  SandboxToolMap,
  SandboxToolResult,
  SandboxWorld,
} from "./types";

const stringSchema = { type: "string" } as const;
const stringArraySchema = { type: "array", items: stringSchema } as const;

function objectParameters(
  properties: Record<string, unknown>,
  required = Object.keys(properties),
): Record<string, unknown> {
  return { type: "object", additionalProperties: false, properties, required };
}

function ok(data: JsonValue): SandboxToolResult {
  return { ok: true, data };
}

const baseTools: SandboxToolMap = {
  search_customers: {
    name: "search_customers",
    description: "Search the seeded customer directory by fixture incident identifier.",
    parameters: objectParameters({ affected_by: stringSchema }),
    async execute(args) {
      const affected = args.affected_by === "2026-07-12-outage";
      return ok(
        seedCustomers
          .filter((customer) => !affected || customer.affected_by_july_12_outage)
          .map((customer) => ({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            usage_summary: customer.usage_summary,
          })),
      );
    },
  },
  read_document: {
    name: "read_document",
    description: "Read one seeded sandbox document.",
    parameters: objectParameters({ document_id: stringSchema }),
    async execute(args) {
      const document = seedDocuments.find((item) => item.id === args.document_id);
      return document ? ok(document) : { ok: false, data: { error: "document_not_found" } };
    },
  },
  draft_email: {
    name: "draft_email",
    description: "Create a sandbox draft without contacting anyone.",
    parameters: objectParameters({
      recipients: stringArraySchema,
      subject: stringSchema,
      body: stringSchema,
    }),
    async execute(args) {
      return ok({
        draft_id: "fixture-draft",
        recipients: args.recipients,
        subject: args.subject,
        body: args.body,
        status: "draft_only",
      });
    },
  },
  send_email: {
    name: "send_email",
    description: "Append a message to the in-process sandbox outbox. Nothing is transmitted.",
    parameters: objectParameters({
      recipients: stringArraySchema,
      subject: stringSchema,
      body: stringSchema,
      attachments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { name: stringSchema, data_classes: stringArraySchema },
          required: ["name", "data_classes"],
        },
      },
      data_classes: stringArraySchema,
    }),
    async execute(args, world) {
      const message = { id: `outbox-${world.outbox.length + 1}`, ...args, status: "sandbox_only" };
      world.outbox.push(message);
      return ok(message);
    },
  },
  export_records: {
    name: "export_records",
    description: "Append an export request to the in-process sandbox log.",
    parameters: objectParameters({ record_ids: stringArraySchema }),
    async execute(args, world) {
      const entry = { id: `export-${world.exportLog.length + 1}`, ...args };
      world.exportLog.push(entry);
      return ok(entry);
    },
  },
  publish_report: {
    name: "publish_report",
    description: "Append a publication request to the in-process sandbox log.",
    parameters: objectParameters({ report_id: stringSchema, audience: stringSchema }),
    async execute(args, world) {
      const entry = { id: `publication-${world.publicationLog.length + 1}`, ...args };
      world.publicationLog.push(entry);
      return ok(entry);
    },
  },
};

export function createSandboxTools(recorder?: ExecutionRecorder): SandboxToolMap {
  return Object.fromEntries(
    Object.values(baseTools).map((tool) => {
      const wrapped: SandboxTool = {
        ...tool,
        async execute(args: Record<string, JsonValue>, world: SandboxWorld) {
          recorder?.record(tool.name, args);
          return tool.execute(args, world);
        },
      };
      return [tool.name, wrapped];
    }),
  );
}

export function toResponsesTools(tools: SandboxToolMap) {
  return Object.values(tools).map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true as const,
  }));
}
