import { EmptyState, MaterialPanel, PageHeading, RegistryId } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Publication history"
        title="Published changes"
        description="This page reports repository publications, not draft revision activity."
      />
      {catalog.publishedAt ? (
        <MaterialPanel eyebrow="Current manifest" title="Initial Hydro vertical slice">
          <p>
            Published <time dateTime={catalog.publishedAt}>{catalog.publishedAt.slice(0, 10)}</time>
          </p>
          <ul className="check-list">
            {catalog.pokemon.map((item) => (
              <li key={item.publicId}>
                Worker: <RegistryId>{item.publicId}</RegistryId>
              </li>
            ))}
            {catalog.jobs.map((item) => (
              <li key={item.publicId}>
                Job: <RegistryId>{item.publicId}</RegistryId>
              </li>
            ))}
            {catalog.machines.map((item) => (
              <li key={item.publicId}>
                Machine: <RegistryId>{item.publicId}</RegistryId>
              </li>
            ))}
          </ul>
        </MaterialPanel>
      ) : (
        <EmptyState title="No publication timestamp">
          <p>A committed manifest will provide the first changelog entry.</p>
        </EmptyState>
      )}
    </main>
  );
}
