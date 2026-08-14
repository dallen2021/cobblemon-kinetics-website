import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const guardScript = resolve(import.meta.dirname, "check-repository-hygiene.mjs");

test("the repository guard scans the trackable .env.example file", () => {
  const fixture = mkdtempSync(join(tmpdir(), "kinetics-hygiene-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: fixture });
    const fakeSecret = ["sb", "secret", "abcdefghijklmnopqrstuvwxyz123456"].join("_");
    writeFileSync(join(fixture, ".env.example"), `SUPABASE_SECRET_KEY=${fakeSecret}\n`);
    execFileSync("git", ["add", ".env.example"], { cwd: fixture });

    const result = spawnSync(process.execPath, [guardScript], {
      cwd: fixture,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\.env\.example: contains a Supabase secret key/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("the website guard rejects Gradle build files and wrapper JARs", () => {
  const fixture = mkdtempSync(join(tmpdir(), "kinetics-hygiene-gradle-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: fixture });
    writeFileSync(join(fixture, "build.gradle.kts"), "plugins {}\n");
    mkdirSync(join(fixture, "gradle/wrapper"), { recursive: true });
    writeFileSync(join(fixture, "gradle/wrapper/gradle-wrapper.jar"), "not-a-real-jar");
    execFileSync(
      "git",
      ["add", "--force", "build.gradle.kts", "gradle/wrapper/gradle-wrapper.jar"],
      {
        cwd: fixture,
      },
    );

    const result = spawnSync(process.execPath, [guardScript], {
      cwd: fixture,
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /build\.gradle\.kts: Gradle build file/);
    assert.match(result.stderr, /gradle\/wrapper\/gradle-wrapper\.jar: Java or Gradle path/);
    assert.match(result.stderr, /gradle-wrapper\.jar: JARs belong in the separate mod repository/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
