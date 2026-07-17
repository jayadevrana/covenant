import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function canonicalizeValue(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeValue).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        if (record[key] === undefined) {
          throw new TypeError(`Canonical JSON rejects undefined at key ${key}`);
        }
        return `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`;
      });
    return `{${entries.join(",")}}`;
  }

  throw new TypeError(`Canonical JSON cannot encode ${typeof value}`);
}

/** Stable JSON with recursively sorted object keys and JSON array ordering. */
export function canonicalize(value: unknown): string {
  return canonicalizeValue(value);
}

/** SHA-256 hex digest of UTF-8 encoded canonical JSON. */
export function canonicalHash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalize(value))));
}
