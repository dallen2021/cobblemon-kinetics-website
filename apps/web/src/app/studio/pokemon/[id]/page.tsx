import { notFound } from "next/navigation";
import { StudioRecordWorkspace } from "@/features/studio/pokemon-workspace";
import { loadStudioRecord } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

async function loadPokemonWorkspace(id: string) {
  try {
    return await loadStudioRecord(id);
  } catch {
    notFound();
  }
}

export default async function StudioPokemonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await loadPokemonWorkspace(id);
  if (record.recordKind !== "pokemon_species") notFound();
  return <StudioRecordWorkspace initialRecord={record} />;
}
