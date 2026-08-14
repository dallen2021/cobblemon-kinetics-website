import { EmptyState, ItemSlot, PageHeading, StatusLamp } from "@/components/ui";
import { WikiCard } from "@/components/wiki-card";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Registry-backed systems"
        title="Machines"
        description="Workstations are modeled as workflows and connected to exact block or item identifiers."
      />
      {catalog.machines.length ? (
        <div className="panel-grid">
          {catalog.machines.map((machine) => (
            <WikiCard
              href={`/wiki/machines/${machine.slug}`}
              eyebrow={machine.category}
              title={machine.name}
              key={machine.publicId}
              footer={<StatusLamp tone="green" label={machine.status} />}
            >
              <p>{machine.summary}</p>
              <ItemSlot label={machine.name} registryId={machine.registryId} />
            </WikiCard>
          ))}
        </div>
      ) : (
        <EmptyState title="No published machines">
          <p>Machines appear after a publication reaches main.</p>
        </EmptyState>
      )}
    </main>
  );
}
