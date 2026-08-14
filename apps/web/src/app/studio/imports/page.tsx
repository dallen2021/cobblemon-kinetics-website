import { StudioPlaceholder } from "@/components/studio-placeholder";
import { RegistryId } from "@/components/ui";

export default function ImportsPage() {
  return (
    <StudioPlaceholder
      eyebrow="Workbook migration"
      title="Import runs"
      description="Dry-run reports will make every transformation, quarantine, and conflict reviewable."
      status="Phase 3 tool"
    >
      <ol className="number-list">
        <li>Hash and validate workbook headers.</li>
        <li>
          Map stable keys such as National Dex and <RegistryId>IDEA-001</RegistryId>.
        </li>
        <li>Quarantine flavor text and unsupported fields.</li>
        <li>Apply only after a maintainer reviews the report.</li>
      </ol>
    </StudioPlaceholder>
  );
}
