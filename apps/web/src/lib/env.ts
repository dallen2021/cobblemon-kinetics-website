import { requireSafeSupabaseUrl } from "@/lib/supabase/url-policy";

export type SiteAccessMode = "private" | "published_public" | "disabled";

const productionDeployment =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV);

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isProductionDeployment(): boolean {
  return productionDeployment;
}

export function getSiteAccessMode(): SiteAccessMode {
  const value = process.env.SITE_ACCESS_MODE ?? "private";
  if (value === "private" || value === "published_public" || value === "disabled") {
    return value;
  }
  throw new Error(`Unsupported SITE_ACCESS_MODE: ${value}`);
}

export function hasSupabaseEnvironment(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return false;
  try {
    requireSafeSupabaseUrl(url);
    return true;
  } catch {
    return false;
  }
}

export function isFixtureModeEnabled(): boolean {
  if (process.env.STUDIO_FIXTURE_MODE !== "true" || productionDeployment) return false;
  const appBaseUrl = getAppBaseUrl();
  return Boolean(appBaseUrl && isLoopbackHostname(appBaseUrl.hostname));
}

export function assertFixtureModeIsSafe(): void {
  if (process.env.STUDIO_FIXTURE_MODE === "true" && !isFixtureModeEnabled()) {
    throw new Error(
      "STUDIO_FIXTURE_MODE can run only outside production with a loopback APP_BASE_URL.",
    );
  }
}

export function getPublicSupabaseEnvironment(): {
  url: string;
  publishableKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase public environment is not configured.");
  }
  return { url: requireSafeSupabaseUrl(url).toString(), publishableKey };
}

export function getSupabaseServiceEnvironment(): {
  url: string;
  secretKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase server administration is not configured.");
  }
  return { url: requireSafeSupabaseUrl(url).toString(), secretKey };
}

export function getAppBaseUrl(): URL | null {
  const value = process.env.APP_BASE_URL;
  if (!value) return null;

  try {
    const url = new URL(value);
    const localHostname = isLoopbackHostname(url.hostname);
    const safeProtocol =
      url.protocol === "https:" ||
      (!productionDeployment && url.protocol === "http:" && localHostname);
    if (
      !safeProtocol ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }
    return new URL(url.origin);
  } catch {
    return null;
  }
}
