import { mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";

import { importLocalGameAssets } from "../src/assets/local-game-assets.js";

const temporaryRoots: string[] = [];
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function fixtureJar(path: string, entries: Record<string, Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, bytes] of Object.entries(entries)) zip.file(name, bytes);
  await writeFile(path, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("local game asset import", () => {
  it("copies namespaced PNGs only into an ignored-style private preview tree", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "ck-local-assets-"));
    temporaryRoots.push(root);
    const createJar = resolve(root, "create.jar");
    const cobblemonJar = resolve(root, "cobblemon.jar");
    await fixtureJar(createJar, {
      "assets/create/textures/block/waterwheel.png": onePixelPng,
      "assets/cobblemon/textures/not-from-create.png": onePixelPng,
      "assets/create/models/block/waterwheel.json": Buffer.from("{}"),
    });
    await fixtureJar(cobblemonJar, {
      "assets/cobblemon/textures/pokemon/0007_squirtle/squirtle.png": onePixelPng,
      "assets/create/textures/not-from-cobblemon.png": onePixelPng,
    });

    const result = await importLocalGameAssets({
      repositoryRoot: root,
      createJar,
      createVersion: "6.0.10",
      cobblemonJar,
      cobblemonVersion: "1.7.3",
      generatedAt: "2026-08-14T00:00:00.000Z",
    });

    expect(result.root).toBe(resolve(await realpath(root), ".private/local-game-assets"));
    expect(result.manifest.assets).toEqual([
      expect.objectContaining({
        provider: "cobblemon",
        path: "textures/pokemon/0007_squirtle/squirtle.png",
        width: 1,
        height: 1,
      }),
      expect.objectContaining({
        provider: "create",
        path: "textures/block/waterwheel.png",
        width: 1,
        height: 1,
      }),
    ]);
    expect(result.manifest.sources).toEqual([
      expect.objectContaining({ provider: "create", rights_status: "private_evaluation_only" }),
      expect.objectContaining({ provider: "cobblemon", rights_status: "private_evaluation_only" }),
    ]);
    expect(
      await readFile(
        resolve(result.root, "files/cobblemon/textures/pokemon/0007_squirtle/squirtle.png"),
      ),
    ).toEqual(onePixelPng);
  });

  it("rejects a symlinked private output root", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "ck-local-assets-root-"));
    const outside = await mkdtemp(resolve(tmpdir(), "ck-local-assets-outside-"));
    temporaryRoots.push(root, outside);
    await symlink(outside, resolve(root, ".private"), "dir");

    await expect(
      importLocalGameAssets({
        repositoryRoot: root,
        createJar: resolve(root, "create.jar"),
        createVersion: "6.0.10",
        cobblemonJar: resolve(root, "cobblemon.jar"),
        cobblemonVersion: "1.7.3",
      }),
    ).rejects.toThrow("symbolic-link private asset root");
  });
});
