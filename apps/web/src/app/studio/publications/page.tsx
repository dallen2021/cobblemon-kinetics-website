import Link from "next/link";
import { MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { PublicationBatchBuilder } from "@/features/studio/publication-batch-builder";
import { isFixtureModeEnabled } from "@/lib/env";
import { isPublicationId } from "@/server/publication-reconciliation";
import { listStudioRecords } from "@/server/studio-repository";
import { PublicationReconciler } from "@/features/studio/publication-reconciler";

export const dynamic = "force-dynamic";

const publicationKinds = ["pokemon_species", "job", "machine", "work_profile"] as const;

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string | string[] }>;
}) {
  const [collections, requestedBatch] = await Promise.all([
    Promise.all(publicationKinds.map((kind) => listStudioRecords({ kind, limit: 200 }))),
    searchParams.then((params) => params.batch),
  ]);
  const publicationRecords = collections.flatMap((collection) => collection.items);
  const approvedRecords = publicationRecords.filter(
    (record) => record.workflowState === "approved",
  );
  const initialPublicationId =
    typeof requestedBatch === "string" && isPublicationId(requestedBatch) ? requestedBatch : "";
  const fixtureMode = isFixtureModeEnabled();

  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Database → Git handoff"
        title="Publications"
        description="A batch freezes exact approved revisions. Git review and a verified merge commit are still the only way content becomes published."
      />
      <div className="publication-pipeline">
        <MaterialPanel
          eyebrow="1 · Approval"
          title={`${approvedRecords.length} approved record${approvedRecords.length === 1 ? "" : "s"}`}
        >
          <StatusLamp
            tone={approvedRecords.length ? "green" : "amber"}
            label={approvedRecords.length ? "Ready to select" : "Awaiting approvals"}
          />
        </MaterialPanel>
        <span aria-hidden="true">→</span>
        <MaterialPanel eyebrow="2 · Freeze" title="Immutable dependency closure">
          <StatusLamp tone="teal" label="No silent additions" />
        </MaterialPanel>
        <span aria-hidden="true">→</span>
        <MaterialPanel eyebrow="3 · Git" title="Manual PR and reconcile gate">
          <StatusLamp tone="amber" label="No automatic commits" />
        </MaterialPanel>
      </div>
      <PublicationBatchBuilder approvedRecords={approvedRecords} fixtureMode={fixtureMode} />
      <ol className="number-list publication-checklist">
        <li>Download the immutable bundle and run the deterministic local data apply command.</li>
        <li>
          Review the generated files in a normal Git pull request and merge it into the default
          branch.
        </li>
        <li>
          Reconcile the exact merge commit below; the server independently verifies the manifest and
          files.
        </li>
      </ol>
      <p className="source-note">
        Need planning work before approval? Start in the{" "}
        <Link href="/studio/pokemon">Pokémon directory</Link> or the{" "}
        <Link href="/studio/workboard">neutral workboard</Link>.
      </p>
      <PublicationReconciler
        initialPublicationId={initialPublicationId}
        fixtureMode={fixtureMode}
      />
    </main>
  );
}
