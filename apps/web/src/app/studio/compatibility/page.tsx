import { CompatibilityMatrix } from "@/features/studio/compatibility-matrix";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioCompatibilityPage() {
  const { items } = await listStudioRecords({ kind: "pokemon_species", limit: 200 });
  return <CompatibilityMatrix records={items} />;
}
