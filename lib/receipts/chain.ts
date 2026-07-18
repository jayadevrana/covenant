import { canonicalHash } from "../engine";
import { ReceiptEventSchema, type JsonValue, type ReceiptEvent } from "../schemas";

export const GENESIS_HASH = "0".repeat(64);
export const RECEIPT_CANONICALIZATION =
  "UTF-8 stable JSON; recursively sorted object keys; array order preserved; event envelope excludes payload_hash";

export type ReceiptInput = Pick<ReceiptEvent, "run_id" | "type" | "payload" | "timestamp">;

function hashMaterial(event: Omit<ReceiptEvent, "payload_hash">): Record<string, JsonValue> {
  return {
    seq: event.seq,
    run_id: event.run_id,
    type: event.type,
    payload: event.payload,
    prev_hash: event.prev_hash,
    timestamp: event.timestamp,
  };
}

export function appendReceipt(chain: ReceiptEvent[], input: ReceiptInput): ReceiptEvent {
  const withoutHash: Omit<ReceiptEvent, "payload_hash"> = {
    seq: chain.length,
    run_id: input.run_id,
    type: input.type,
    payload: input.payload,
    prev_hash: chain.at(-1)?.payload_hash ?? GENESIS_HASH,
    timestamp: input.timestamp,
  };
  const event: ReceiptEvent = {
    ...withoutHash,
    payload_hash: canonicalHash(hashMaterial(withoutHash)),
  };
  chain.push(event);
  return event;
}

export interface ReceiptVerification {
  valid: boolean;
  head: string;
  checked: number;
  error?: string;
}

export function verifyReceiptChain(events: readonly ReceiptEvent[]): ReceiptVerification {
  let previous = GENESIS_HASH;
  let runId: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const parsed = ReceiptEventSchema.safeParse(events[index]);
    if (!parsed.success) {
      return { valid: false, head: previous, checked: index, error: `Invalid event ${index}` };
    }
    const event = parsed.data;
    if (event.seq !== index) {
      return { valid: false, head: previous, checked: index, error: `Sequence mismatch at ${index}` };
    }
    if (runId !== null && event.run_id !== runId) {
      return { valid: false, head: previous, checked: index, error: `Run mismatch at ${index}` };
    }
    runId ??= event.run_id;
    if (event.prev_hash !== previous) {
      return { valid: false, head: previous, checked: index, error: `Previous hash mismatch at ${index}` };
    }
    const expected = canonicalHash(
      hashMaterial({
        seq: event.seq,
        run_id: event.run_id,
        type: event.type,
        payload: event.payload,
        prev_hash: event.prev_hash,
        timestamp: event.timestamp,
      }),
    );
    if (event.payload_hash !== expected) {
      return { valid: false, head: previous, checked: index, error: `Payload hash mismatch at ${index}` };
    }
    previous = event.payload_hash;
  }

  return { valid: true, head: previous, checked: events.length };
}

export interface ReceiptExport {
  format: "covenant-receipts-v1";
  canonicalization: string;
  chain_head: string;
  events: ReceiptEvent[];
}

export function createReceiptExport(events: readonly ReceiptEvent[]): ReceiptExport {
  const verification = verifyReceiptChain(events);
  return {
    format: "covenant-receipts-v1",
    canonicalization: RECEIPT_CANONICALIZATION,
    chain_head: verification.head,
    events: structuredClone(events) as ReceiptEvent[],
  };
}
