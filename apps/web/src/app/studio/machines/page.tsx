import { RecordDirectory } from "@/features/studio/record-directory";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function MachineDirectoryPage() {
  const [machines, research] = await Promise.all([
    listStudioRecords({ kind: "machine", limit: 200 }),
    listStudioRecords({ kind: "machine_research", limit: 200 }),
  ]);
  const records = [...machines.items, ...research.items].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "en"),
  );
  return (
    <RecordDirectory
      records={records}
      kind="machine"
      title="Machines & system research"
      description="Registry-backed relationships and all eleven imported Create-system research records stay explicit; local-only source preview never becomes hosted artwork."
    />
  );
}
