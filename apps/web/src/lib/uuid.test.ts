import { describe, expect, it } from "vitest";
import { isCanonicalUuid } from "./uuid";

describe("canonical UUID validation", () => {
  it("accepts an exact UUID shape", () => {
    expect(isCanonicalUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it.each([
    "123e4567e89b12d3a456426614174000",
    "123e4567-e89b-12d3-a456-42661417400-",
    "------------------------------------",
    "123e4567-e89b-12d3-a456-4266141740000",
  ])("rejects malformed value %s", (value) => {
    expect(isCanonicalUuid(value)).toBe(false);
  });
});
