const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function requireSafeSupabaseUrl(value) {
  let url;
  try {
    url = new URL(String(value));
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

function requestUrl(input) {
  return typeof input === "string" || input instanceof URL ? input : input.url;
}

export async function fetchSupabaseService(input, init = {}, fetcher = fetch) {
  requireSafeSupabaseUrl(requestUrl(input));
  return fetcher(input, { ...init, redirect: "error" });
}
