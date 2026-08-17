import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const failures = [];
const approvedPublicRasterFiles = new Set([
  "apps/web/public/art/generated/empty-workbench.webp",
  "apps/web/public/art/interface/frames/panel-frame-brass.png",
  "apps/web/public/art/interface/frames/panel-frame-steel.png",
  "apps/web/public/art/interface/frames/studio-frame-heavy.png",
  "apps/web/public/brand/cobblemon-kinetics-emblem.png",
  "apps/web/public/brand/cobblemon-kinetics-lockup-stacked-dark.png",
  "apps/web/public/brand/cobblemon-kinetics-lockup-transparent.png",
  "apps/web/public/brand/cobblemon-kinetics-wordmark.png",
  "apps/web/src/app/apple-icon.png",
  "apps/web/src/app/icon.png",
  "apps/web/src/app/opengraph-image.png",
  "apps/web/src/app/twitter-image.png",
]);
const forbiddenPathPatterns = [
  { pattern: /(^|\/)\.env(?!\.example$)/, reason: "untracked environment file" },
  { pattern: /(^|\/)\.private\//, reason: "private workspace data" },
  { pattern: /(^|\/)\.vercel\//, reason: "Vercel project metadata" },
  { pattern: /(^|\/)supabase\/\.temp\//, reason: "Supabase local metadata" },
  { pattern: /\.(?:xlsx|xlsm|xlsb|ods)$/i, reason: "raw workbook" },
  { pattern: /\.(?:pem|p12|pfx|key)$/i, reason: "credential material" },
  {
    pattern:
      /(^|\/)(?:build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|gradle\.properties|gradlew(?:\.bat)?)$/i,
    reason: "Gradle build file from the separate mod repository",
  },
  {
    pattern: /(^|\/)(?:gradle|src\/(?:main|test)\/java)(?:\/|$)/i,
    reason: "Java or Gradle path from the separate mod repository",
  },
];

const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".editorconfig",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".jsx",
  ".md",
  ".mjs",
  ".npmrc",
  ".properties",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

for (const file of files) {
  for (const { pattern, reason } of forbiddenPathPatterns) {
    if (pattern.test(file)) {
      failures.push(`${file}: ${reason} must not enter the repository`);
    }
  }

  if (file.endsWith(".jar")) {
    failures.push(`${file}: JARs belong in the separate mod repository, not this website`);
  }

  if (
    /^apps\/web\/(?:public\/|src\/app\/).+\.(?:avif|gif|jpe?g|png|webp)$/iu.test(file) &&
    !approvedPublicRasterFiles.has(file)
  ) {
    failures.push(
      `${file}: public raster is not present in the reviewed project-art allowlist; third-party game assets must stay under ignored .private`,
    );
  }

  const fileName = basename(file);
  if (fileName !== ".env.example" && !textExtensions.has(extname(file).toLowerCase())) continue;

  let content;
  try {
    if (statSync(file).size > 2_000_000) continue;
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (content.includes("\0")) continue;

  if (/(?:^|[\s"'=(])\/Users\/[A-Za-z0-9._-]+\//m.test(content)) {
    failures.push(`${file}: contains a machine-specific macOS user path`);
  }
  if (/(?:^|[\s"'=(])(?:[A-Za-z]:\\Users\\|\/home\/[A-Za-z0-9._-]+\/)/m.test(content)) {
    failures.push(`${file}: contains a machine-specific user path`);
  }
  if (/\bsbp_[A-Za-z0-9_-]{20,}\b/.test(content)) {
    failures.push(`${file}: contains a Supabase personal access token`);
  }
  if (/\bsb_secret_[A-Za-z0-9_-]{20,}\b/.test(content)) {
    failures.push(`${file}: contains a Supabase secret key`);
  }
}

if (failures.length > 0) {
  console.error("Repository hygiene check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Repository hygiene check passed for ${files.length} visible files.`);
