const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function requireSafeSupabaseUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = new URL(value.toString());
  } catch {
    throw new Error("Supabase URL is invalid.");
  }
  const secureTransport =
    url.protocol === "https:" || (url.protocol === "http:" && loopbackHostnames.has(url.hostname));
  if (!secureTransport || url.username || url.password || url.hash) {
    throw new Error(
      "Supabase URL must use HTTPS, except for an exact loopback HTTP host, and cannot contain credentials or a fragment.",
    );
  }
  return url;
}

function requestUrl(input: RequestInfo | URL): string | URL {
  return typeof input === "string" || input instanceof URL ? input : input.url;
}

export async function fetchSupabaseService(
  input: RequestInfo | URL,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  requireSafeSupabaseUrl(requestUrl(input));
  return fetcher(input, { ...init, redirect: "error" });
}
