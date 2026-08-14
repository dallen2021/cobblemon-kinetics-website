import { NextResponse } from "next/server";
import { getAppBaseUrl, hasSupabaseEnvironment } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return NextResponse.json({ error: "Sign-out is not configured." }, { status: 503 });
  }
  if (request.headers.get("origin") !== appBaseUrl.origin) {
    return NextResponse.json({ error: "Cross-origin sign-out rejected." }, { status: 403 });
  }
  if (hasSupabaseEnvironment()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  return NextResponse.redirect(new URL("/auth/sign-in", appBaseUrl), 303);
}
