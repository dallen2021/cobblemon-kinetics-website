import { DownloadSimple, ShieldCheck } from "@phosphor-icons/react/ssr";
import { MaterialPanel, PageHeading, RegistryId, StatusLamp } from "@/components/ui";
import { listStudioImportRuns } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const runs = await listStudioImportRuns();
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Workbook migration"
        title="Import runs"
        description="Every source hash, transform, quarantine, and overwrite review remains private and auditable."
      />
      <MaterialPanel eyebrow="Controlled application" title="Required workflow">
        <ol className="number-list">
          <li>
            <DownloadSimple aria-hidden="true" /> Create and review a hash-locked dry-run report.
          </li>
          <li>Run an encrypted private backup before a hosted apply.</li>
          <li>
            Apply with the service-only import command; re-runs with the same source are a no-op.
          </li>
          <li>
            <ShieldCheck aria-hidden="true" /> Flavor text is quarantined and never enters public
            data or mod export.
          </li>
        </ol>
      </MaterialPanel>
      <div className="import-run-list">
        {runs.map((run) => (
          <MaterialPanel eyebrow={run.status} key={run.id} title={run.sourceFilename}>
            <div className="import-run-meta">
              <RegistryId>{`${run.sourceSha256.slice(0, 16)}…`}</RegistryId>
              <StatusLamp
                tone={
                  run.status === "completed" ? "green" : run.status === "failed" ? "red" : "amber"
                }
                label={run.status.replaceAll("_", " ")}
              />
            </div>
            <p className="fine-print">
              {Object.entries(run.summary)
                .map(([key, value]) => `${value} ${key.replaceAll("_", " ")}`)
                .join(" · ") || "No summary yet."}
            </p>
            <p className="fine-print">
              {run.quarantinedCount} quarantined fields · {run.reviewCount} unresolved overwrite
              reviews
            </p>
          </MaterialPanel>
        ))}
      </div>
    </main>
  );
}
