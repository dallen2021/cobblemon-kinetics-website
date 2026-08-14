import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchSupabaseService, requireSafeSupabaseUrl } from "./supabase-url-policy.mjs";

test("service URL policy permits HTTPS and exact loopback HTTP", () => {
  for (const value of [
    "https://project.supabase.co",
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ]) {
    assert.ok(requireSafeSupabaseUrl(value) instanceof URL);
  }
});

test("service URL policy rejects unsafe secret transports", () => {
  for (const value of [
    "http://project.supabase.co",
    "http://192.168.1.10:54321",
    "http://localhost.example.test:54321",
    "ftp://project.supabase.co",
    "https://user:password@project.supabase.co",
    "https://project.supabase.co#fragment",
  ]) {
    assert.throws(() => requireSafeSupabaseUrl(value), /Supabase URL/u);
  }
});

test("unsafe URL fails before fetch and valid requests cannot follow redirects", async () => {
  let calls = 0;
  const fetcher = async (_input, init) => {
    calls += 1;
    assert.equal(init.redirect, "error");
    return new Response(null, { status: 200 });
  };
  await assert.rejects(
    fetchSupabaseService("http://example.test/storage/v1", {}, fetcher),
    /Supabase URL/u,
  );
  assert.equal(calls, 0);
  await fetchSupabaseService("https://project.supabase.co/storage/v1", {}, fetcher);
  assert.equal(calls, 1);
});
