import Link from "next/link";
import { MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioDashboardPage() {
  const [pokemon, workItems, typePlans] = await Promise.all([
    listStudioRecords({ kind: "pokemon_species", limit: 200 }),
    listStudioRecords({ kind: "work_item", limit: 200 }),
    listStudioRecords({ kind: "type_workshop", limit: 50 }),
  ]);
  const ready = pokemon.items.filter((record) => record.workReady !== "not_started").length;
  const blocked = workItems.items.filter((record) => record.taskStatus === "blocked").length;
  const unassigned = workItems.items.filter((record) => record.taskStatus === "backlog").length;

  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Private development source"
        title="Workshop overview"
        description="Gen 1 planning is collaborative by default: records and tasks begin neutral, then Daniel or Jake explicitly assign, review, and publish work."
        actions={
          <Link className="button button-primary" href="/studio/pokemon">
            Open Pokémon directory
          </Link>
        }
      />
      <div className="metric-grid">
        <MaterialPanel eyebrow="Gen 1 records" title={`${pokemon.items.length} editable Pokémon`}>
          <strong className="metric-value">151</strong>
          <p>Every species begins as a draft with one neutral design task and no invented job.</p>
        </MaterialPanel>
        <MaterialPanel
          eyebrow="Planning coverage"
          title={`${typePlans.items.length} Type Workshop plans`}
        >
          <StatusLamp tone="teal" label={`${ready} candidate or later`} />
          <p>
            Type direction, risks, decisions, and source evidence remain editable planning data.
          </p>
        </MaterialPanel>
        <MaterialPanel
          eyebrow="Neutral workboard"
          title={`${workItems.items.length} tracked tasks`}
        >
          <StatusLamp
            tone={blocked ? "red" : "amber"}
            label={blocked ? `${blocked} blocked` : `${unassigned} unassigned backlog`}
          />
          <p>Creating, importing, or discussing a task never assigns it to either maintainer.</p>
        </MaterialPanel>
      </div>
      <div className="dashboard-grid">
        <MaterialPanel eyebrow="Recommended next step" title="Pick a Gen 1 design task">
          <ol className="number-list dashboard-checklist">
            <li>Search a Pokémon record by Dex, name, type, or registry ID.</li>
            <li>Capture candidate work, balance, testing, and private design context.</li>
            <li>Assign or share the linked task explicitly only when you choose to.</li>
            <li>Approve the exact record revision once the public fields are ready.</li>
          </ol>
        </MaterialPanel>
        <MaterialPanel eyebrow="Release boundary" title="Draft database, reviewed Git output">
          <p>
            The Studio is canonical for private collaboration. The wiki and any future mod export
            only read an approved, deterministic Git publication after review and reconciliation.
          </p>
          <div className="button-row">
            <Link className="button button-secondary" href="/studio/workboard">
              Open workboard
            </Link>
            <Link className="button button-secondary" href="/studio/publications">
              Open publications
            </Link>
          </div>
        </MaterialPanel>
      </div>
    </main>
  );
}
