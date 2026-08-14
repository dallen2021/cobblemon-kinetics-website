import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemSlot, MaterialPanel, PageHeading, RegistryId } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function RegistryPage({
  params,
}: {
  params: Promise<{ namespace: string; path: string }>;
}) {
  const { namespace, path } = await params;
  const registryId = `${namespace}:${path}`;
  const catalog = await getPublishedCatalog();
  const machine = catalog.machines.find((item) => item.registryId === registryId);
  if (!machine) notFound();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Registry entry"
        title={machine.name}
        description="A versioned block or item identity referenced by a published machine workflow."
      />
      <MaterialPanel eyebrow={machine.category} title="Current binding">
        <ItemSlot active label={machine.name} registryId={machine.registryId} />
        <p>
          <Link href={`/wiki/machines/${machine.slug}`}>View machine workflow</Link>
        </p>
        <p>
          Stable ID: <RegistryId>{machine.publicId}</RegistryId>
        </p>
      </MaterialPanel>
    </main>
  );
}
