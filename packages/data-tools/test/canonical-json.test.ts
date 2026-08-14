import { describe, expect, it } from "vitest";

import { canonicalJson, sha256 } from "../src/lib/canonical-json.js";
import { assertAllowedArgs, booleanFlag, parseArgs } from "../src/lib/args.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: { y: true, b: false }, list: [2, 1] })).toBe(
      '{\n  "a": {\n    "b": false,\n    "y": true\n  },\n  "list": [\n    2,\n    1\n  ],\n  "z": 1\n}\n',
    );
    expect(sha256("same")).toBe(sha256("same"));
  });
});

describe("CLI argument validation", () => {
  it("rejects unsupported options instead of silently ignoring typos", () => {
    const args = parseArgs(["--out", "somewhere"]);
    expect(() => assertAllowedArgs(args, { flags: ["output-dir"] })).toThrow(
      /Unknown option: --out/,
    );
  });

  it("rejects duplicate options and values supplied to security-sensitive switches", () => {
    expect(() => parseArgs(["--bundle", "one.json", "--bundle", "two.json"])).toThrow(
      /Duplicate option: --bundle/,
    );
    expect(() => booleanFlag(parseArgs(["--allow-unsigned=false"]), "allow-unsigned")).toThrow(
      /does not accept a value/,
    );
    expect(booleanFlag(parseArgs(["--allow-unsigned"]), "allow-unsigned")).toBe(true);
    expect(parseArgs(["--", "--bundle", "fixture.json"]).flags.get("bundle")).toBe("fixture.json");
  });
});
