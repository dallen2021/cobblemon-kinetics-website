import { RecordDirectory } from "@/features/studio/record-directory";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioPokemonDirectoryPage() {
  const { items } = await listStudioRecords({ kind: "pokemon_species", limit: 200 });
  return (
    <RecordDirectory
      records={items}
      kind="pokemon_species"
      title="Pokémon directory"
      description="All 151 Generation 1 records are editable planning drafts. No job or owner is inferred."
    />
  );
}
