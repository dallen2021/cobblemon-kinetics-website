import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemSlot, MaterialPanel, PageHeading, RegistryId, StatusLamp } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getPublishedCatalog();
  const machine = catalog.machines.find((item) => item.slug === slug);
  if (!machine) notFound();
  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <Link href="/wiki/machines">Machines</Link>
        <span>/</span>
        <span>{machine.name}</span>
      </div>
      <PageHeading
        eyebrow={machine.category}
        title={machine.name}
        description={machine.summary}
        actions={<StatusLamp tone="green" label={machine.status} />}
      />
      <div className="detail-grid">
        <MaterialPanel eyebrow="Registry" title="Machine binding">
          <StatusLamp tone="amber" label="Visual pending approved source" />
          <ItemSlot active label={machine.name} registryId={machine.registryId} />
          <p>This exact namespaced ID is pinned in the published profile.</p>
        </MaterialPanel>
        <MaterialPanel eyebrow="Assembly" title="Functional components">
          <ul className="check-list">
            {machine.components.map((component) => (
              <li key={component}>{component}</li>
            ))}
          </ul>
        </MaterialPanel>
      </div>
      <p className="source-note">
        Registry identity: <RegistryId>{machine.registryId}</RegistryId>
      </p>
    </main>
  );
}
