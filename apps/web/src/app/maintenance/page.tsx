import { MaterialPanel, StatusLamp } from "@/components/ui";

export default function MaintenancePage() {
  return (
    <main className="centered-page">
      <MaterialPanel
        className="auth-card"
        eyebrow="Workshop state"
        title="The line is intentionally stopped"
        headingLevel={1}
      >
        <StatusLamp tone="amber" label="Maintenance mode" />
        <p>
          The site is disabled at the server configuration layer. No studio or wiki records are
          being served.
        </p>
      </MaterialPanel>
    </main>
  );
}
