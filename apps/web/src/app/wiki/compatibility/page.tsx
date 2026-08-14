import Link from "next/link";
import { EfficiencyGauge, EmptyState, PageHeading, RegistryId, TypeChip } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function CompatibilityPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page wide-page">
      <PageHeading
        eyebrow="Published relationships"
        title="Compatibility matrix"
        description="Every row binds a worker, job, machine, and reviewed balance rationale."
      />
      {catalog.compatibility.length ? (
        <div className="table-shell">
          <table>
            <caption className="sr-only">Published worker compatibility assignments</caption>
            <thead>
              <tr>
                <th>Pokémon</th>
                <th>Job</th>
                <th>Machine</th>
                <th>Efficiency</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {catalog.compatibility.map((entry) => {
                const pokemon = catalog.pokemon.find((item) => item.publicId === entry.pokemonId);
                const job = catalog.jobs.find((item) => item.publicId === entry.jobId);
                const machine = catalog.machines.find(
                  (item) =>
                    item.publicId === entry.machineId || item.registryId === entry.machineId,
                );
                return (
                  <tr key={`${entry.pokemonId}:${entry.jobId}:${entry.machineId}`}>
                    <td>
                      {pokemon ? (
                        <>
                          <Link
                            className="table-primary-link"
                            href={`/wiki/pokemon/${pokemon.slug}`}
                          >
                            {pokemon.name}
                          </Link>
                          <div className="chip-row compact">
                            {pokemon.currentTypes.map((type) => (
                              <TypeChip type={type} key={type} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <RegistryId>{entry.pokemonId}</RegistryId>
                      )}
                    </td>
                    <td>
                      {job ? (
                        <Link href={`/wiki/jobs/${job.slug}`}>{job.name}</Link>
                      ) : (
                        <RegistryId>{entry.jobId}</RegistryId>
                      )}
                    </td>
                    <td>
                      {machine ? (
                        <Link href={`/wiki/machines/${machine.slug}`}>{machine.name}</Link>
                      ) : (
                        <RegistryId>{entry.machineId}</RegistryId>
                      )}
                    </td>
                    <td>
                      <EfficiencyGauge value={entry.efficiency} />
                    </td>
                    <td className="rationale-cell">{entry.rationale}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No compatibility assignments">
          <p>Only Git-published assignments appear in this matrix.</p>
        </EmptyState>
      )}
    </main>
  );
}
