import { RecordDirectory } from "@/features/studio/record-directory";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function JobDirectoryPage() {
  const { items } = await listStudioRecords({ kind: "job", limit: 200 });
  return (
    <RecordDirectory
      records={items}
      kind="job"
      title="Jobs"
      description="Jobs define capability and adapter boundaries without assigning Pokémon by implication."
    />
  );
}
