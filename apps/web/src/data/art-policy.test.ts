import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(webRoot, "../..");

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

describe("public artwork policy", () => {
  it("publishes only neutral generated interface illustrations", () => {
    const directory = path.join(webRoot, "public/art/generated");
    const manifest = JSON.parse(readFileSync(path.join(directory, "manifest.json"), "utf8")) as {
      files: Array<{ path: string; sha256: string; subject_class: string }>;
    };

    expect(readdirSync(directory).sort()).toEqual(["empty-workbench.webp", "manifest.json"]);
    expect(manifest.files.map((file) => file.path).sort()).toEqual(["empty-workbench.webp"]);
    for (const file of manifest.files) {
      expect(file.subject_class).toBe("interface_only");
      expect(sha256(path.join(directory, file.path))).toBe(file.sha256);
    }
  });

  it("keeps approved brand derivatives reproducible from their manifest", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(webRoot, "public/brand/manifest.json"), "utf8"),
    ) as {
      approval_status: string;
      files: Array<{ repo_path: string; sha256: string }>;
    };

    expect(manifest.approval_status).toBe("maintainer_approved_brand");
    for (const file of manifest.files) {
      expect(sha256(path.join(repositoryRoot, file.repo_path))).toBe(file.sha256);
    }
  });
});
