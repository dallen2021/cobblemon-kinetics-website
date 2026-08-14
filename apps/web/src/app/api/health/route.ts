import {
  getSupabaseServiceEnvironment,
  hasSupabaseEnvironment,
  isFixtureModeEnabled,
} from "@/lib/env";
import { fetchSupabaseService } from "@/lib/supabase/url-policy";

const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

async function databaseIsReachable(): Promise<boolean> {
  if (!hasSupabaseEnvironment()) return false;

  try {
    const { url, secretKey } = getSupabaseServiceEnvironment();
    const response = await fetchSupabaseService(
      new URL("/rest/v1/generations?select=id&limit=0", url),
      {
        method: "HEAD",
        headers: {
          apikey: secretKey,
          Authorization: `Bearer ${secretKey}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const healthy = isFixtureModeEnabled() || (await databaseIsReachable());
  return Response.json(
    { status: healthy ? "healthy" : "degraded" },
    {
      status: healthy ? 200 : 503,
      headers: responseHeaders,
    },
  );
}
