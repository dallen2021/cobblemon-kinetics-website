import { ItemSlot } from "@/components/ui";
import { StudioPlaceholder } from "@/components/studio-placeholder";

export default async function StudioMachinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StudioPlaceholder
      eyebrow="Machine workspace"
      title="Registry-backed machine editor"
      description="Machine-wide research and component editing follow the working Hydro assignment flow."
      status="Phase 5"
    >
      <ItemSlot label="Machine candidate" registryId={decodeURIComponent(id)} />
    </StudioPlaceholder>
  );
}
