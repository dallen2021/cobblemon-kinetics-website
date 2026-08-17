import { CompatibilityMatrix } from "@/features/studio/compatibility-matrix";
import { listStudioRecords, listStudioRelationships } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioCompatibilityPage() {
  const [{ items }, relationships] = await Promise.all([
    listStudioRecords({ kind: "pokemon_species", limit: 200 }),
    listStudioRelationships(["assigned_to_job", "operates_at"]),
  ]);
  return <CompatibilityMatrix records={items} relationships={relationships} />;
}
