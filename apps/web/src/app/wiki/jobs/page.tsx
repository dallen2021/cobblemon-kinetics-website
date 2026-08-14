import { EmptyState, PageHeading, RegistryId, StatusLamp } from "@/components/ui";
import { WikiCard } from "@/components/wiki-card";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Capability catalog"
        title="Jobs"
        description="Eligibility and behavior contracts that can be connected to one or more machines."
      />
      {catalog.jobs.length ? (
        <div className="panel-grid">
          {catalog.jobs.map((job) => (
            <WikiCard
              href={`/wiki/jobs/${job.slug}`}
              eyebrow={job.category}
              title={job.name}
              key={job.publicId}
              footer={<StatusLamp tone="green" label={job.status} />}
            >
              <p>{job.summary}</p>
              <RegistryId>{job.publicId}</RegistryId>
            </WikiCard>
          ))}
        </div>
      ) : (
        <EmptyState title="No published jobs">
          <p>Jobs appear after a publication reaches main.</p>
        </EmptyState>
      )}
    </main>
  );
}
