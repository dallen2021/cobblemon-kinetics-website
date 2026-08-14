import { StudioPlaceholder } from "@/components/studio-placeholder";
import { StatusLamp } from "@/components/ui";

export default function WorkboardPage() {
  return (
    <StudioPlaceholder
      eyebrow="Neutral ownership"
      title="Workboard"
      description="A small planning surface for explicit status and assignment, never inferred ownership."
      status="Phase 5"
    >
      <div className="policy-grid">
        <div>
          <StatusLamp tone="teal" label="Unassigned" />
          <p>The default for every imported or newly created task.</p>
        </div>
        <div>
          <StatusLamp tone="amber" label="Explicit assignment only" />
          <p>Creator, suggester, and importer remain separate provenance fields.</p>
        </div>
        <div>
          <StatusLamp tone="green" label="Shared when deliberate" />
          <p>Two assignees require a division or handoff note.</p>
        </div>
      </div>
    </StudioPlaceholder>
  );
}
