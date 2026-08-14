import Link from "next/link";
import { MaterialPanel } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="centered-page">
      <MaterialPanel
        className="auth-card"
        eyebrow="404 · Registry miss"
        title="That record is not on this line"
        headingLevel={1}
      >
        <p>The identifier may have moved, remained a private draft, or never existed.</p>
        <Link className="button button-primary" href="/wiki">
          Return to the wiki
        </Link>
      </MaterialPanel>
    </main>
  );
}
