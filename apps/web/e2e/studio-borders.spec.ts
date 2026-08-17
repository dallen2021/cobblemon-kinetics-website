import { expect, test, type Locator, type Page } from "@playwright/test";

const STUDIO_ROUTE = "/studio/pokemon/squirtle";
const GENERATED_FRAME_PATTERN = /\/art\/interface\/frames\/[a-z0-9-]+\.png/u;
const FRAME_ASSETS = [
  "/art/interface/frames/studio-frame-heavy.png",
  "/art/interface/frames/panel-frame-steel.png",
  "/art/interface/frames/panel-frame-brass.png",
] as const;

const P0_FRAMES = [
  ["studio shell", ".studio-shell"],
  ["navigation rail", ".studio-sidebar"],
  ["studio toolbar", ".studio-toolbar"],
  ["record inspector", ".editor-inspector"],
  ["private notes", ".private-section"],
  ["inspector cards", ".inspector-block"],
  ["publication gate", ".publication-block"],
  ["Studio action", ".editor-inspector .button-primary"],
] as const;

async function openStudio(page: Page): Promise<void> {
  await page.goto(STUDIO_ROUTE);
  await expect(page.getByText("Safe fixture", { exact: true })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Squirtle" })).toBeVisible();
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function borderImageSource(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).borderImageSource);
}

async function expectGeneratedFrame(locator: Locator): Promise<void> {
  await expect(locator).toBeAttached();
  expect(await borderImageSource(locator)).toMatch(GENERATED_FRAME_PATTERN);
}

test("loads and decodes every generated Studio frame", async ({ page, request }) => {
  await openStudio(page);

  for (const asset of FRAME_ASSETS) {
    const response = await request.get(asset);
    expect(response.ok(), `${asset} should return a successful response`).toBe(true);
    expect(response.headers()["content-type"]).toMatch(/^image\/png(?:;|$)/u);

    const dimensions = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, asset);

    expect(dimensions.width, `${asset} should decode at its intrinsic width`).toBeGreaterThan(0);
    expect(dimensions.height, `${asset} should decode at its intrinsic height`).toBeGreaterThan(0);
  }
});

test("uses generated border images on the primary Studio frame surfaces", async ({ page }) => {
  await openStudio(page);

  for (const [name, selector] of P0_FRAMES) {
    const elements = page.locator(selector);
    const count = await elements.count();
    expect(count, `${name} should exist on the fixture route`).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expectGeneratedFrame(elements.nth(index));
    }
  }
});

