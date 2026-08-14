import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: JsonValue): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function compactCanonicalJson(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function safeHexEqual(left: string, right: string): boolean {
  if (
    !/^[a-f0-9]+$/u.test(left) ||
    !/^[a-f0-9]+$/u.test(right) ||
    left.length !== right.length ||
    left.length % 2 !== 0
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
