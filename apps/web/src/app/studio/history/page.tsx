import { MaterialPanel, PageHeading } from "@/components/ui";
import { loadSquirtleDraft } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const draft = await loadSquirtleDraft();
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Immutable audit trail"
        title="Revision history"
        description="Rollback creates a new revision; prior evidence is never rewritten."
      />
      <MaterialPanel eyebrow="Squirtle" title={`${draft.revisions.length} recent revisions`}>
        <ol className="revision-list history-page-list">
          {draft.revisions.map((revision) => (
            <li key={`${revision.revision}:${revision.at}`}>
              <span>r{revision.revision}</span>
              <div>
                <strong>{revision.summary}</strong>
                <small>
                  {revision.actor} · {revision.at.slice(0, 10)}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </MaterialPanel>
    </main>
  );
}
