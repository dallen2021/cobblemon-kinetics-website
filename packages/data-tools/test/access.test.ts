import { describe, expect, it, vi } from "vitest";

import { grantAccess } from "../src/access/grant-access.js";

describe("grantAccess", () => {
  it("resolves the stable GitHub ID and upserts the exact allowlist shape", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 12345, login: "Example-User", name: "Example User" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await grantAccess({
      githubUser: "Example-User",
      role: "maintainer",
      supabaseUrl: "https://example.supabase.co/",
      supabaseSecretKey: "secret-test-value",
      fetchImplementation: request,
    });

    expect(result).toEqual({
      github_user_id: 12345,
      github_login: "Example-User",
      display_name: "Example User",
      role: "maintainer",
      is_active: true,
    });
    const [, upsert] = request.mock.calls;
    expect(request.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
    expect(upsert?.[0]).toBe(
      "https://example.supabase.co/rest/v1/editor_allowlist?on_conflict=github_user_id",
    );
    expect(upsert?.[1]).toMatchObject({ redirect: "error" });
    expect(upsert?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(upsert?.[1]?.body))).toEqual(result);
  });

  it("refuses to send the Supabase secret over a non-local HTTP URL", async () => {
    const request = vi.fn<typeof fetch>();

    await expect(
      grantAccess({
        githubUser: "Example-User",
        role: "maintainer",
        supabaseUrl: "http://example.supabase.co",
        supabaseSecretKey: "secret-test-value",
        fetchImplementation: request,
      }),
    ).rejects.toThrow(/HTTPS outside local development/u);

    expect(request).not.toHaveBeenCalled();
  });

  it("permits the local HTTP Supabase development origin", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 12345, login: "Example-User", name: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 201 }));

    await grantAccess({
      githubUser: "Example-User",
      role: "viewer",
      supabaseUrl: "http://127.0.0.1:54321/",
      supabaseSecretKey: "local-secret-test-value",
      fetchImplementation: request,
    });

    expect(request.mock.calls[1]?.[0]).toBe(
      "http://127.0.0.1:54321/rest/v1/editor_allowlist?on_conflict=github_user_id",
    );
  });
});
