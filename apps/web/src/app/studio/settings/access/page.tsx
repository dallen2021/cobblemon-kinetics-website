import { MaterialPanel, PageHeading, StatusLamp } from "@/components/ui";
import { requireMaintainer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const member = await requireMaintainer("/studio/settings/access");
  return (
    <main className="studio-page">
      <PageHeading
        eyebrow="Maintainer control"
        title="Workshop access"
        description="GitHub identities are allowlisted by stable numeric ID, never hard-coded in application source."
      />
      <div className="detail-grid">
        <MaterialPanel eyebrow="Your access" title={member.displayName}>
          <StatusLamp tone="green" label={member.role} />
          <p>
            GitHub login: <code className="registry-id">{member.githubLogin}</code>
          </p>
        </MaterialPanel>
        <MaterialPanel eyebrow="Governance" title="Equal authority">
          <p>
            Maintainers may edit, approve, publish, and manage access. Task assignment remains
            independent from account role.
          </p>
          <StatusLamp tone="teal" label="Fresh database check per request" />
        </MaterialPanel>
      </div>
    </main>
  );
}
