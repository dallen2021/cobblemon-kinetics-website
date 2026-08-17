import { expect, test, type Page } from "@playwright/test";

async function currentRevision(page: Page): Promise<number> {
  const label = await page.locator(".record-header .eyebrow").textContent();
  const revision = label?.match(/Revision (\d+)/u)?.[1];
  if (!revision) throw new Error("The Studio record did not expose its current revision.");
  return Number(revision);
}

test("searches all 151 records and edits a non-Squirtle Pokémon workspace", async ({ page }) => {
  const editMarker = `e2e-${Date.now()}-${test.info().parallelIndex}`;
  await page.goto("/studio/pokemon");
  await expect(page.getByRole("heading", { name: "Pokémon directory" })).toBeVisible();
  await expect(page.getByText("151 of 151 records", { exact: true })).toBeVisible();
  const studioNavigation = page.getByRole("navigation", { name: "Studio navigation" });
  await expect(studioNavigation.getByRole("link", { name: "Pokémon" })).toBeVisible();
  await expect(studioNavigation.getByRole("link", { name: "Squirtle" })).toHaveCount(0);

  await page.getByLabel("Search Pokémon directory").fill("#025");
  const pikachu = page.locator(".record-directory-row").filter({ hasText: "Pikachu" });
  await expect(pikachu).toHaveCount(1);
  await page.getByLabel("Search Pokémon directory").fill("");
  await page.getByLabel("Filter by type").selectOption("fairy");
  await expect(page.locator(".record-directory-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByLabel("Search Pokémon directory").fill("Pikachu");
  await pikachu.click();
  await expect(page.getByRole("heading", { name: "Pikachu", exact: true })).toBeVisible();
  const pikachuRevision = await currentRevision(page);

  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Blueprint" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Facts" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Discussion & History" })).toBeVisible();

  await page.getByLabel("Candidate job").fill(`Electrical control operator ${editMarker}`);
  await expect(
    page.locator(".revision-list").getByText(`r${pikachuRevision + 1}`, { exact: true }),
  ).toBeVisible({ timeout: 5_000 });

  await page.getByRole("tab", { name: "Facts" }).click();
  await page.getByLabel("Body shape").selectOption("upright");
  await expect(page.getByText(/Revision \d+ saved/u)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/Original:/u).first()).toBeVisible();
});

test("uses one staged change set in Canvas and Outline and explicitly accepts a type suggestion", async ({
  page,
}) => {
  await page.goto("/studio/pokemon/oddish");
  await expect(page.getByRole("heading", { name: "Oddish", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Blueprint" }).click();
  await expect(page.getByRole("heading", { name: "Kinetic Blueprint" })).toBeVisible();
  await expect(page.getByText("Ghosted Type Workshop suggestions")).toBeVisible();
  await page.getByRole("button", { name: "Accept for this form" }).click();
  await expect(page.getByText(/accepted locally/u)).toBeVisible();

  await page.getByRole("button", { name: "Outline" }).click();
  await expect(page.getByLabel("Accessible Blueprint outline")).toContainText("Type suggestion");
  await page.getByRole("button", { name: "Apply Changes" }).click();
  await expect(page.getByText(/saved atomically/u)).toBeVisible({ timeout: 5_000 });

  const acceptedRelationship = page
    .locator(".blueprint-outline ol button")
    .filter({ hasText: "Type suggestion" })
    .first();
  await acceptedRelationship.click();
  await page.getByRole("button", { name: "Approve exact revision" }).click();
  await expect(page.getByText(/Approved cobblemon_kinetics:relationship/u)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Oddish", exact: true })).toBeVisible();
  await expect(
    page.locator(".overview-metrics article").filter({ hasText: "Explicit capabilities" }),
  ).toContainText("1");
});

test("uses type directions and preserves explicit shared task handoffs", async ({ page }) => {
  await page.goto("/studio/types");
  await expect(page.getByRole("heading", { name: "Type Workshop" })).toBeVisible();
  await expect(page.getByText("18 of 18 records", { exact: true })).toBeVisible();
  await page.getByLabel("Search Type Workshop").fill("Water");
  await page.locator(".record-directory-row").filter({ hasText: "Water Type Workshop" }).click();
  await expect(page.getByRole("heading", { name: "Water Type Workshop" })).toBeVisible();
  await expect(page.getByText("Linked Pokémon", { exact: true })).toBeVisible();

  await page.goto("/studio/workboard");
  await page.getByLabel("Search work items").fill("Design Pikachu for Gen 1");
  const card = page.locator(".work-item-card").filter({ hasText: "Design Pikachu for Gen 1" });
  await expect(card).toHaveCount(1);
  await card.getByLabel(/Fixture Daniel/u).check();
  await card.getByLabel(/Fixture Jake/u).check();
  await card
    .getByLabel("Handoff / division note")
    .fill("Daniel drafts the role; Jake validates the machine relationship.");
  await card.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByText(/saved with explicit ownership only/u)).toBeVisible();
  await expect(card.getByLabel(/Fixture Daniel/u)).toBeChecked();
  await expect(card.getByLabel(/Fixture Jake/u)).toBeChecked();
});

test("derives compatibility from the same Blueprint relationships", async ({ page }) => {
  await page.goto("/studio/compatibility");
  await expect(page.getByRole("heading", { name: "Compatibility matrix" })).toBeVisible();
  await page.getByPlaceholder("Search Dex, name, or ID").fill("Bulbasaur");
  const row = page.locator(".compatibility-table tbody tr").filter({ hasText: "Bulbasaur" });
  await expect(row).toContainText("Plant Tender");
  await expect(row).toContainText("Ordinary Farmland");
  await expect(row).not.toContainText("Legacy field");
});

test("shows a real stale-write conflict between two Studio views", async ({ page, context }) => {
  const editMarker = `e2e-${Date.now()}-${test.info().parallelIndex}`;
  const second = await context.newPage();
  try {
    await Promise.all([page.goto("/studio/pokemon/eevee"), second.goto("/studio/pokemon/eevee")]);
    const eeveeRevision = await currentRevision(page);
    expect(await currentRevision(second)).toBe(eeveeRevision);
    await page.getByLabel("Candidate job").fill(`First maintainer direction ${editMarker}`);
    await expect(
      page.locator(".revision-list").getByText(`r${eeveeRevision + 1}`, { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    await second.getByLabel("Candidate job").fill(`Second maintainer direction ${editMarker}`);
    await expect(second.getByText(/Another maintainer saved revision/u)).toBeVisible({
      timeout: 5_000,
    });
    await expect(second.getByRole("heading", { name: "Remote revision" })).toBeVisible();
    await expect(second.getByRole("button", { name: "Refresh" })).toBeVisible();
  } finally {
    await second.close();
  }
});
