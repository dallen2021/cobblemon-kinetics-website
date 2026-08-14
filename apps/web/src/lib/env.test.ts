import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertFixtureModeIsSafe,
  getAppBaseUrl,
  getSiteAccessMode,
  isFixtureModeEnabled,
} from "./env";

const originalMode = process.env.SITE_ACCESS_MODE;
const originalBaseUrl = process.env.APP_BASE_URL;
const originalFixtureMode = process.env.STUDIO_FIXTURE_MODE;
const originalVercel = process.env.VERCEL;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  process.env.SITE_ACCESS_MODE = originalMode;
  process.env.APP_BASE_URL = originalBaseUrl;
  process.env.STUDIO_FIXTURE_MODE = originalFixtureMode;
  process.env.VERCEL = originalVercel;
  process.env.VERCEL_ENV = originalVercelEnv;
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("environment gates", () => {
  it("defaults to private access", () => {
    delete process.env.SITE_ACCESS_MODE;
    expect(getSiteAccessMode()).toBe("private");
  });

  it("enables fixtures only when explicitly requested", () => {
    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    expect(isFixtureModeEnabled()).toBe(true);
  });

  it("rejects fixture auth bypass on a non-loopback development origin", () => {
    process.env.STUDIO_FIXTURE_MODE = "true";
    process.env.APP_BASE_URL = "https://preview.example.test";
    expect(isFixtureModeEnabled()).toBe(false);
    expect(() => assertFixtureModeIsSafe()).toThrow(/loopback APP_BASE_URL/u);
  });

  it("accepts HTTPS origins and local HTTP origins only", () => {
    process.env.APP_BASE_URL = "https://studio.example.test";
    expect(getAppBaseUrl()?.origin).toBe("https://studio.example.test");

    process.env.APP_BASE_URL = "http://127.0.0.1:3000";
    expect(getAppBaseUrl()?.origin).toBe("http://127.0.0.1:3000");

    process.env.APP_BASE_URL = "http://studio.example.test";
    expect(getAppBaseUrl()).toBeNull();
  });

  it.each([
    "studio.example.test",
    "javascript:alert(1)",
    "https://studio.example.test/unexpected-path",
    "https://user:password@studio.example.test",
  ])("rejects unsafe callback origin %s", (value) => {
    process.env.APP_BASE_URL = value;
    expect(getAppBaseUrl()).toBeNull();
  });

  it("forbids fixture auth bypass in a self-hosted production runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.STUDIO_FIXTURE_MODE = "true";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    vi.resetModules();
    const productionEnv = await import("./env");
    expect(productionEnv.isFixtureModeEnabled()).toBe(false);
    expect(() => productionEnv.assertFixtureModeIsSafe()).toThrow(/only outside production/u);
  });
});
