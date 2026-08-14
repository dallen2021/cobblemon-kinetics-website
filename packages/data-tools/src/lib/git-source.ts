import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

export interface VerifiedGitPublicationSource {
  repository: string;
  commit: string;
}

function gitText(repositoryRoot: string, args: readonly string[], failure: string): string {
  try {
    return execFileSync("git", [...args], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(failure);
  }
}

function gitBytes(repositoryRoot: string, args: readonly string[], failure: string): Buffer {
  try {
    return execFileSync("git", [...args], {
      cwd: repositoryRoot,
      encoding: null,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error(failure);
  }
}

function repositoryRelativePath(repositoryRoot: string, target: string): string {
  const path = relative(resolve(repositoryRoot), resolve(target));
  if (!path || path.startsWith("..") || isAbsolute(path)) {
    throw new Error("Target must be a path inside the Git repository.");
  }
  return path.split(sep).join("/");
}

export function githubRepositoryFromRemote(remote: string): string {
  const scp = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/u.exec(remote);
  if (scp?.[1] && scp[2]) return `${scp[1]}/${scp[2]}`;

  let url: URL;
  try {
    url = new URL(remote);
  } catch {
    throw new Error("The origin remote must be a GitHub HTTPS or SSH repository URL.");
  }
  if (url.hostname.toLowerCase() !== "github.com" || !["https:", "ssh:"].includes(url.protocol)) {
    throw new Error("The origin remote must be a GitHub HTTPS or SSH repository URL.");
  }
  const segments = url.pathname.replace(/^\/+|\/+$/gu, "").split("/");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error("The origin remote must identify one GitHub owner/repository pair.");
  }
  const name = segments[1].endsWith(".git") ? segments[1].slice(0, -4) : segments[1];
  if (!name) throw new Error("The origin remote has no repository name.");
  return `${segments[0]}/${name}`;
}

async function listRegularFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Canonical published data cannot contain symbolic links.");
      }
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        files.push(relative(root, absolute).split(sep).join("/"));
      } else {
        throw new Error("Canonical published data can contain only regular files and directories.");
      }
    }
  }
  await visit(root);
  return files.sort();
}

export function trackedFilesUnder(repositoryRoot: string, target: string): string[] {
  const path = repositoryRelativePath(repositoryRoot, target);
  const output = gitBytes(
    repositoryRoot,
    ["ls-files", "-z", "--", path],
    "Cannot inspect tracked output paths.",
  );
  return output.toString("utf8").split("\0").filter(Boolean);
}

export function repositoryPathIsIgnored(repositoryRoot: string, target: string): boolean {
  const path = repositoryRelativePath(repositoryRoot, target);
  const result = spawnSync("git", ["check-ignore", "--quiet", "--", path], {
    cwd: repositoryRoot,
    stdio: "ignore",
  });
  if (result.error) throw new Error("Cannot verify that the mod export path is ignored by Git.");
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error("Cannot verify that the mod export path is ignored by Git.");
}

export async function verifyCleanGitPublicationSource(options: {
  repositoryRoot: string;
  publishedRoot: string;
  requestedRepository: string;
  requestedCommit: string;
}): Promise<VerifiedGitPublicationSource> {
  const repositoryRoot = await realpath(options.repositoryRoot);
  const gitRoot = await realpath(
    gitText(
      repositoryRoot,
      ["rev-parse", "--show-toplevel"],
      "The mod export must run inside a Git checkout.",
    ),
  );
  if (gitRoot !== repositoryRoot) {
    throw new Error("The mod export must run from the website repository root.");
  }

  const expectedPublishedRoot = await realpath(resolve(repositoryRoot, "data/published"));
  const publishedRoot = await realpath(options.publishedRoot);
  if (publishedRoot !== expectedPublishedRoot) {
    throw new Error("Mod exports must read the checkout's canonical data/published directory.");
  }

  const repository = githubRepositoryFromRemote(
    gitText(
      repositoryRoot,
      ["remote", "get-url", "origin"],
      "The website checkout must have a GitHub origin remote before mod export.",
    ),
  );
  if (repository.toLowerCase() !== options.requestedRepository.toLowerCase()) {
    throw new Error("The requested source repository does not match this checkout's origin.");
  }

  const commit = gitText(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD^{commit}"],
    "The website checkout has no valid HEAD commit.",
  );
  if (!/^[a-f0-9]{40}$/u.test(commit) || commit !== options.requestedCommit) {
    throw new Error("The requested source commit does not match this checkout's HEAD commit.");
  }

  const status = gitText(
    repositoryRoot,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "Cannot inspect the website checkout status.",
  );
  if (status) {
    throw new Error("The website checkout must be completely clean before mod export.");
  }

  const trackedOutput = gitBytes(
    repositoryRoot,
    ["ls-tree", "-r", "--name-only", "-z", commit, "--", "data/published"],
    "Cannot inspect committed publication files.",
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  const currentOutput = (await listRegularFiles(publishedRoot)).map(
    (path) => `data/published/${path}`,
  );
  if (
    trackedOutput.length === 0 ||
    trackedOutput.length !== currentOutput.length ||
    trackedOutput.some((path, index) => path !== currentOutput[index])
  ) {
    throw new Error("Canonical data/published files do not exactly match the source commit.");
  }

  for (const path of trackedOutput) {
    const current = await readFile(resolve(repositoryRoot, path));
    const committed = gitBytes(
      repositoryRoot,
      ["show", `${commit}:${path}`],
      "Cannot read a committed publication file.",
    );
    if (!current.equals(committed)) {
      throw new Error("Canonical data/published bytes do not match the source commit.");
    }
  }

  const finalStatus = gitText(
    repositoryRoot,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "Cannot recheck the website checkout status.",
  );
  if (finalStatus) {
    throw new Error("The website checkout changed while its publication source was verified.");
  }

  return { repository, commit };
}
