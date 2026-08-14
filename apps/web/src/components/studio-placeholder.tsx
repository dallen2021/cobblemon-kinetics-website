import type { ReactNode } from "react";
import { MaterialPanel, PageHeading, StatusLamp } from "./ui";

export function StudioPlaceholder({
  eyebrow,
  title,
  description,
  status,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<StatusLamp tone="amber" label={status} />}
      />
      <MaterialPanel
        className="placeholder-panel"
        eyebrow="Vertical-slice boundary"
        title="Foundation present; breadth intentionally deferred"
      >
        {children}
      </MaterialPanel>
    </main>
  );
}
