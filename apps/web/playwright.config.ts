import { defineConfig, devices } from "@playwright/test";

const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL;
if (configuredBaseURL) {
  const configuredURL = new URL(configuredBaseURL);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!loopbackHosts.has(configuredURL.hostname)) {
    throw new Error("PLAYWRIGHT_BASE_URL must use an exact loopback host.");
  }
}
const baseURL = configuredBaseURL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["fixture.spec.ts", "gen1-studio.spec.ts", "studio-borders.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: configuredBaseURL
    ? undefined
    : {
        command: "pnpm dev --port 3100",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          APP_BASE_URL: baseURL,
          SITE_ACCESS_MODE: "private",
          STUDIO_FIXTURE_MODE: "true",
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
        },
      },
});
