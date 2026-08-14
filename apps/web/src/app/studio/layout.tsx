import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { StudioShell } from "@/components/studio-shell";
import {
  parsePanelCollapsed,
  parseStudioTheme,
  STUDIO_LEFT_PANEL_COOKIE,
  STUDIO_RIGHT_PANEL_COOKIE,
  STUDIO_THEME_COOKIE,
} from "@/components/studio-preferences";
import { enforcePageAccess } from "@/lib/auth";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const [member, cookieStore] = await Promise.all([
    enforcePageAccess("studio", "/studio"),
    cookies(),
  ]);
  if (!member) return null;
  return (
    <StudioShell
      member={member}
      initialTheme={parseStudioTheme(cookieStore.get(STUDIO_THEME_COOKIE)?.value)}
      initialLeftCollapsed={parsePanelCollapsed(cookieStore.get(STUDIO_LEFT_PANEL_COOKIE)?.value)}
      initialRightCollapsed={parsePanelCollapsed(cookieStore.get(STUDIO_RIGHT_PANEL_COOKIE)?.value)}
    >
      {children}
    </StudioShell>
  );
}
