import { Workboard } from "@/features/studio/workboard";
import { listStudioMembers, listStudioRecords } from "@/server/studio-repository";

export const dynamic = "force-dynamic";

export default async function WorkboardPage() {
  const [{ items }, members] = await Promise.all([
    listStudioRecords({ kind: "work_item", limit: 200 }),
    listStudioMembers(),
  ]);
  return <Workboard tasks={items} members={members} />;
}
