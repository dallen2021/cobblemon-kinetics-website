import Link from "next/link";
import { EmptyState, PageHeading, StatusLamp } from "@/components/ui";
import { WikiCard } from "@/components/wiki-card";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function WikiPage() {
  const catalog = await getPublishedCatalog();
  const total = catalog.pokemon.length + catalog.jobs.length + catalog.machines.length;
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Git-published knowledge"
        title="Workshop wiki"
        description="Only records committed to the repository appear here. Draft comments and private notes never cross this boundary."
        actions={
          <StatusLamp tone={total ? "green" : "amber"} label={`${total} published records`} />
        }
      />
      {total ? (
        <div className="panel-grid panel-grid-three">
          <WikiCard href="/wiki/pokemon" eyebrow="Roster" title="Pokémon">
            <p className="wiki-card-index">Generation 1 · National Dex</p>
            <p>Browse workers by namespaced ID, National Dex number, or supported job.</p>
            <strong className="large-number">{catalog.pokemon.length}</strong>
          </WikiCard>
          <WikiCard href="/wiki/jobs" eyebrow="Capabilities" title="Jobs">
            <p className="wiki-card-index">Selectors · behavior · shutdown</p>
            <p>Inspect eligibility, behavior, shutdown rules, and linked machines.</p>
            <strong className="large-number">{catalog.jobs.length}</strong>
          </WikiCard>
          <WikiCard href="/wiki/machines" eyebrow="Create handoff" title="Machines">
            <p className="wiki-card-index">Registry-backed workstations</p>
            <p>Find registry-backed workstations and their supported workflows.</p>
            <strong className="large-number">{catalog.machines.length}</strong>
          </WikiCard>
        </div>
      ) : (
        <EmptyState title="No publication has reached main yet">
          <p>
            The private studio can still hold drafts, but this wiki remains empty until a reviewed
            export is committed.
          </p>
        </EmptyState>
      )}
      <div className="quick-links">
        <Link href="/wiki/compatibility">Compatibility matrix</Link>
        <Link href="/wiki/versions">Supported versions</Link>
        <Link href="/wiki/changelog">Published changes</Link>
      </div>
    </main>
  );
}
