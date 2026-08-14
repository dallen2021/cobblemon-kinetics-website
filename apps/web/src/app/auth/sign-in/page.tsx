import Image from "next/image";
import Link from "next/link";
import { SignInButton } from "./sign-in-button";
import { getAppBaseUrl, hasSupabaseEnvironment, isFixtureModeEnabled } from "@/lib/env";
import { safeRelativeRedirect } from "@/lib/safe-redirect";
import { MaterialPanel, StatusLamp } from "@/components/ui";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const baseUrl = getAppBaseUrl();
  const destination = safeRelativeRedirect(
    next,
    "/studio",
    baseUrl ?? new URL("https://local.invalid"),
  );
  const configured = hasSupabaseEnvironment() && Boolean(process.env.SUPABASE_SECRET_KEY);
  const fixture = isFixtureModeEnabled();
  const callbackUrl = baseUrl
    ? new URL(`/auth/callback?next=${encodeURIComponent(destination)}`, baseUrl).toString()
    : "";

  return (
    <main className="centered-page auth-page">
      <aside className="auth-art" aria-label="Cobblemon Kinetics brand">
        <Image
          alt=""
          className="auth-brand-lockup"
          fill
          priority
          sizes="(max-width: 760px) 100vw, 58vw"
          src="/brand/cobblemon-kinetics-lockup-transparent.png"
        />
        <span aria-hidden="true" />
      </aside>
      <MaterialPanel
        className="auth-card"
        eyebrow="Private prototype"
        title="Enter the workshop"
        headingLevel={1}
      >
        <p>
          This development studio is restricted to approved GitHub identities. Authentication does
          not assign work or imply ownership.
        </p>
        {configured && callbackUrl ? (
          <SignInButton callbackUrl={callbackUrl} />
        ) : fixture ? (
          <>
            <StatusLamp tone="amber" label="Fixture mode" />
            <p className="fine-print">
              Local fixture mode is active. It is restricted to a loopback development server.
            </p>
            <Link className="button button-primary" href={destination}>
              Enter fixture studio
            </Link>
          </>
        ) : (
          <div className="callout callout-warning" role="status">
            Authentication is not configured. Add the documented Supabase values and APP_BASE_URL;
            no local bypass is active.
          </div>
        )}
      </MaterialPanel>
    </main>
  );
}
