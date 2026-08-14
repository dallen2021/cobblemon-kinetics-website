import Link from "next/link";
import { MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { PublicationReconciler } from "@/features/studio/publication-reconciler";
import { isFixtureModeEnabled } from "@/lib/env";
import { isPublicationId } from "@/server/publication-reconciliation";
import { loadSquirtleDraft } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string | string[] }>;
}) {
  const draft = await loadSquirtleDraft();
  const requestedBatch = (await searchParams).batch;
  const initialPublicationId =
    typeof requestedBatch === "string" && isPublicationId(requestedBatch) ? requestedBatch : "";
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Database → Git handoff"
        title="Publications"
        description="Approval freezes an exact revision; only a reviewed commit makes it public."
      />
      <div className="publication-pipeline">
        <MaterialPanel eyebrow="1 · Draft" title={`Squirtle r${draft.revision}`}>
          <StatusLamp tone="green" label="Revision tracked" />
        </MaterialPanel>
        <span aria-hidden="true">→</span>
        <MaterialPanel
          eyebrow="2 · Approval"
          title={
            draft.workflowState === "approved" ? "Exact revision approved" : "Awaiting approval"
          }
        >
          <StatusLamp
            tone={draft.workflowState === "approved" ? "green" : "amber"}
            label={draft.workflowState}
          />
        </MaterialPanel>
        <span aria-hidden="true">→</span>
        <MaterialPanel eyebrow="3 · Git" title="Review deterministic files">
          <StatusLamp tone="amber" label="Manual PR gate" />
        </MaterialPanel>
      </div>
      <p className="source-note">
        Return to <Link href="/studio/pokemon/squirtle">the Squirtle editor</Link> to validate and
        approve the active revision.
      </p>
      <ol className="number-list publication-checklist">
        <li>Download the immutable bundle and run the deterministic local data apply command.</li>
        <li>Review the generated files in a pull request and merge them normally.</li>
        <li>
          Reconcile the exact merge commit below. Client-supplied manifests are never accepted.
        </li>
      </ol>
      <PublicationReconciler
        initialPublicationId={initialPublicationId}
        fixtureMode={isFixtureModeEnabled()}
      />
    </main>
  );
}