test("keeps generated frames stable through themes and every desktop collapse state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1504, height: 1024 });
  await openStudio(page);

  const shell = page.locator(".studio-shell");
  const sidebar = page.locator(".studio-sidebar");
  const navigationToggle = page.locator(".studio-navigation-toggle");
  const inspectorToggle = page.locator(".studio-inspector-toggle");

  const expandedHeaderGeometry = await page.evaluate(() => {
    const logo = document.querySelector<HTMLElement>(".studio-brand-mark");
    const brandName = document.querySelector<HTMLElement>(".studio-brand-copy strong");
    const sectionLabel = document.querySelector<HTMLElement>(".studio-sidebar-heading .eyebrow");
    const arrow = document.querySelector<HTMLElement>(".studio-navigation-toggle");
    const sidebar = document.querySelector<HTMLElement>(".studio-sidebar");
    if (!logo || !brandName || !sectionLabel || !arrow || !sidebar) return null;
    const logoBox = logo.getBoundingClientRect();
    const brandBox = brandName.getBoundingClientRect();
    const labelBox = sectionLabel.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    const sidebarBox = sidebar.getBoundingClientRect();
    const sidebarInnerRight =
      sidebarBox.right - Number.parseFloat(getComputedStyle(sidebar).borderRightWidth);
    return {
      arrowHeight: arrowBox.height,
      arrowWidth: arrowBox.width,
      brandFits: brandName.scrollWidth <= brandName.clientWidth + 1,
      brandFontSize: Number.parseFloat(getComputedStyle(brandName).fontSize),
      centersApart: Math.abs(
        labelBox.top + labelBox.height / 2 - (arrowBox.top + arrowBox.height / 2),
      ),
      headingClearance: arrowBox.left - labelBox.right,
      rightEdgeDistance: Math.abs(sidebarInnerRight - arrowBox.right),
      logoWidth: logoBox.width,
      brandWidth: brandBox.width,
    };
  });

  expect(expandedHeaderGeometry).not.toBeNull();
  expect(expandedHeaderGeometry?.logoWidth).toBeGreaterThanOrEqual(120);
  expect(expandedHeaderGeometry?.brandFontSize).toBeGreaterThanOrEqual(16);
  expect(expandedHeaderGeometry?.brandFits).toBe(true);
  expect(expandedHeaderGeometry?.brandWidth).toBeGreaterThan(0);
  expect(expandedHeaderGeometry?.arrowWidth).toBeGreaterThanOrEqual(44);
  expect(expandedHeaderGeometry?.arrowHeight).toBeGreaterThanOrEqual(44);
  expect(expandedHeaderGeometry?.centersApart).toBeLessThanOrEqual(2);
  expect(expandedHeaderGeometry?.headingClearance).toBeGreaterThanOrEqual(0);
  expect(expandedHeaderGeometry?.rightEdgeDistance).toBeLessThanOrEqual(2);

  await expect(shell).toHaveAttribute("data-left-collapsed", "false");
  await expect(shell).toHaveAttribute("data-right-collapsed", "false");
  await expectGeneratedFrame(shell);
  await expectNoDocumentOverflow(page);

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectGeneratedFrame(shell);
  await expectNoDocumentOverflow(page);

  await page.getByRole("button", { name: "Light" }).click();
  await navigationToggle.click();
  await expect(shell).toHaveAttribute("data-left-collapsed", "true");
  await expect(shell).toHaveAttribute("data-right-collapsed", "false");
  await expect(navigationToggle).toHaveAttribute("aria-label", "Show navigation");
  await expect(page.locator(".studio-brand-copy")).toBeHidden();
  await expect(page.locator(".studio-brand-mark")).toBeVisible();
  await expectGeneratedFrame(shell);
  await expectNoDocumentOverflow(page);
  expect(
    await sidebar.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  const collapsedLogoBox = await page.locator(".studio-brand-mark").boundingBox();
  expect(collapsedLogoBox).not.toBeNull();
  expect(
    Math.abs((collapsedLogoBox?.width ?? 0) - (collapsedLogoBox?.height ?? 0)),
  ).toBeLessThanOrEqual(1);

  await navigationToggle.click();
  await inspectorToggle.click();
  await expect(shell).toHaveAttribute("data-left-collapsed", "false");
  await expect(shell).toHaveAttribute("data-right-collapsed", "true");
  await expectGeneratedFrame(shell);
  await expectNoDocumentOverflow(page);

  await navigationToggle.click();
  await expect(shell).toHaveAttribute("data-left-collapsed", "true");
  await expect(shell).toHaveAttribute("data-right-collapsed", "true");
  await expectGeneratedFrame(shell);
  await expectNoDocumentOverflow(page);
});

