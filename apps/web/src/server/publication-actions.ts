"use server";

import { headers } from "next/headers";
import { requireMaintainer } from "@/lib/auth";
import { getAppBaseUrl, hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";
import { createSignedPublicationBundleFromRpc } from "./publication-bundle";
import {
  fetchManifestAtCommit,
  isGitCommitSha,
  isPublicationId,
  parseReconciliationResult,
  verifyCommitOnPublicationBranch,
  verifyManifestFilesAtCommit,
  validateManifestForBundle,
} from "./publication-reconciliation";

export interface ReconcilePublicationInput {
  publicationId: string;
  commitSha: string;
}

export type ReconcilePublicationResult =
  | {
      ok: true;
      publicationId: string;
      commitSha: string;
      publishedAt: string;
    }
  | { ok: false; kind: "validation" | "conflict" | "error"; message: string };

async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl || origin !== appBaseUrl.origin) {
    throw new Error("Cross-origin Studio mutation rejected.");
  }
}

/**
 * Binds an already-exported generic publication to the reviewed Git commit.
 * The client supplies only an ID and SHA; this action retrieves and verifies
 * the manifest and every generated file itself before it calls the
 * service-only reconciliation RPC.
 */
export async function reconcilePublicationCommit(
  input: ReconcilePublicationInput,
): Promise<ReconcilePublicationResult> {
  await assertSameOrigin();
  const member = await requireMaintainer("/studio/publications");
  const publicationId = input.publicationId.trim();
  const commitSha = input.commitSha.trim();
  if (!isPublicationId(publicationId) || !isGitCommitSha(commitSha)) {
    return {
      ok: false,
      kind: "validation",
      message: "Enter a valid publication ID and the exact 40-character lowercase Git commit SHA.",
    };
  }
  if (isFixtureModeEnabled()) {
    return {
      ok: false,
      kind: "error",
      message: "Git reconciliation is unavailable in local fixture mode.",
    };
  }

  const signingKey = process.env.PUBLICATION_SIGNING_KEY;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!hasSupabaseEnvironment() || !process.env.SUPABASE_SECRET_KEY || !signingKey || !repository) {
    return {
      ok: false,
      kind: "error",
      message: "Publication reconciliation is not configured.",
    };
  }

  let adminSupabase: ReturnType<typeof createAdminSupabaseClient>;
  try {
    adminSupabase = createAdminSupabaseClient();
  } catch {
    return {
      ok: false,
      kind: "error",
      message: "Publication reconciliation is not configured.",
    };
  }

  const userSupabase = await createServerSupabaseClient();
  const { data: envelope, error: bundleError } = await userSupabase.rpc("get_publication_bundle", {
    p_publication_id: publicationId,
  });
  if (bundleError) {
    return {
      ok: false,
      kind: "error",
      message: "The frozen publication batch is unavailable.",
    };
  }

  let manifest: ReturnType<typeof validateManifestForBundle>;
  try {
    const bundle = createSignedPublicationBundleFromRpc(envelope, signingKey, publicationId);
    await verifyCommitOnPublicationBranch(repository, commitSha, process.env.PUBLICATION_BRANCH);
    const manifestValue = await fetchManifestAtCommit(repository, commitSha);
    manifest = validateManifestForBundle(manifestValue, bundle);
    await verifyManifestFilesAtCommit(repository, commitSha, manifest, bundle);
  } catch {
    return {
      ok: false,
      kind: "conflict",
      message:
        "That commit is not on the publication branch or its published files do not exactly match the frozen batch.",
    };
  }

  const { data, error } = await adminSupabase.rpc("reconcile_publication_commit", {
    p_publication_id: publicationId,
    p_git_commit_sha: commitSha,
    p_manifest: manifest as unknown as Json,
    p_actor_id: member.authUserId,
  });
  if (error) {
    const conflict = /conflict|mismatch|drift|not_reconcilable/u.test(
      `${error.code} ${error.message}`.toLocaleLowerCase(),
    );
    return {
      ok: false,
      kind: conflict ? "conflict" : "error",
      message: conflict
        ? "The publication changed or is already bound to a different commit."
        : "The publication could not be reconciled.",
    };
  }
  try {
    return {
      ok: true,
      ...parseReconciliationResult(data, publicationId, commitSha),
    };
  } catch {
    return {
      ok: false,
      kind: "error",
      message: "The reconciliation result failed integrity checks.",
    };
  }
}
