import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialPanel, PageHeading, RegistryId, StatusLamp } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getPublishedCatalog();
  const job = catalog.jobs.find((item) => item.slug === slug);
  if (!job) notFound();
  const machines = catalog.machines.filter(
    (machine) =>
      job.machineIds.includes(machine.publicId) || job.machineIds.includes(machine.registryId),
  );
  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <Link href="/wiki/jobs">Jobs</Link>
        <span>/</span>
        <span>{job.name}</span>
      </div>
      <PageHeading
        eyebrow={job.category}
        title={job.name}
        description={job.summary}
        actions={<StatusLamp tone="green" label={job.status} />}
      />
      <div className="detail-grid">
        <MaterialPanel eyebrow="Eligibility" title="Requirements">
          <ul className="check-list">
            {job.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </MaterialPanel>
        <MaterialPanel eyebrow="Runtime" title="Behavior">
          <ol className="number-list">
            {job.behaviors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </MaterialPanel>
      </div>
      <MaterialPanel eyebrow="Create handoff" title="Compatible machines">
        {machines.map((machine) => (
          <p key={machine.publicId}>
            <Link href={`/wiki/machines/${machine.slug}`}>{machine.name}</Link> ·{" "}
            <RegistryId>{machine.registryId}</RegistryId>
          </p>
        ))}
      </MaterialPanel>
    </main>
  );
}
