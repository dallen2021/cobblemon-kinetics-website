import Link from "next/link";
import { EmptyState, PageHeading, RegistryId, StatusLamp, TypeChip } from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function PokemonDirectoryPage() {
  const catalog = await getPublishedCatalog();
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Published roster"
        title="Pokémon"
        description="Generation-aware worker records with explicit form and typing data."
      />
      {catalog.pokemon.length ? (
        <div className="table-shell">
          <table>
            <caption className="sr-only">Published Pokémon worker records</caption>
            <thead>
              <tr>
                <th>Dex</th>
                <th>Pokémon</th>
                <th>Type</th>
                <th>Identifier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.pokemon.map((pokemon) => (
                <tr key={pokemon.publicId}>
                  <td className="mono-cell">#{String(pokemon.nationalDex).padStart(3, "0")}</td>
                  <td>
                    <Link className="table-primary-link" href={`/wiki/pokemon/${pokemon.slug}`}>
                      {pokemon.name}
                    </Link>
                  </td>
                  <td>
                    <div className="chip-row">
                      {pokemon.currentTypes.map((type) => (
                        <TypeChip key={type} type={type} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <RegistryId>{pokemon.publicId}</RegistryId>
                  </td>
                  <td>
                    <StatusLamp tone="green" label={pokemon.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No published Pokémon">
          <p>Approve and export a worker record to populate this directory.</p>
        </EmptyState>
      )}
    </main>
  );
}
