import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EfficiencyGauge,
  MaterialPanel,
  PageHeading,
  RegistryId,
  StatusLamp,
  TypeChip,
} from "@/components/ui";
import { getPublishedCatalog } from "@/data/catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pokemon = (await getPublishedCatalog()).pokemon.find((item) => item.slug === slug);
  return { title: pokemon?.name ?? "Pokémon record" };
}

export default async function PokemonDetailPage({ params }: Props) {
  const { slug } = await params;
  const catalog = await getPublishedCatalog();
  const pokemon = catalog.pokemon.find((item) => item.slug === slug);
  if (!pokemon) notFound();
  const assignments = catalog.compatibility.filter((item) => item.pokemonId === pokemon.publicId);
  return (
    <main className="content-page">
      <div className="breadcrumbs">
        <Link href="/wiki">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/pokemon">Pokémon</Link>
        <span>/</span>
        <span>{pokemon.name}</span>
      </div>
      <PageHeading
        eyebrow={`National Dex #${String(pokemon.nationalDex).padStart(3, "0")}`}
        title={pokemon.name}
        description={pokemon.summary}
        actions={
          <div className="chip-row">
            {pokemon.currentTypes.map((type) => (
              <TypeChip key={type} type={type} />
            ))}
            <StatusLamp tone="green" label={pokemon.status} />
          </div>
        }
      />
      <section className="worker-class-art" aria-labelledby="worker-class-art-title">
        <div>
          <p className="eyebrow">Source-backed visuals only</p>
          <h2 id="worker-class-art-title">Species artwork pending</h2>
          <p>
            This record stays data-first until an exact species asset has passed source, license,
            attribution, and visibility review. Generated stand-ins are not used.
          </p>
        </div>
        <div className="record-token worker-record-token" aria-hidden="true">
          {String(pokemon.nationalDex).padStart(3, "0")}
        </div>
      </section>
      <div className="detail-grid">
        <MaterialPanel title="Published facts" eyebrow="Worker record">
          <dl className="definition-list">
            <div>
              <dt>Identifier</dt>
              <dd>
                <RegistryId>{pokemon.publicId}</RegistryId>
              </dd>
            </div>
            <div>
              <dt>Generation</dt>
              <dd>{pokemon.generation}</dd>
            </div>
            <div>
              <dt>Current typing</dt>
              <dd>{pokemon.currentTypes.join(" / ")}</dd>
            </div>
            <div>
              <dt>Original typing</dt>
              <dd>{pokemon.originalTypes.join(" / ")}</dd>
            </div>
          </dl>
        </MaterialPanel>
        <MaterialPanel title="Work compatibility" eyebrow="Approved profiles">
          {assignments.length ? (
            assignments.map((assignment) => {
              const job = catalog.jobs.find((item) => item.publicId === assignment.jobId);
              const machine = catalog.machines.find(
                (item) =>
                  item.publicId === assignment.machineId ||
                  item.registryId === assignment.machineId,
              );
              return (
                <article
                  className="assignment-summary"
                  key={`${assignment.jobId}:${assignment.machineId}`}
                >
                  <div>
                    <h3>{job?.name ?? assignment.jobId}</h3>
                    <p>{machine?.name ?? assignment.machineId}</p>
                  </div>
                  <EfficiencyGauge value={assignment.efficiency} />
                  <p>{assignment.rationale}</p>
                  {job ? <Link href={`/wiki/jobs/${job.slug}`}>Open job profile</Link> : null}
                </article>
              );
            })
          ) : (
            <p>No work profiles are published for this form.</p>
          )}
        </MaterialPanel>
      </div>
      <p className="source-note">
        This page is rendered exclusively from Git-published records. Private notes and draft
        revisions are not loaded.
      </p>
    </main>
  );
}
