#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, join, relative, resolve } from "node:path";
import { fetchSupabaseService, requireSafeSupabaseUrl } from "./supabase-url-policy.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const backupRoot = join(projectRoot, ".private", "backups");
const recipient = process.env.BACKUP_AGE_RECIPIENT?.trim();
const requestedSource = process.env.BACKUP_SOURCE?.trim() || "linked";
const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredSupabaseSecret = process.env.SUPABASE_SECRET_KEY;
const backupSupabaseUrl =
  configuredSupabaseUrl && configuredSupabaseSecret
    ? requireSafeSupabaseUrl(configuredSupabaseUrl)
    : null;
if (requestedSource !== "local" && requestedSource !== "linked") {
  throw new Error("BACKUP_SOURCE must be either local or linked.");
}
const source = requestedSource;

if (!recipient) {
  throw new Error("BACKUP_AGE_RECIPIENT is required; no unencrypted backup will be written.");
}

for (const command of ["age", "tar"]) {
  const exists = (process.env.PATH ?? "").split(delimiter).some((directory) => {
    try {
      accessSync(join(directory, command), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (!exists) {
    throw new Error(`${command} is required to create encrypted prototype backups.`);
  }
}

mkdirSync(backupRoot, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "cobblemon-kinetics-backup-"));
const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const archiveName = `cobblemon-kinetics-${source}-${timestamp}.tar.gz`;
const archivePath = join(temporary, archiveName);
const encryptedPath = join(backupRoot, `${archiveName}.age`);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

async function createStorageManifest() {
  if (!backupSupabaseUrl || !configuredSupabaseSecret) {
    return {
      formatVersion: 1,
      captured: false,
      warning:
        "Storage inventory was not captured because NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY was unavailable.",
      buckets: [],
    };
  }

  const headers = {
    apikey: configuredSupabaseSecret,
    authorization: `Bearer ${configuredSupabaseSecret}`,
    "content-type": "application/json",
  };
  const bucketResponse = await fetchSupabaseService(
    new URL("/storage/v1/bucket", backupSupabaseUrl),
    { headers, signal: AbortSignal.timeout(10_000) },
  );
  if (!bucketResponse.ok) {
    throw new Error(`Storage bucket inventory failed with HTTP ${bucketResponse.status}.`);
  }

  const buckets = await bucketResponse.json();
  const inventory = [];
  for (const bucket of buckets.sort((left, right) => left.name.localeCompare(right.name))) {
    const objects = [];
    const prefixes = [""];
    while (prefixes.length > 0) {
      const prefix = prefixes.shift();
      let offset = 0;
      while (true) {
        const response = await fetchSupabaseService(
          new URL(`/storage/v1/object/list/${encodeURIComponent(bucket.name)}`, backupSupabaseUrl),
          {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
              prefix,
              limit: 1000,
              offset,
              sortBy: { column: "name", order: "asc" },
            }),
          },
        );
        if (!response.ok) {
          throw new Error(
            `Storage inventory for ${bucket.name}/${prefix} failed with HTTP ${response.status}.`,
          );
        }
        const page = await response.json();
        for (const item of page) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.metadata == null) {
            prefixes.push(path);
          } else {
            objects.push({
              path,
              createdAt: item.created_at ?? null,
              updatedAt: item.updated_at ?? null,
              size: item.metadata.size ?? null,
              mimeType: item.metadata.mimetype ?? null,
              etag: item.metadata.eTag ?? item.metadata.etag ?? null,
            });
          }
        }
        if (page.length < 1000) break;
        offset += page.length;
      }
    }
    inventory.push({
      id: bucket.id,
      name: bucket.name,
      public: Boolean(bucket.public),
      objects: objects.sort((left, right) => left.path.localeCompare(right.path)),
    });
  }

  return {
    formatVersion: 1,
    captured: true,
    warning: "This is an inventory, not a backup of object bytes.",
    buckets: inventory,
  };
}

try {
  const dumpCommands = [
    ["--role-only", "--file", join(temporary, "roles.sql")],
    ["--file", join(temporary, "schema.sql"), "--keep-comments"],
    ["--data-only", "--use-copy", "--file", join(temporary, "data.sql")],
  ];
  for (const flags of dumpCommands) {
    execFileSync("pnpm", ["exec", "supabase", "db", "dump", `--${source}`, ...flags], {
      cwd: projectRoot,
      stdio: "inherit",
    });
  }

  writeFileSync(
    join(temporary, "storage-manifest.json"),
    `${JSON.stringify(await createStorageManifest(), null, 2)}\n`,
    { mode: 0o600 },
  );

  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source,
    warning:
      "Prototype backup. Restore into a disposable environment and verify before relying on it.",
    files: listFiles(temporary)
      .filter((path) => statSync(path).isFile())
      .map((path) => ({ path: relative(temporary, path), sha256: sha256(path) })),
  };
  writeFileSync(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });

  execFileSync(
    "tar",
    [
      "-czf",
      archivePath,
      "roles.sql",
      "schema.sql",
      "data.sql",
      "storage-manifest.json",
      "manifest.json",
    ],
    {
      cwd: temporary,
      stdio: "inherit",
    },
  );
  execFileSync("age", ["--recipient", recipient, "--output", encryptedPath, archivePath], {
    stdio: "inherit",
  });

  console.log(`Encrypted prototype backup created: .private/backups/${basename(encryptedPath)}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
