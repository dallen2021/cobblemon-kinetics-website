import { notFound } from "next/navigation";
import { StudioRecordWorkspace } from "@/features/studio/pokemon-workspace";
import { loadStudioRecord } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

async function loadJobWorkspace(id: string) {
  try {
    return await loadStudioRecord(id);
  } catch {
    notFound();
  }
}

export default async function StudioJobPage({ params }: { params: Promise<{ id: string }> }) {
  const record = await loadJobWorkspace((await params).id);
  if (record.recordKind !== "job") notFound();
  return <StudioRecordWorkspace initialRecord={record} />;
}
