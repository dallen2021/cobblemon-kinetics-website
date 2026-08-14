#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const defaultTarget = join(projectRoot, "apps/web/src/types/database.generated.ts");
const supabaseArguments = ["gen", "types", "typescript", "--local", "--schema", "public"];
const require = createRequire(import.meta.url);
const retryableErrorCodes = new Set([
  "EAI_AGAIN",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

function readPositiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return fallback;

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

export function normalizeGeneratedTypes(source) {
  const normalized = `${source.trimEnd()}\n`;
  if (
    !normalized.includes("export type Json =") ||
    !normalized.includes("export type Database =")
  ) {
    throw new Error("Supabase returned incomplete TypeScript database types.");
  }
  return normalized;
}

export function isRetryableGenerationFailure(details, errorCode) {
  if (errorCode && retryableErrorCodes.has(errorCode)) return true;
  return /(?:too\s*many\s*requests|rate exceeded|status(?: code)? 429|tls handshake timeout|i\/o timeout|connection reset|temporary failure|timed out)/iu.test(
    details,
  );
}

export function getSupabaseInvocation() {
  const packagePath = require.resolve("supabase/package.json");
  return {
    command: process.execPath,
    arguments: [join(dirname(packagePath), "dist/supabase.js"), ...supabaseArguments],
  };
}

function runSupabaseGenerator({ cwd, timeoutMs }) {
  const invocation = getSupabaseInvocation();
  return spawnSync(invocation.command, invocation.arguments, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
  });
}

function writeAtomically(targetPath, content) {
  mkdirSync(dirname(targetPath), { recursive: true });
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryPath, targetPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function formatFailure(result) {
  if (result.error) return result.error.message;
  if (result.signal) return `Supabase type generation was terminated by ${result.signal}.`;
  return `Supabase type generation exited with status ${result.status ?? "unknown"}.`;
}

const defaultSleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export async function generateDatabaseTypes({
  targetPath = defaultTarget,
  maxAttempts = readPositiveInteger("DB_TYPES_MAX_ATTEMPTS", 1),
  retryDelayMs = readPositiveInteger("DB_TYPES_RETRY_DELAY_MS", 15_000),
  timeoutMs = readPositiveInteger("DB_TYPES_TIMEOUT_MS", 120_000),
  runner = runSupabaseGenerator,
  sleep = defaultSleep,
  writeDiagnostic = (message) => process.stderr.write(message),
} = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runner({ cwd: projectRoot, timeoutMs });
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";

    if (result.status === 0 && !result.error && !result.signal) {
      if (stderr) writeDiagnostic(stderr);
      writeAtomically(targetPath, normalizeGeneratedTypes(stdout));
      return;
    }

    if (stdout) writeDiagnostic(stdout);
    if (stderr) writeDiagnostic(stderr);

    const failure = formatFailure(result);
    const details = `${failure}\n${stdout}\n${stderr}`;
    const errorCode =
      result.error && "code" in result.error && typeof result.error.code === "string"
        ? result.error.code
        : undefined;
    if (attempt < maxAttempts && isRetryableGenerationFailure(details, errorCode)) {
      const delay = retryDelayMs * attempt;
      writeDiagnostic(
        `${failure} Retrying database type generation in ${delay}ms (attempt ${attempt + 1}/${maxAttempts}).\n`,
      );
      await sleep(delay);
      continue;
    }

    throw new Error(failure);
  }
}

async function main() {
  try {
    await generateDatabaseTypes();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Database type generation failed: ${message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
