import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  claimAccess: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerClient,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}));

import { GET } from "./route";

const originalEnvironment = {
  appBaseUrl: process.env.APP_BASE_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secretKey: process.env.SUPABASE_SECRET_KEY,
};

beforeEach(() => {
  process.env.APP_BASE_URL = "https://studio.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  process.env.SUPABASE_SECRET_KEY = "secret-test-key";
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-7" } } });
  mocks.claimAccess.mockResolvedValue({ data: null, error: { code: "not_allowed" } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.createServerClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    rpc: mocks.claimAccess,
  });
  mocks.createAdminClient.mockReturnValue({
    auth: { admin: { deleteUser: mocks.deleteUser } },
  });
});

afterEach(() => {
  process.env.APP_BASE_URL = originalEnvironment.appBaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnvironment.supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalEnvironment.publishableKey;
  process.env.SUPABASE_SECRET_KEY = originalEnvironment.secretKey;
  vi.clearAllMocks();
});

describe("GitHub OAuth callback", () => {
  it("does not exchange a code when the admin cleanup key is missing", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    const response = await GET(
      new Request("https://untrusted-host.test/auth/callback?code=oauth-code"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://studio.example.test/auth/denied?reason=configuration",
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("does not exchange a code when the service URL would expose the secret", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.example.test";
    const response = await GET(
      new Request("https://untrusted-host.test/auth/callback?code=oauth-code"),
    );
    expect(response.headers.get("location")).toBe(
      "https://studio.example.test/auth/denied?reason=configuration",
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("deletes a denied temporary Auth identity and uses the configured origin", async () => {
    const response = await GET(
      new Request(
        "https://untrusted-host.test/auth/callback?code=oauth-code&next=/studio/pokemon/squirtle",
      ),
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mocks.claimAccess).toHaveBeenCalledWith("claim_editor_access");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("user-7");
    expect(response.headers.get("location")).toBe(
      "https://studio.example.test/auth/denied?reason=allowlist",
    );
  });

  it("returns a non-redirecting configuration error for an unsafe base URL", async () => {
    process.env.APP_BASE_URL = "http://untrusted.example.test";
    const response = await GET(
      new Request("https://untrusted-host.test/auth/callback?code=oauth-code"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
