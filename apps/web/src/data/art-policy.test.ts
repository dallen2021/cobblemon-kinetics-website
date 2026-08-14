import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(webRoot, "../..");

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function pngMetadata(filePath: string): { width: number; height: number; colorType: number } {
  const bytes = readFileSync(filePath);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25] ?? -1,
  };
}

const approvedInterfaceFrames = {
  "panel-frame-brass.png": {
    sha256: "ab454945ad8d4f0f800414955dfef38cd42924d1ae1316e2d35a7a4c58d8963c",
    chromaSourceSha256: "d4ba89dabfd1d6f69f47d9515af4c25f12322c9078fb7da7ecfaded642050432",
    width: 256,
    height: 256,
    borderImageSlice: 20,
  },
  "panel-frame-steel.png": {
    sha256: "52b8518423f95f150a791ea8b6d2a954e0f89a8d8968deb7f3808bc3d534fbbf",
    chromaSourceSha256: "e64d852411780809bf58743e8c24f6f3fb75aa97a8b93e9406e05542d9c7895e",
    width: 256,
    height: 256,
    borderImageSlice: 20,
  },
  "studio-frame-heavy.png": {
    sha256: "04c05b91c7f06ed0b8fa768cd9027d676caec1fb26dcc961fc65224355f3626f",
    chromaSourceSha256: "8b2cd2bb1f7e2f72b19c52fab234a7407fa3fe113eb24f5d61d009c4ab5f8eaa",
    width: 512,
    height: 512,
    borderImageSlice: 56,
  },
} as const;

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

  it("allows only the hash-pinned generated interface frame set", () => {
    const artDirectory = path.join(webRoot, "public/art");
    const interfaceDirectory = path.join(artDirectory, "interface");
    const frameDirectory = path.join(interfaceDirectory, "frames");
    const manifest = JSON.parse(
      readFileSync(path.join(frameDirectory, "manifest.json"), "utf8"),
    ) as {
      manifest_version: number;
      provider: string;
      rights_status: string;
      usage_boundary: string;
      third_party_visual_references: unknown[];
      prohibited_subjects: string[];
      files: Array<{
        path: string;
        sha256: string;
        width: number;
        height: number;
        border_image_slice: number;
        chroma_source_sha256: string;
        permitted_visibility: string;
        subject_class: string;
      }>;
    };

    expect(readdirSync(artDirectory).sort()).toEqual(["generated", "interface"]);
    expect(readdirSync(interfaceDirectory).sort()).toEqual(["frames"]);
    expect(readdirSync(frameDirectory).sort()).toEqual([
      "manifest.json",
      "panel-frame-brass.png",
      "panel-frame-steel.png",
      "studio-frame-heavy.png",
    ]);
    expect(manifest).toMatchObject({
      manifest_version: 1,
      provider: "openai_builtin_imagegen",
      rights_status: "approved_interface_only",
      usage_boundary: "interface_only",
      third_party_visual_references: [],
    });
    expect(manifest.prohibited_subjects).toEqual(
      expect.arrayContaining(["pokemon", "workers", "machines", "items", "gameplay_scenes"]),
    );
    expect(manifest.files.map((file) => file.path).sort()).toEqual(
      Object.keys(approvedInterfaceFrames).sort(),
    );

    for (const file of manifest.files) {
      const expected = approvedInterfaceFrames[file.path as keyof typeof approvedInterfaceFrames];
      expect(expected).toBeDefined();
      if (!expected) continue;

      expect(file).toMatchObject({
        sha256: expected.sha256,
        width: expected.width,
        height: expected.height,
        border_image_slice: expected.borderImageSlice,
        chroma_source_sha256: expected.chromaSourceSha256,
        permitted_visibility: "public",
        subject_class: "interface_only",
      });
      expect(sha256(path.join(frameDirectory, file.path))).toBe(expected.sha256);
      expect(pngMetadata(path.join(frameDirectory, file.path))).toEqual({
        width: expected.width,
        height: expected.height,
        colorType: 6,
      });
    }
  });
});
