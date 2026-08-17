import { notFound } from "next/navigation";
import { StudioRecordWorkspace } from "@/features/studio/pokemon-workspace";
import { loadStudioRecord } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

async function loadMachineWorkspace(id: string) {
  try {
    return await loadStudioRecord(id);
  } catch {
    notFound();
  }
}

export default async function StudioMachinePage({ params }: { params: Promise<{ id: string }> }) {
  const record = await loadMachineWorkspace((await params).id);
  if (record.recordKind !== "machine" && record.recordKind !== "machine_research") notFound();
  return <StudioRecordWorkspace initialRecord={record} />;
}
