import { expect, test } from "./fixtures";
import { collectUnexpectedConsole, mockSignedOutAuth } from "./helpers";

test("concurrent PGN writes preserve every mutation", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await mockSignedOutAuth(page);
  await page.goto("/debug");

  const pendingMutations = await page.evaluate(async () => {
    const storageModulePath = "/src/storage/index.ts";
    const storage = (await import(
      /* @vite-ignore */ storageModulePath
    )) as typeof import("../../src/storage");

    await storage.deleteIndexedDbDatabase();
    await storage.createRepertoireAndChapter(
      {
        id: "atomic-repertoire",
        handle: "atomic-repertoire",
        name: "Atomic repertoire",
        orientation: "white",
      },
      {
        id: "atomic-chapter",
        repertoireId: "atomic-repertoire",
        handle: "atomic-chapter",
        name: "Atomic chapter",
        pgnId: "atomic-pgn",
      },
      "*",
    );

    const firstMutation = {
      type: "addMove",
      parentPath: [],
      move: "e2e4",
      annotations: { nags: [], commentBefore: null, commentAfter: null },
    } as const;
    const secondMutation = {
      type: "addMove",
      parentPath: [],
      move: "d2d4",
      annotations: { nags: [], commentBefore: null, commentAfter: null },
    } as const;

    await Promise.all([
      storage.savePgnMutation("atomic-pgn", "1. e4 *", [firstMutation]),
      storage.savePgnMutation("atomic-pgn", "1. d4 *", [secondMutation]),
    ]);

    const syncRequest = await storage.getRepertoireSyncRequest();
    return syncRequest.changes.pgns[0]?.mutations ?? [];
  });

  expect(pendingMutations).toEqual([
    { type: "createPgn", pgn: "*" },
    {
      type: "addMove",
      parentPath: [],
      move: "e2e4",
      annotations: { nags: [], commentBefore: null, commentAfter: null },
    },
    {
      type: "addMove",
      parentPath: [],
      move: "d2d4",
      annotations: { nags: [], commentBefore: null, commentAfter: null },
    },
  ]);
  expect(consoleMessages).toEqual([]);
});
