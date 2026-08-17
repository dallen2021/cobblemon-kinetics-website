import { notFound } from "next/navigation";
import { StudioRecordWorkspace } from "@/features/studio/pokemon-workspace";
import { listStudioRecords, loadStudioRecord } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

async function loadTypeWorkshop(id: string) {
  try {
    const record = await loadStudioRecord(id);
    if (record.recordKind !== "type_workshop") notFound();
    const { items: linkedRecords } = await listStudioRecords({
      kind: "pokemon_species",
      type: record.types[0],
      limit: 200,
    });
    return { record, linkedRecords };
  } catch {
    notFound();
  }
}

export default async function TypeWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { record, linkedRecords } = await loadTypeWorkshop((await params).id);
  return <StudioRecordWorkspace initialRecord={record} linkedRecords={linkedRecords} />;
}
