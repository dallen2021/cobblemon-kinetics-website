#!/usr/bin/env node
import { grantAccess, type ApplicationRole } from "../access/grant-access.js";
import { assertAllowedArgs, parseArgs, requiredFlag } from "../lib/args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertAllowedArgs(args, { flags: ["github-user", "role"] });
  const githubUser = requiredFlag(args, "github-user");
  const role = requiredFlag(args, "role");
  if (!(["maintainer", "editor", "viewer"] as string[]).includes(role)) {
    throw new Error("--role must be maintainer, editor, or viewer.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }

  const entry = await grantAccess({
    githubUser,
    role: role as ApplicationRole,
    supabaseUrl,
    supabaseSecretKey,
    ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
  });
  console.log(
    `Granted ${entry.role} access to ${entry.github_login} (GitHub user ${entry.github_user_id}).`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
