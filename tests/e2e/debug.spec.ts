import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { collectUnexpectedConsole } from "./helpers";

async function seedDatabase(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase("en-passant");
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => reject(new Error("Database deletion blocked"));
      deleteRequest.onsuccess = () => resolve();
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open("en-passant", 1);
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        db.createObjectStore("repertoires");
        db.createObjectStore("chapters");
        db.createObjectStore("pgns");
        db.createObjectStore("metadata");
      };
      openRequest.onsuccess = () => resolve(openRequest.result);
    });

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["repertoires"], "readwrite");
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.objectStore("repertoires").put(
        {
          id: "debug-test",
          handle: "debug-test",
          name: "Debug Test",
          orientation: "white",
          updatedAt: "2026-06-26T00:00:00.000Z",
          deletedAt: null,
          dirty: false,
        },
        "debug-test",
      );
    });
  });
}

async function openDatabaseAndReturnOldVersion(page: Page) {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      let oldVersion = -1;
      const openRequest = indexedDB.open("en-passant", 1);
      openRequest.onerror = () => reject(openRequest.error);
      openRequest.onupgradeneeded = (event) => {
        oldVersion = event.oldVersion;
      };
      openRequest.onsuccess = () => {
        openRequest.result.close();
        resolve(oldVersion);
      };
    });
  });
}

test("debug page deletes the IndexedDB database", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);

  await page.goto("/debug");
  await seedDatabase(page);
  await page.reload();

  await page.getByRole("button", { name: "Delete IndexedDB database" }).click();

  await expect(page.getByText("IndexedDB database deleted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete IndexedDB database" })).toBeEnabled();
  await expect(await openDatabaseAndReturnOldVersion(page)).toBe(0);
  expect(consoleMessages).toEqual([]);
});
