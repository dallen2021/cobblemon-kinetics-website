import { RecordDirectory } from "@/features/studio/record-directory";
import { listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function TypeWorkshopDirectoryPage() {
  const { items } = await listStudioRecords({ kind: "type_workshop", limit: 50 });
  return (
    <RecordDirectory
      records={items}
      kind="type_workshop"
      title="Type Workshop"
      description="Eighteen type directions, linked Pokémon, risks, decisions, and evidence are kept in one editable planning surface."
    />
  );
}
