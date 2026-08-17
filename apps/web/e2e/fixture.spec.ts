import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("browses the Git-published wiki and searches Squirtle", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make the creature part of the machine." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Wiki", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workshop wiki" })).toBeVisible();
  await page.goto("/search?q=squirtle");
  await expect(page.getByRole("link", { name: "Squirtle" })).toBeVisible();
});

test("edits and approves an exact record without creating a fixture publication", async ({
  page,
}) => {
  await page.goto("/studio/pokemon/squirtle");
  await expect(page.getByText("Safe fixture", { exact: true })).toBeVisible();
  const revisionLabel = await page.locator(".record-header .eyebrow").textContent();
  const currentRevision = Number(revisionLabel?.match(/Revision (\d+)/u)?.[1]);
  expect(currentRevision).toBeGreaterThan(0);
  await page.getByLabel(/Efficiency multiplier/u).fill("1.25");
  await page
    .getByLabel(/Public balance rationale/u)
    .fill(
      `A 1.25× reviewed test value documents a bounded Hydro planning baseline (${Date.now()}).`,
    );
  await expect(
    page.locator(".revision-list").getByText(`r${currentRevision + 1}`, { exact: true }),
  ).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /Approve revision \d+/u }).click();
  await expect(page.getByRole("button", { name: "Approved" })).toBeDisabled();
  await expect(page.getByText(/never enter a publication bundle/u)).toBeVisible();

  await page.goto("/studio/publications");
  await expect(page.getByRole("heading", { name: "Publications" })).toBeVisible();
  await expect(page.getByText("Fixture mode", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Fixture mode intentionally proves the user interface only/u),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Create batch/u })).toBeDisabled();
});

test("passes a keyboard and axe smoke check", async ({ page }) => {
  await page.goto("/wiki");
  await expect(page.getByRole("heading", { name: "Workshop wiki" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("uses the reduced-motion mobile presentation without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Hydro transfer sequence" })).toBeVisible();
  const stage = page.locator(".hydro-stage");
  await expect(stage).toHaveCSS("position", "relative");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
