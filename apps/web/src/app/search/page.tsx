import Link from "next/link";
import { EmptyState, PageHeading, RegistryId, TypeChip } from "@/components/ui";
import { enforcePageAccess } from "@/lib/auth";
import { filterCatalog, getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await enforcePageAccess("wiki", "/search");
  const { q = "" } = await searchParams;
  const results = filterCatalog(await getPublishedCatalog(), q);
  const total = results.pokemon.length + results.jobs.length + results.machines.length;
  return (
    <main className="content-page">
      <PageHeading
        eyebrow="Registry search"
        title="Find a record"
        description="Search names, National Dex numbers, slugs, and namespaced identifiers."
      />
      <form className="search-form" action="/search" method="get" role="search">
        <label htmlFor="global-search">Search published records</label>
        <div>
          <input
            id="global-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Squirtle, #007, or cobblemon:squirtle"
          />
          <button className="button button-primary" type="submit">
            Search
          </button>
        </div>
      </form>
      {q && total === 0 ? (
        <EmptyState title="No published record matched">
          <p>Draft records are intentionally excluded from global wiki search.</p>
        </EmptyState>
      ) : null}
      {q && total ? (
        <div className="search-results">
          {results.pokemon.map((item) => (
            <Link className="search-result" href={`/wiki/pokemon/${item.slug}`} key={item.publicId}>
              <span>
                <strong>{item.name}</strong>
                <RegistryId>{item.publicId}</RegistryId>
              </span>
              <span className="chip-row">
                {item.currentTypes.map((type) => (
                  <TypeChip key={type} type={type} />
                ))}
              </span>
            </Link>
          ))}
          {results.jobs.map((item) => (
            <Link className="search-result" href={`/wiki/jobs/${item.slug}`} key={item.publicId}>
              <span>
                <strong>{item.name}</strong>
                <RegistryId>{item.publicId}</RegistryId>
              </span>
              <span>{item.category}</span>
            </Link>
          ))}
          {results.machines.map((item) => (
            <Link
              className="search-result"
              href={`/wiki/machines/${item.slug}`}
              key={item.publicId}
            >
              <span>
                <strong>{item.name}</strong>
                <RegistryId>{item.registryId}</RegistryId>
              </span>
              <span>{item.category}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </main>
  );
}
