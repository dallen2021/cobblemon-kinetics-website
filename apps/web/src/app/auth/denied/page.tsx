import Link from "next/link";
import { MaterialPanel } from "@/components/ui";

export default function DeniedPage() {
  return (
    <main className="centered-page">
      <MaterialPanel
        className="auth-card"
        eyebrow="Access stopped"
        title="This account is not on the workshop list"
        headingLevel={1}
      >
        <p>
          No project access was created. Ask a maintainer to add the stable GitHub account ID before
          signing in again.
        </p>
        <Link className="button button-secondary" href="/auth/sign-in">
          Return to sign in
        </Link>
      </MaterialPanel>
    </main>
  );
}
