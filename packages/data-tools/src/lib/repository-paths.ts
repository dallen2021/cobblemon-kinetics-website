import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageFile = fileURLToPath(import.meta.url);

export function repositoryRootPath(): string {
  return resolve(dirname(packageFile), "../../../..");
}

export function isPathInside(parent: string, candidate: string): boolean {
  const child = relative(resolve(parent), resolve(candidate));
  return child.length > 0 && !child.startsWith("..") && !isAbsolute(child);
}

export async function canonicalDirectoryTarget(path: string, label: string): Promise<string> {
  const absolute = resolve(path);
  let cursor = absolute;
  const missingSegments: string[] = [];
  while (true) {
    try {
      const stats = await lstat(cursor);
      if (cursor === absolute) {
        if (stats.isSymbolicLink()) throw new Error(`Refusing symbolic-link ${label}: ${absolute}`);
        if (!stats.isDirectory())
          throw new Error(`${label} exists but is not a directory: ${absolute}`);
      }
      return resolve(await realpath(cursor), ...missingSegments);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      missingSegments.unshift(relative(parent, cursor));
      cursor = parent;
    }
  }
}

/**
 * Resolves package-script paths independently of pnpm's package-local working directory.
 * Relative paths use the repository root; absolute paths remain absolute.
 */
export function repositoryDefaultPath(explicitPath: string | undefined, fallback: string): string {
  const path = explicitPath ?? fallback;
  return isAbsolute(path) ? resolve(path) : resolve(repositoryRootPath(), path);
}
