import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSiteAccessMode, type SiteAccessMode } from "@/lib/env";
import { requireSafeSupabaseUrl } from "@/lib/supabase/url-policy";
import type { Database } from "@/types/database.generated";

const PRIVATE_CACHE_CONTROL = "private, no-store";
const PRIVATE_CRAWLER_POLICY = "noindex, nofollow";

const anonymousPaths = new Set([
  "/auth/sign-in",
  "/auth/callback",
  "/auth/denied",
  "/api/health",
  "/maintenance",
]);

const disabledPaths = new Set(["/api/health", "/maintenance"]);

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function supabaseEnvironment(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  try {
    return { url: requireSafeSupabaseUrl(url).toString(), publishableKey };
  } catch {
    return null;
  }
}

function safeFixtureMode(request: NextRequest): boolean {
  const production =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV);
  if (process.env.STUDIO_FIXTURE_MODE !== "true" || production) return false;
  try {
    const appBaseUrl = new URL(process.env.APP_BASE_URL ?? "");
    const loopback = isLoopbackHostname(appBaseUrl.hostname);
    return (
      loopback &&
      isLoopbackHostname(request.nextUrl.hostname) &&
      (appBaseUrl.protocol === "http:" || appBaseUrl.protocol === "https:") &&
      !appBaseUrl.username &&
      !appBaseUrl.password &&
      !appBaseUrl.search &&
      !appBaseUrl.hash &&
      (appBaseUrl.pathname === "/" || appBaseUrl.pathname === "")
    );
  } catch {
    return false;
  }
}

function isProtected(pathname: string, mode: SiteAccessMode): boolean {
  if (anonymousPaths.has(pathname)) return false;
  return pathname.startsWith("/studio") || mode === "private";
}

function withAccessHeaders(
  response: NextResponse,
  mode: SiteAccessMode,
  { noStore = false }: { noStore?: boolean } = {},
): NextResponse {
  if (noStore) {
    response.headers.set("Cache-Control", PRIVATE_CACHE_CONTROL);
  }
  if (mode !== "published_public") {
    response.headers.set("X-Robots-Tag", PRIVATE_CRAWLER_POLICY);
  }
  return response;
}

function privateRedirect(url: URL, mode: SiteAccessMode): NextResponse {
  return withAccessHeaders(NextResponse.redirect(url), mode, { noStore: true });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const mode = getSiteAccessMode();
  if (mode === "disabled" && !disabledPaths.has(pathname)) {
    return privateRedirect(new URL("/maintenance", request.url), mode);
  }

  if (process.env.STUDIO_FIXTURE_MODE === "true" && !safeFixtureMode(request)) {
    return withAccessHeaders(
      NextResponse.json({ error: "Local fixture access rejected." }, { status: 403 }),
      mode,
      { noStore: true },
    );
  }

  const environment = supabaseEnvironment();
  if (!environment) {
    if (safeFixtureMode(request)) {
      return withAccessHeaders(NextResponse.next(), mode, {
        noStore: isProtected(pathname, mode) || pathname.startsWith("/auth"),
      });
    }
    if (isProtected(pathname, mode)) {
      const url = new URL("/auth/sign-in", request.url);
      url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return privateRedirect(url, mode);
    }
    return withAccessHeaders(NextResponse.next(), mode);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (isProtected(pathname, mode) && !data?.claims?.sub) {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return privateRedirect(url, mode);
  }
  return withAccessHeaders(response, mode, {
    noStore: isProtected(pathname, mode) || pathname.startsWith("/auth"),
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:css|js|map|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
