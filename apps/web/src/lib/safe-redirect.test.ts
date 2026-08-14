import { describe, expect, it } from "vitest";
import { safeRelativeRedirect } from "./safe-redirect";

describe("safeRelativeRedirect", () => {
  it("allows local paths", () => {
    expect(
      safeRelativeRedirect(
        "/studio/pokemon/squirtle?tab=work#balance",
        "/",
        new URL("https://studio.example.test"),
      ),
    ).toBe("/studio/pokemon/squirtle?tab=work#balance");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\\\evil.example/path",
    "/%5C%5Cevil.example/path",
    "/%255C%255Cevil.example/path",
    "/%2F%2Fevil.example/path",
    "/%0devil",
    "/\u0000evil",
    "javascript:alert(1)",
  ])("rejects unsafe redirect %s", (value) => {
    expect(safeRelativeRedirect(value, "/", new URL("https://studio.example.test"))).toBe("/");
  });

  it("rejects an encoded backslash after URLSearchParams decoding", () => {
    const next = new URL(
      "https://studio.example.test/auth/callback?next=%2F%255C%255Cevil.example%2Fpath",
    ).searchParams.get("next");
    expect(safeRelativeRedirect(next, "/studio", new URL("https://studio.example.test"))).toBe(
      "/studio",
    );
  });
});
