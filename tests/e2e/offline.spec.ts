import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { mockSignedOutAuth } from "./helpers";

async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller !== null) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });
}

test("starts offline with the cached shell and local repertoire", async ({ context, page }) => {
  await mockSignedOutAuth(page);
  await page.goto("/app");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("[data-moves-tree]")).toBeVisible();
  await waitForServiceWorkerControl(page);
  await page.evaluate(async () => {
    const response = await fetch("/sounds/default/Move.m4a");
    if (!response.ok) throw new Error("Failed to prime the optional asset cache");
  });

  const repertoireUrl = page.url();
  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveURL(repertoireUrl);
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("[data-moves-tree]")).toBeVisible();

  const offlineAvailability = await page.evaluate(async () => {
    const cachedResponse = await fetch("/sounds/default/Move.m4a");
    let networkOnlyRequestFailed = true;
    try {
      await fetch("/api/not-previously-fetched");
      networkOnlyRequestFailed = false;
    } catch {
      // API responses are deliberately never made available by the service worker.
    }
    return { cachedAsset: cachedResponse.ok, networkOnlyRequestFailed };
  });
  expect(offlineAvailability).toEqual({ cachedAsset: true, networkOnlyRequestFailed: true });
});
