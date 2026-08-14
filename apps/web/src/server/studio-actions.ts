"use server";

import { headers } from "next/headers";
import type { SquirtleDraft } from "@/data/types";
import type { SquirtleEditorValues } from "@/features/studio/validation";
import { validateSquirtleEditor } from "@/features/studio/validation";
import { getAppBaseUrl, hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { requireEditor, requireMaintainer } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isCanonicalUuid } from "@/lib/uuid";
import type { Json } from "@/types/database.generated";
import { createFixturePublicationBatch } from "./fixture-publications";
import { createSignedPublicationBundleFromRpc, publicationIdFromRpc } from "./publication-bundle";
import { createFixtureRecord } from "./studio-fixture";
import { loadSquirtleDraft, normalizeSquirtleRpc } from "./studio-repository";
import {
  fetchManifestAtCommit,
  isGitCommitSha,
  isPublicationId,
  parseReconciliationResult,
  verifyCommitOnPublicationBranch,
  verifyManifestFilesAtCommit,
  validateManifestForBundle,
} from "./publication-reconciliation";

export interface SaveDraftInput extends SquirtleEditorValues {
  expectedRevision: number;
  clientMutationId: string;
}

export type SaveDraftResult =
  | { ok: true; record: SquirtleDraft }
  | { ok: false; kind: "validation"; messages: string[] }
  | { ok: false; kind: "conflict"; current: SquirtleDraft }
  | { ok: false; kind: "error"; message: string };

export type CreatePublicationResult =
  | { ok: true; publicationId: string }
  | { ok: false; kind: "validation" | "conflict" | "error"; message: string };

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
    throw new Error("Cross-origin studio mutation rejected.");
  }
}

export async function saveSquirtleDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  await assertSameOrigin();
  await requireEditor("/studio/pokemon/squirtle");
  const issues = validateSquirtleEditor(input);
  if (issues.length)
    return { ok: false, kind: "validation", messages: issues.map((issue) => issue.message) };
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    !isCanonicalUuid(input.clientMutationId)
  ) {
    return {
      ok: false,
      kind: "validation",
      messages: ["The revision or mutation identifier is invalid."],
    };
  }
  if (isFixtureModeEnabled()) return { ok: true, record: createFixtureRecord(input, "save") };
  if (!hasSupabaseEnvironment())
    return { ok: false, kind: "error", message: "Supabase is not configured." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("save_record_revision", {
    p_public_id: "cobblemon_kinetics:pokemon/squirtle",
    p_expected_revision: input.expectedRevision,
    p_client_mutation_id: input.clientMutationId,
    p_patch: {
      machine_id: input.machineId,
      job_id: input.jobId,
      efficiency: input.efficiency,
      public_rationale: input.publicRationale.trim(),
      private_note: input.privateNote,
    },
  });
  if (error) {
    if (
      error.code === "revision_conflict" ||
      error.message.toLocaleLowerCase().includes("revision_conflict")
    ) {
      return { ok: false, kind: "conflict", current: await loadSquirtleDraft() };
    }
    return {
      ok: false,
      kind: "error",
      message: "The draft could not be saved. No fields were overwritten.",
    };
  }
  return { ok: true, record: normalizeSquirtleRpc(data) };
}

export async function approveSquirtleDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
  await assertSameOrigin();
  await requireMaintainer("/studio/pokemon/squirtle");
  const issues = validateSquirtleEditor(input);
  if (issues.length)
    return { ok: false, kind: "validation", messages: issues.map((issue) => issue.message) };
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return { ok: false, kind: "validation", messages: ["The revision identifier is invalid."] };
  }
  if (isFixtureModeEnabled()) return { ok: true, record: createFixtureRecord(input, "approve") };
  if (!hasSupabaseEnvironment())
    return { ok: false, kind: "error", message: "Supabase is not configured." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("approve_record_revision", {
    p_public_id: "cobblemon_kinetics:pokemon/squirtle",
    p_expected_revision: input.expectedRevision,
  });
  if (error) {
    if (
      error.code === "revision_conflict" ||
      error.message.toLocaleLowerCase().includes("revision_conflict")
    ) {
      return { ok: false, kind: "conflict", current: await loadSquirtleDraft() };
    }
    return { ok: false, kind: "error", message: "Approval failed without changing the record." };
  }
  return { ok: true, record: normalizeSquirtleRpc(data) };
}

export async function createSquirtlePublicationBatch(
  input: SaveDraftInput,
): Promise<CreatePublicationResult> {
  await assertSameOrigin();
  await requireMaintainer("/studio/pokemon/squirtle");
  const issues = validateSquirtleEditor(input);
  if (issues.length) {
    return {
      ok: false,
      kind: "validation",
      message: issues.map((issue) => issue.message).join(" "),
    };
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return { ok: false, kind: "validation", message: "The approved revision is invalid." };
  }
  if (isFixtureModeEnabled()) {
    const { publicationId } = await createFixturePublicationBatch(input);
    return { ok: true, publicationId };
  }
  if (!hasSupabaseEnvironment()) {
    return { ok: false, kind: "error", message: "Supabase is not configured." };
  }
  const signingKey = process.env.PUBLICATION_SIGNING_KEY;
  if (!signingKey) {
    return { ok: false, kind: "error", message: "Publication signing is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_squirtle_publication_batch", {
    p_expected_revision: input.expectedRevision,
  });
  if (error) {
    if (
      error.code === "revision_conflict" ||
      error.message.toLocaleLowerCase().includes("revision")
    ) {
      return {
        ok: false,
        kind: "conflict",
        message: "The approved revision changed before the batch was frozen.",
      };
    }
    return { ok: false, kind: "error", message: "The publication batch could not be created." };
  }
  try {
    const publicationId = publicationIdFromRpc(data);
    createSignedPublicationBundleFromRpc(data, signingKey, publicationId);
    return { ok: true, publicationId };
  } catch {
    return {
      ok: false,
      kind: "error",
      message: "The publication batch failed integrity validation.",
    };
  }
}

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
