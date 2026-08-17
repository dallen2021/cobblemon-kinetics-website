import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = resolve(repositoryRoot, "apps/web/.next/server");

async function traceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory()
        ? traceFiles(path)
        : Promise.resolve(entry.name.endsWith(".nft.json") ? [path] : []);
    }),
  );
  return nested.flat();
}

const traces = await traceFiles(serverRoot);
if (traces.length === 0) throw new Error("Next build produced no server trace manifests.");

const failures = [];
for (const trace of traces) {
  const manifest = JSON.parse(await readFile(trace, "utf8"));
  if (!Array.isArray(manifest.files)) throw new Error(`Malformed Next trace manifest: ${trace}`);
  for (const file of manifest.files) {
    if (typeof file !== "string") throw new Error(`Malformed file entry in Next trace: ${trace}`);
    const normalized = file.replaceAll("\\", "/");
    if (normalized.split("/").includes(".private")) failures.push(`${trace}: ${file}`);
  }
}

if (failures.length) {
  throw new Error(`Private workspace files entered Next output traces:\n${failures.join("\n")}`);
}

console.log(`Next trace privacy check passed: ${traces.length} manifests, 0 private files.`);
