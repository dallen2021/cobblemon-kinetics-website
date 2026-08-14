import Link from "next/link";
import { MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";
import { loadSquirtleDraft } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioDashboardPage() {
  const [catalog, squirtle] = await Promise.all([getPublishedCatalog(), loadSquirtleDraft()]);
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Private development source"
        title="Workshop overview"
        description="Draft progress is collaborative; assignment remains neutral until someone is explicitly added."
        actions={
          <Link className="button button-primary" href="/studio/pokemon/squirtle">
            Continue Hydro slice
          </Link>
        }
      />
      <div className="metric-grid">
        <MaterialPanel eyebrow="Vertical slice" title="1 active worker">
          <strong className="metric-value">#007</strong>
          <p>Squirtle is the only end-to-end editor target in this phase.</p>
        </MaterialPanel>
        <MaterialPanel eyebrow="Current revision" title={`Revision ${squirtle.revision}`}>
          <StatusLamp
            tone={squirtle.workflowState === "approved" ? "green" : "amber"}
            label={squirtle.workflowState.replace("_", " ")}
          />
          <p>Last changed by {squirtle.updatedBy}.</p>
        </MaterialPanel>
        <MaterialPanel eyebrow="Git publication" title={`${catalog.pokemon.length} worker record`}>
          <StatusLamp
            tone={catalog.pokemon.length ? "green" : "amber"}
            label={catalog.pokemon.length ? "Published source present" : "Awaiting first export"}
          />
          <p>The wiki never reads this draft database.</p>
        </MaterialPanel>
      </div>
      <div className="dashboard-grid">
        <MaterialPanel eyebrow="Next deliberate step" title="Complete the Hydro review">
          <ol className="number-list dashboard-checklist">
            <li>Review the registry-backed machine selection.</li>
            <li>Validate the efficiency multiplier and public rationale.</li>
            <li>Approve one exact revision.</li>
            <li>Export and review the deterministic Git diff.</li>
          </ol>
        </MaterialPanel>
        <MaterialPanel eyebrow="Ownership policy" title="Unassigned by default">
          <p>
            Creating, suggesting, importing, or editing a task does not assign it. Explicit
            assignees remain a separate decision.
          </p>
          <StatusLamp tone="teal" label="Equal maintainer authority" />
        </MaterialPanel>
      </div>
    </main>
  );
}
