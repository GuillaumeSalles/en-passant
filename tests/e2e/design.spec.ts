import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function expectTooltipWithinViewport(page: Page, triggerName: string, tooltipText: string) {
  const trigger = page.getByRole("button", { name: triggerName });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.hover();

  const tooltip = page.locator('[role="tooltip"]').filter({ hasText: tooltipText });
  await expect(tooltip).toBeVisible();

  const box = await tooltip.boundingBox();
  const viewport = page.viewportSize();
  if (box === null || viewport === null) {
    throw new Error("Expected tooltip and viewport boxes to be available");
  }

  expect(box.x).toBeGreaterThanOrEqual(7);
  expect(box.y).toBeGreaterThanOrEqual(7);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 7);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 7);
}

test("design tooltips stay within the viewport near screen edges", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/design");

  await expectTooltipWithinViewport(
    page,
    "Left edge tooltip",
    "Left edge tooltip remains within the viewport",
  );
  await expectTooltipWithinViewport(
    page,
    "Right edge tooltip",
    "Right edge tooltip remains within the viewport",
  );
});

test("shows the signup nudge on the design page", async ({ page }) => {
  await page.goto("/design");

  await expect(
    page.getByText("Sign up to make sure you don't lose your repertoires. It's free."),
  ).toBeVisible();
});
