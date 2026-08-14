"use client";

import { useState } from "react";
import { StatusLamp } from "@/components/ui";
import {
  reconcilePublicationCommit,
  type ReconcilePublicationResult,
} from "@/server/studio-actions";

export function PublicationReconciler({
  initialPublicationId,
  fixtureMode,
}: {
  initialPublicationId: string;
  fixtureMode: boolean;
}) {
  const [publicationId, setPublicationId] = useState(initialPublicationId);
  const [commitSha, setCommitSha] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReconcilePublicationResult | null>(null);

  async function reconcile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || fixtureMode) return;
    setPending(true);
    setResult(null);
    try {
      setResult(await reconcilePublicationCommit({ publicationId, commitSha }));
    } catch {
      setResult({
        ok: false,
        kind: "error",
        message: "The publication could not be reconciled.",
      });
    } finally {
      setPending(false);
    }
  }

  const status = result?.ok
    ? { tone: "green" as const, label: "Published and verified" }
    : result
      ? { tone: "red" as const, label: "Verification failed" }
      : { tone: "amber" as const, label: "Awaiting Git commit" };

  return (
    <section className="reconciliation-panel" aria-labelledby="reconciliation-title">
      <div className="reconciliation-heading">
        <div>
          <p className="eyebrow">Final publication gate</p>
          <h2 id="reconciliation-title">Verify the Git commit</h2>
        </div>
        <StatusLamp tone={status.tone} label={status.label} />
      </div>
      <p>
        After the deterministic files are merged, enter the exact commit. The server fetches
        <code> data/published/manifest.json</code> from that SHA, matches it to the frozen database
        batch, and only then records the publication as published.
      </p>

      <form className="reconciliation-form" onSubmit={(event) => void reconcile(event)}>
        <label htmlFor="publication-id">Publication batch ID</label>
        <input
          id="publication-id"
          name="publicationId"
          value={publicationId}
          onChange={(event) => {
            setPublicationId(event.target.value);
            setResult(null);
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder="publication-20260814-squirtle-hydro-r13-…"
          required
          maxLength={64}
          pattern="[a-z0-9][a-z0-9-]{0,63}"
        />
        <label htmlFor="git-commit-sha">Exact Git commit SHA</label>
        <input
          id="git-commit-sha"
          name="commitSha"
          value={commitSha}
          onChange={(event) => {
            setCommitSha(event.target.value);
            setResult(null);
          }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="40 lowercase hexadecimal characters"
          required
          minLength={40}
          maxLength={40}
          pattern="[a-f0-9]{40}"
        />
        <button className="button button-primary" type="submit" disabled={pending || fixtureMode}>
          {pending ? "Verifying commit…" : "Verify and mark published"}
        </button>
      </form>

      {fixtureMode ? (
        <p className="callout callout-warning">
          Reconciliation is disabled in fixture mode because no local fixture may mark a real Git
          commit as published.
        </p>
      ) : null}
      <div className="reconciliation-result" aria-live="polite" role="status">
        {result?.ok ? (
          <p>
            Batch <code>{result.publicationId}</code> is bound to commit{" "}
            <code>{result.commitSha}</code> and was marked published at{" "}
            <time dateTime={result.publishedAt}>{result.publishedAt}</time>.
          </p>
        ) : result ? (
          <p className="form-error">{result.message}</p>
        ) : null}
      </div>
    </section>
  );
}
