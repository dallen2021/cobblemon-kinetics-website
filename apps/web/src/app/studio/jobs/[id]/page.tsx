import { StudioPlaceholder } from "@/components/studio-placeholder";
import { RegistryId } from "@/components/ui";

export default async function StudioJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StudioPlaceholder
      eyebrow="Job workspace"
      title="Structured job editor"
      description="The Hydro job is edited through the Squirtle vertical slice before generalized job forms are enabled."
      status="Phase 5"
    >
      <p>
        Requested job: <RegistryId>{decodeURIComponent(id)}</RegistryId>
      </p>
      <p>
        Eligibility, behaviors, adapters, and version scope remain first-class schema fields rather
        than a free-form document.
      </p>
    </StudioPlaceholder>
  );
}
