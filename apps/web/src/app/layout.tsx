import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { getCurrentMember } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/env";
import { SiteHeader } from "@/components/site-header";
import { parseStudioTheme, STUDIO_THEME_COOKIE } from "@/components/studio-preferences";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl() ?? new URL("http://localhost:3000"),
  title: {
    default: "Cobblemon Kinetics",
    template: "%s · Cobblemon Kinetics",
  },
  description:
    "A private-first design studio and published wiki for Pokémon-powered Create automation.",
  applicationName: "Cobblemon Kinetics Workshop",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#191a19",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [member, cookieStore] = await Promise.all([getCurrentMember(), cookies()]);
  const theme = parseStudioTheme(cookieStore.get(STUDIO_THEME_COOKIE)?.value);
  return (
    <html lang="en" data-scroll-behavior="smooth" data-theme={theme} suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader member={member} />
        <div id="main-content">{children}</div>
        <footer className="site-footer">
          <p>
            <strong>Cobblemon Kinetics</strong> · An independent open-source compatibility project.
          </p>
          <p>No third-party game art is distributed by this website.</p>
        </footer>
      </body>
    </html>
  );
}
