import { ClockCounterClockwise } from "@phosphor-icons/react/ssr";
import { MaterialPanel, PageHeading } from "@/components/ui";
import { listStudioAuditEvents } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const events = await listStudioAuditEvents();
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Immutable audit trail"
        title="Revision history"
        description="Rollback creates a new revision; prior evidence is never rewritten."
      />
      <MaterialPanel eyebrow="All records" title={`${events.length} recent audit events`}>
        <ol className="revision-list history-page-list">
          {events.map((event) => (
            <li key={event.id}>
              <span>
                <ClockCounterClockwise aria-hidden="true" />{" "}
                {event.afterRevision ? `r${event.afterRevision}` : "—"}
              </span>
              <div>
                <strong>{event.action.replaceAll(".", " ")}</strong>
                <small>
                  {event.recordId ?? "Studio"} · {event.createdAt.slice(0, 10)}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </MaterialPanel>
    </main>
  );
}
