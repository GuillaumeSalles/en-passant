import { expect, test } from "./fixtures";
import { STORAGE_ORIGIN_PATH } from "./helpers";
test("leaves legacy data untouched and starts without API requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url());
  });
  await page.goto(STORAGE_ORIGIN_PATH);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("en-passant", 4);
      r.onupgradeneeded = () => r.result.createObjectStore("legacy");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("legacy", "readwrite");
      tx.objectStore("legacy").put("keep me", "backup");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Create repertoire", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("en-passant");
        r.onsuccess = () => resolve(r.result);
      });
      return new Promise((resolve) => {
        const r = db.transaction("legacy").objectStore("legacy").get("backup");
        r.onsuccess = () => {
          db.close();
          resolve(r.result);
        };
      });
    }),
  ).toBe("keep me");
  expect(requests).toEqual([]);
});
test("concurrent local transactions preserve independent edits and deletions", async ({ page }) => {
  await page.goto(STORAGE_ORIGIN_PATH);
  const result = await page.evaluate(async () => {
    const modulePath = "/src/storage/index.ts";
    const storage = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import("../../src/storage");
    await storage.createRepertoireAndChapter(
      { id: "r", handle: "r", name: "Local", orientation: "white" },
      { id: "c", repertoireId: "r", handle: "c", name: "Chapter", pgnId: "p" },
      "1. e4 *",
    );
    await Promise.all([
      storage.updateRepertoire({ id: "r", handle: "r", name: "Renamed", orientation: "white" }),
      storage.createChapter(
        { id: "c2", repertoireId: "r", handle: "c2", name: "Second", pgnId: "p2" },
        "1. d4 *",
      ),
    ]);
    const before = await storage.getInitialRepertoiresAndChapters();
    await storage.deleteRepertoire("r");
    return {
      before,
      after: await storage.getInitialRepertoiresAndChapters(),
      pgn: await storage.getPgn("p2"),
    };
  });
  expect(result.before.repertoires[0]?.name).toBe("Renamed");
  expect(result.before.chapters).toHaveLength(2);
  expect(result.after.repertoires).toEqual([]);
  expect(result.after.chapters).toEqual([]);
  expect(result.pgn).toBeUndefined();
});
