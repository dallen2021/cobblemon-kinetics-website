import { NextResponse } from "next/server";
import { getAppBaseUrl, getSupabaseServiceEnvironment, hasSupabaseEnvironment } from "@/lib/env";
import { safeRelativeRedirect } from "@/lib/safe-redirect";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function claimedAccessIsValid(value: unknown, userId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const member = value as Record<string, unknown>;
  return member.auth_user_id === userId && member.is_active === true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }

  const code = url.searchParams.get("code");
  const next = safeRelativeRedirect(url.searchParams.get("next"), "/studio", appBaseUrl);
  try {
    getSupabaseServiceEnvironment();
  } catch {
    return NextResponse.redirect(new URL("/auth/denied?reason=configuration", appBaseUrl));
  }
  if (!code || !hasSupabaseEnvironment()) {
    return NextResponse.redirect(new URL("/auth/denied?reason=configuration", appBaseUrl));
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/auth/denied?reason=exchange", appBaseUrl));
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const { data: member, error: claimError } = userId
    ? await supabase.rpc("claim_editor_access")
    : { data: null, error: new Error("Authenticated GitHub user is missing.") };

  if (!userId || !claimedAccessIsValid(member, userId) || claimError) {
    await supabase.auth.signOut({ scope: "local" });
    if (userId) {
      try {
        const admin = createAdminSupabaseClient();
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error("Denied OAuth account cleanup failed.", {
            code: deleteError.code ?? "unknown",
          });
        }
      } catch {
        console.error("Denied OAuth account cleanup failed.", {
          code: "invalid_service_configuration",
        });
      }
    }
    return NextResponse.redirect(new URL("/auth/denied?reason=allowlist", appBaseUrl));
  }

  return NextResponse.redirect(new URL(next, appBaseUrl));
}
