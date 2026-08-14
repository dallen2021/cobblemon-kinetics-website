import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const originalEnvironment = {
  fixture: process.env.STUDIO_FIXTURE_MODE,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret: process.env.SUPABASE_SECRET_KEY,
};

beforeEach(() => {
  process.env.STUDIO_FIXTURE_MODE = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  process.env.SUPABASE_SECRET_KEY = "secret-test-key";
});

afterEach(() => {
  process.env.STUDIO_FIXTURE_MODE = originalEnvironment.fixture;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvironment.url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnvironment.key;
  process.env.SUPABASE_SECRET_KEY = originalEnvironment.secret;
  vi.unstubAllGlobals();
});

describe("health endpoint", () => {
  it("reports healthy after a successful database probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "healthy" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://project.supabase.co/rest/v1/generations?select=id&limit=0"),
      expect.objectContaining({ method: "HEAD", cache: "no-store" }),
    );
  });

  it("reports only a generic degraded result when the probe fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive detail")));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded" });
  });

  it("rejects an unsafe service URL before sending the secret", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.example.test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "degraded" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
