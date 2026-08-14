import { describe, expect, it, vi } from "vitest";
import { fetchSupabaseService, requireSafeSupabaseUrl } from "./url-policy";

describe("Supabase secret transport URL policy", () => {
  it.each([
    "https://project.supabase.co",
    "https://10.20.30.40:8443/custom/path",
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("allows a protected or exact-loopback endpoint: %s", (value) => {
    expect(requireSafeSupabaseUrl(value)).toBeInstanceOf(URL);
  });

  it.each([
    "http://project.supabase.co",
    "http://192.168.1.10:54321",
    "http://localhost.example.test:54321",
    "ftp://project.supabase.co",
    "javascript:alert(1)",
    "https://user:password@project.supabase.co",
    "https://project.supabase.co#fragment",
  ])("rejects unsafe secret transport before a request: %s", (value) => {
    expect(() => requireSafeSupabaseUrl(value)).toThrow(/Supabase URL/u);
  });

  it("does not invoke fetch for an unsafe target", async () => {
    const fetcher = vi.fn();
    await expect(fetchSupabaseService("http://example.test/rest/v1", {}, fetcher)).rejects.toThrow(
      /Supabase URL/u,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("disables redirects for a valid service-role request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await fetchSupabaseService(
      "https://project.supabase.co/rest/v1",
      { method: "HEAD", redirect: "follow" },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1",
      expect.objectContaining({ method: "HEAD", redirect: "error" }),
    );
  });
});
