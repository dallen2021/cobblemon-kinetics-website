import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const originalEnvironment = {
  appBaseUrl: process.env.APP_BASE_URL,
  fixture: process.env.STUDIO_FIXTURE_MODE,
  mode: process.env.SITE_ACCESS_MODE,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  vercel: process.env.VERCEL,
  vercelEnv: process.env.VERCEL_ENV,
};

beforeEach(() => {
  process.env.APP_BASE_URL = "http://127.0.0.1:3000";
  process.env.STUDIO_FIXTURE_MODE = "true";
  process.env.SITE_ACCESS_MODE = "private";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  process.env.APP_BASE_URL = originalEnvironment.appBaseUrl;
  process.env.STUDIO_FIXTURE_MODE = originalEnvironment.fixture;
  process.env.SITE_ACCESS_MODE = originalEnvironment.mode;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvironment.supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnvironment.supabaseKey;
  process.env.VERCEL = originalEnvironment.vercel;
  process.env.VERCEL_ENV = originalEnvironment.vercelEnv;
});

describe("request proxy security gates", () => {
  it("rejects fixture access through a non-loopback effective host", async () => {
    const response = await proxy(new NextRequest("http://workstation.lan/studio"));
    expect(response.status).toBe(403);
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it("allows fixture access only through a loopback effective host", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/studio"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("marks an anonymous private-route redirect as private and unindexable", async () => {
    process.env.STUDIO_FIXTURE_MODE = "false";
    const response = await proxy(
      new NextRequest("https://studio.example.test/studio?record=squirtle"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://studio.example.test/auth/sign-in?next=%2Fstudio%3Frecord%3Dsquirtle",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("fails closed when a configured session endpoint uses unsafe HTTP", async () => {
    process.env.STUDIO_FIXTURE_MODE = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
    const response = await proxy(new NextRequest("https://studio.example.test/studio"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://studio.example.test/auth/sign-in?next=%2Fstudio",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it.each(["/auth/sign-in", "/auth/callback?code=value", "/auth/denied"])(
    "redirects %s to maintenance while the site is disabled",
    async (pathname) => {
      process.env.SITE_ACCESS_MODE = "disabled";
      process.env.STUDIO_FIXTURE_MODE = "false";
      const response = await proxy(new NextRequest(`https://studio.example.test${pathname}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://studio.example.test/maintenance");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    },
  );

  it("does not block public-site indexing in published-public mode", async () => {
    process.env.SITE_ACCESS_MODE = "published_public";
    process.env.STUDIO_FIXTURE_MODE = "false";
    const response = await proxy(new NextRequest("https://studio.example.test/wiki"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});
