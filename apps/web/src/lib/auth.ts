import { redirect } from "next/navigation";
import { cache } from "react";
import {
  assertFixtureModeIsSafe,
  getSiteAccessMode,
  hasSupabaseEnvironment,
  isFixtureModeEnabled,
} from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AppRole = "maintainer" | "editor" | "viewer";

const roleRank: Record<AppRole, number> = {
  viewer: 0,
  editor: 1,
  maintainer: 2,
};

export interface AppMember {
  authUserId: string;
  githubLogin: string;
  displayName: string;
  role: AppRole;
  fixture: boolean;
}

const fixtureMember: AppMember = {
  authUserId: "00000000-0000-4000-8000-000000000007",
  githubLogin: "fixture-maintainer",
  displayName: "Fixture maintainer",
  role: "maintainer",
  fixture: true,
};

export const getCurrentMember = cache(async (): Promise<AppMember | null> => {
  assertFixtureModeIsSafe();
  if (isFixtureModeEnabled()) {
    return fixtureMember;
  }
  if (!hasSupabaseEnvironment()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const subject = claimsData?.claims?.sub;
  if (claimsError || typeof subject !== "string") {
    return null;
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("auth_user_id,github_login,display_name,role,is_active")
    .eq("auth_user_id", subject)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    authUserId: String(data.auth_user_id),
    githubLogin: String(data.github_login),
    displayName: String(data.display_name || data.github_login),
    role: data.role as AppRole,
    fixture: false,
  };
});

export async function requireMember(nextPath: string): Promise<AppMember> {
  const member = await getCurrentMember();
  if (!member) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return member;
}

export async function requireMaintainer(nextPath: string): Promise<AppMember> {
  const member = await requireMember(nextPath);
  if (!roleAllows(member.role, "maintainer")) {
    throw new Error("Maintainer access is required for this action.");
  }
  return member;
}

export function roleAllows(role: AppRole, minimumRole: AppRole): boolean {
  return roleRank[role] >= roleRank[minimumRole];
}

export async function requireEditor(nextPath: string): Promise<AppMember> {
  const member = await requireMember(nextPath);
  if (!roleAllows(member.role, "editor")) {
    throw new Error("Editor access is required for this action.");
  }
  return member;
}

export async function enforcePageAccess(
  section: "home" | "wiki" | "studio",
  nextPath: string,
): Promise<AppMember | null> {
  const mode = getSiteAccessMode();
  if (mode === "disabled") {
    redirect("/maintenance");
  }
  if (section === "studio" || mode === "private") {
    return requireMember(nextPath);
  }
  return getCurrentMember();
}
