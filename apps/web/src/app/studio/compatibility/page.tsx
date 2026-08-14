import Link from "next/link";
import {
  EfficiencyGauge,
  ItemSlot,
  MaterialPanel,
  PageHeading,
  RegistryId,
  TypeChip,
} from "@/components/ui";
import { loadSquirtleDraft } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioCompatibilityPage() {
  const draft = await loadSquirtleDraft();
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Draft relationships"
        title="Compatibility editor"
        description="The first matrix row proves the assignment model before full Generation 1 bulk tooling."
        actions={
          <Link className="button button-secondary" href="/studio/pokemon/squirtle">
            Edit full record
          </Link>
        }
      />
      <MaterialPanel eyebrow="Worker × job × machine" title="Hydro assignment">
        <div className="compatibility-row">
          <div>
            <span className="compatibility-label">Worker</span>
            <strong>Squirtle</strong>
            <TypeChip type="Water" />
            <RegistryId>cobblemon:squirtle</RegistryId>
          </div>
          <span className="compatibility-arrow" aria-hidden="true">
            →
          </span>
          <div>
            <span className="compatibility-label">Job</span>
            <strong>Hydro Operator</strong>
            <RegistryId>{draft.jobId}</RegistryId>
          </div>
          <span className="compatibility-arrow" aria-hidden="true">
            →
          </span>
          <div>
            <span className="compatibility-label">Machine</span>
            <ItemSlot active label="Hydro Coupler" registryId={draft.machineId} />
          </div>
          <EfficiencyGauge value={draft.efficiency} />
        </div>
      </MaterialPanel>
    </main>
  );
}