test("frames the mobile navigation and inspector drawers without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);

  const shell = page.locator(".studio-shell");
  const navigation = page.locator(".studio-sidebar");
  const navigationLauncher = page.locator(".studio-mobile-navigation-launcher");
  const inspector = page.locator(".editor-inspector");

  await navigationLauncher.click();
  await expect(shell).toHaveAttribute("data-mobile-left-open", "true");
  await expect(navigation).toBeVisible();
  await expectGeneratedFrame(navigation);
  await expectNoDocumentOverflow(page);
  await expect(page.locator(".studio-brand-mark")).toHaveCSS("width", "124px");

  const mobileHeaderGeometry = await page.evaluate(() => {
    const logo = document.querySelector<HTMLElement>(".studio-brand-mark");
    const brandName = document.querySelector<HTMLElement>(".studio-brand-copy strong");
    const sectionLabel = document.querySelector<HTMLElement>(".studio-sidebar-heading .eyebrow");
    const arrow = document.querySelector<HTMLElement>(".studio-navigation-toggle");
    if (!logo || !brandName || !sectionLabel || !arrow) return null;
    const logoBox = logo.getBoundingClientRect();
    const labelBox = sectionLabel.getBoundingClientRect();
    const arrowBox = arrow.getBoundingClientRect();
    return {
      logoWidth: logoBox.width,
      caretAlignedToDevelopmentStudio:
        Math.abs(labelBox.top + labelBox.height / 2 - (arrowBox.top + arrowBox.height / 2)) <= 2,
      noLogoArrowOverlap:
        logoBox.right <= arrowBox.left ||
        arrowBox.right <= logoBox.left ||
        logoBox.bottom <= arrowBox.top ||
        arrowBox.bottom <= logoBox.top,
    };
  });
  expect(mobileHeaderGeometry?.logoWidth).toBeGreaterThanOrEqual(96);
  expect(mobileHeaderGeometry?.caretAlignedToDevelopmentStudio).toBe(true);
  expect(mobileHeaderGeometry?.noLogoArrowOverlap).toBe(true);

  await page.locator(".studio-navigation-toggle").click();
  await expect(shell).toHaveAttribute("data-mobile-left-open", "false");
  await expect(navigationLauncher).toBeFocused();

  await navigationLauncher.click();
  await expect(shell).toHaveAttribute("data-mobile-left-open", "true");

  await page.keyboard.press("Escape");
  await expect(shell).toHaveAttribute("data-mobile-left-open", "false");
  await expect(navigationLauncher).toBeFocused();

  await page.locator(".studio-inspector-toggle").click();
  await expect(shell).toHaveAttribute("data-mobile-right-open", "true");
  await expect(inspector).toBeVisible();
  await expectGeneratedFrame(inspector);
  await expectNoDocumentOverflow(page);

  await page.locator(".studio-mobile-inspector-close").click();
  await expect(shell).toHaveAttribute("data-mobile-right-open", "false");
  await expect(page.locator(".studio-inspector-toggle")).toBeFocused();

  await page.locator(".studio-inspector-toggle").click();
  await page.getByRole("button", { name: "Close open panel" }).click({ position: { x: 8, y: 8 } });
  await expect(shell).toHaveAttribute("data-mobile-right-open", "false");
  await expect(page.locator(".studio-inspector-toggle")).toBeFocused();
});

test("uses visible fallback borders when forced colors suppress decorative frames", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openStudio(page);

  const forcedColorsActive = await page.evaluate(
    () => matchMedia("(forced-colors: active)").matches,
  );
  test.skip(!forcedColorsActive, "The browser does not support forced-colors emulation.");

  for (const [name, selector] of P0_FRAMES) {
    const elements = page.locator(selector);
    const count = await elements.count();
    expect(count, `${name} should exist in forced-colors mode`).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const fallback = await elements.nth(index).evaluate((element) => {
        const style = getComputedStyle(element);
        const widths = [
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
        ].map(Number.parseFloat);
        const styles = [
          style.borderTopStyle,
          style.borderRightStyle,
          style.borderBottomStyle,
          style.borderLeftStyle,
        ];
        return {
          borderImageSource: style.borderImageSource,
          visibleEdge: widths.some((width, edge) => width >= 1 && styles[edge] !== "none"),
        };
      });

      expect(
        fallback.borderImageSource,
        `${name} should not require imagery in forced colors`,
      ).toBe("none");
      expect(fallback.visibleEdge, `${name} should retain a visible fallback edge`).toBe(true);
    }
  }

  await expectNoDocumentOverflow(page);
});
