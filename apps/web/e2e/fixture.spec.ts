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

test("edits and approves an exact Squirtle revision", async ({ page }) => {
  await page.goto("/studio/pokemon/squirtle");
  await expect(page.getByText("Safe fixture", { exact: true })).toBeVisible();
  await page.getByLabel(/Efficiency multiplier/u).fill("1.25");
  await page
    .getByLabel(/Public balance rationale/u)
    .fill(
      "A 1.25× reviewed test value confirms the approved revision reaches its immutable publication bundle.",
    );
  await expect(page.getByText(/Revision 13 saved by Fixture maintainer/u)).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Approve revision 13" }).click();
  await expect(page.getByRole("heading", { name: "Ready for a batch" })).toBeVisible();
  await expect(page.getByText("Private note").locator("..")).toContainText("Excluded");
  await page.getByRole("button", { name: "Create immutable publication batch" }).click();
  const downloadLink = page.getByRole("link", { name: "Download frozen bundle" });
  await expect(downloadLink).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  const stream = await download.createReadStream();
  let serialized = "";
  for await (const chunk of stream) serialized += chunk.toString();
  const bundle = JSON.parse(serialized) as {
    records: {
      pokemon: Array<{
        work_assignments: Array<{ efficiency_multiplier: number; public_rationale: string }>;
      }>;
    };
  };
  expect(bundle.records.pokemon[0]?.work_assignments[0]).toMatchObject({
    efficiency_multiplier: 1.25,
    public_rationale:
      "A 1.25× reviewed test value confirms the approved revision reaches its immutable publication bundle.",
  });
  expect(serialized).not.toContain("private_note");
  expect(serialized).not.toContain("actor_id");
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
