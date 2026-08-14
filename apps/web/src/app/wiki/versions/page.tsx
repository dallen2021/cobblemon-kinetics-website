import { EmptyState, MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Compatibility sets"
        title="Supported versions"
        description="Published records are evaluated against exact Minecraft, Cobblemon, and Create versions."
      />
      {catalog.versions.length ? (
        <div className="panel-grid">
          {catalog.versions.map((version) => (
            <MaterialPanel key={version.id} eyebrow={version.status} title={version.label}>
              <dl className="definition-list">
                <div>
                  <dt>Minecraft</dt>
                  <dd>{version.minecraft}</dd>
                </div>
                <div>
                  <dt>Cobblemon</dt>
                  <dd>{version.cobblemon}</dd>
                </div>
                <div>
                  <dt>Create</dt>
                  <dd>{version.create}</dd>
                </div>
              </dl>
              <StatusLamp tone="teal" label={version.status} />
            </MaterialPanel>
          ))}
        </div>
      ) : (
        <EmptyState title="No published compatibility set">
          <p>The version catalog is created with the first publication.</p>
        </EmptyState>
      )}
    </main>
  );
}
