import { createHash } from "node:crypto";
import type { PublicationBundle, PublicationBundlePayload } from "@cobblemon-kinetics/domain";
import type { SquirtleEditorValues } from "@/features/studio/validation";
import {
  batchIdForPublication,
  compactCanonicalJson,
  createLocalPublicationBundle,
  createPublicationBundle,
} from "./publication-bundle";

interface FixturePublicationInput extends SquirtleEditorValues {
  expectedRevision: number;
}

interface FixturePublicationRepository {
  bundles: Map<string, PublicationBundle>;
}

const fixtureGlobal = globalThis as typeof globalThis & {
  __cobblemonKineticsFixturePublications?: FixturePublicationRepository;
};

function repository(): FixturePublicationRepository {
  fixtureGlobal.__cobblemonKineticsFixturePublications ??= { bundles: new Map() };
  return fixtureGlobal.__cobblemonKineticsFixturePublications;
}

function fixtureBatchId(records: PublicationBundlePayload["records"], revision: number): string {
  const projectionHash = createHash("sha256")
    .update(compactCanonicalJson(records))
    .digest("hex")
    .slice(0, 10);
  return `publication-20260814-squirtle-hydro-r${revision}-${projectionHash}`;
}

export async function createFixturePublicationBatch(
  input: FixturePublicationInput,
): Promise<{ publicationId: string; bundle: PublicationBundle }> {
  const local = await createLocalPublicationBundle("fixture-source");
  const records = structuredClone(local.records);
  const pokemon = records.pokemon.find(
    (record) => record.public_id === "cobblemon_kinetics:pokemon/squirtle",
  );
  const profile = records.work_profiles.find(
    (record) => record.id === "cobblemon_kinetics:hydro_operator",
  );
  if (!pokemon || !profile) {
    throw new Error("The fixture publication source is incomplete.");
  }
  const assignment = pokemon.work_assignments.find(
    (item) => item.work_profile_id === "cobblemon_kinetics:hydro_operator",
  );
  if (!assignment) {
    throw new Error("The Squirtle fixture has no Hydro assignment.");
  }

  assignment.efficiency_multiplier = input.efficiency;
  assignment.public_rationale = input.publicRationale.trim();
  profile.contribution.efficiency_multiplier = input.efficiency;
  profile.public_rationale = input.publicRationale.trim();

  const publicationId = fixtureBatchId(records, input.expectedRevision);
  const payload: PublicationBundlePayload = {
    bundle_version: 1,
    schema_version: local.schema_version,
    batch_id: batchIdForPublication(publicationId),
    records,
    asset_manifest: structuredClone(local.asset_manifest),
  };
  const bundle = createPublicationBundle(payload);
  const store = repository().bundles;
  store.set(publicationId, structuredClone(bundle));
  while (store.size > 20) {
    const oldest = store.keys().next().value as string | undefined;
    if (!oldest) break;
    store.delete(oldest);
  }
  return { publicationId, bundle: structuredClone(bundle) };
}

export function getFixturePublicationBundle(publicationId: string): PublicationBundle | null {
  const bundle = repository().bundles.get(publicationId);
  return bundle ? structuredClone(bundle) : null;
}

export function clearFixturePublicationBatches(): void {
  repository().bundles.clear();
}
