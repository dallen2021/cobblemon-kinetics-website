import { notFound } from "next/navigation";
import { SquirtleEditor } from "@/features/studio/squirtle-editor";
import { isFixtureModeEnabled } from "@/lib/env";
import { loadSquirtleDraft } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function StudioPokemonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "squirtle" && id !== "cobblemon:squirtle") notFound();
  const record = await loadSquirtleDraft();
  return <SquirtleEditor initialRecord={record} fixtureMode={isFixtureModeEnabled()} />;
}
