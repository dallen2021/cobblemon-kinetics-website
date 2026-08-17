import { notFound } from "next/navigation";
import { PokemonEvolutionWorkspace } from "@/features/studio/pokemon-evolution-workspace";
import {
  listBlueprintLibrary,
  loadFamilyBlueprint,
  loadPokemonWorkspace,
} from "@/server/studio-repository";

export const dynamic = "force-dynamic";

async function loadWorkspace(id: string) {
  try {
    return await loadPokemonWorkspace(id);
  } catch {
    notFound();
  }
}

export default async function StudioPokemonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await loadWorkspace(id);
  const [blueprint, library] = await Promise.all([
    loadFamilyBlueprint(workspace.family.publicId),
    listBlueprintLibrary(),
  ]);

  return (
    <PokemonEvolutionWorkspace
      initialWorkspace={workspace}
      initialBlueprint={blueprint}
      library={library}
    />
  );
}
