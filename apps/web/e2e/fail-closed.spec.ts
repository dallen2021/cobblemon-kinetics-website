import { expect, test } from "@playwright/test";

test("private routes fail closed without fixture mode or Supabase", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fstudio$/u);
  await expect(page.getByRole("heading", { name: "Enter the workshop", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with GitHub/u })).toHaveCount(0);
});
