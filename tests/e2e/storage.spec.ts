import { expect, test } from "./fixtures";
import {
  STORAGE_ORIGIN_PATH,
  seedIndexedDb,
  expectLocalOnly,
  storedDatabaseSchema,
} from "./helpers";
import { parseGameImport } from "../../src/lib/localGames";
import { indexPgnMoves } from "../../src/lib/moveIndex";

const currentSchema = {
  version: 5,
  indexes: {
    chapters: ["by-repertoire"],
    "game-moves": ["by-position", "by-source"],
    games: [],
    "game-imports": [],
    metadata: [],
    pgns: [],
    "repertoire-moves": ["by-source"],
    repertoires: [],
    "training-line-schedules": [],
    "training-move-schedules": [],
  },
};

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
  expect(await storedDatabaseSchema(page)).toEqual(currentSchema);
});

test("upgrades the local v1 library with position indexes and preserves source records", async ({
  page,
}) => {
  await expectLocalOnly(page);
  const metadata = { updatedAt: "2026-01-01", deletedAt: null, dirty: false };
  const game = parseGameImport(
    '[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 *',
    "Alice",
    "white",
    () => "g",
  )[0];
  if (game === undefined) throw new Error("Missing game fixture");
  await seedIndexedDb(page, {
    repertoires: [{ id: "r", name: "White", handle: "r", orientation: "white", ...metadata }],
    chapters: [
      { id: "c", repertoireId: "r", pgnId: "p", name: "Chapter", handle: "c", ...metadata },
    ],
    pgns: [{ id: "p", pgn: "1. e4 (1. d4 d5) e5 2. Bc4 *", ...metadata }],
    trainingLineSchedules: [
      {
        repertoireId: "r",
        chapterId: "c",
        uciPath: "e2e4 e7e5 f1c4",
        intervalIndex: 3,
        dueAt: 123,
        lastReviewedAt: 100,
        algorithmVersion: 1,
        ...metadata,
      },
    ],
    games: [game],
  });
  const result = await page.evaluate(async () => {
    const dbPath = "/src/storage/localDatabase.ts";
    const storagePath = "/src/storage/index.ts";
    const gamesPath = "/src/lib/games.ts";
    const { localDatabase } = (await import(
      /* @vite-ignore */ dbPath
    )) as typeof import("../../src/storage/localDatabase");
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import("../../src/storage");
    const games = (await import(
      /* @vite-ignore */ gamesPath
    )) as typeof import("../../src/lib/games");
    const snapshot = await localDatabase().read([
      { store: "repertoire-moves" },
      { store: "game-moves" },
    ]);
    const repertoire = storage.records<import("../../src/lib/moveIndex").MoveOccurrence>(
      snapshot,
      "repertoire-moves",
    );
    const first = repertoire.find((move) => move.san === "e4");
    if (first === undefined) throw new Error("Missing indexed root");
    const matches = await localDatabase().read([
      { store: "game-moves", index: "by-position", key: first.beforeKey },
    ]);
    return {
      repertoire,
      gameMoves: storage.records(snapshot, "game-moves"),
      matches: matches.records.length,
      source: await storage.getPgn("p"),
      schedules: await storage.getAllTrainingLineSchedules(),
      game: await games.loadGame("g"),
      stats: await games.loadPositionMoves(first.beforeKey, "white"),
      links: await games.loadTrainingMistakeLinks(),
    };
  });
  expect(await storedDatabaseSchema(page)).toEqual(currentSchema);
  expect(result.repertoire).toHaveLength(5);
  expect(result.gameMoves).toHaveLength(3);
  expect(result.matches).toBe(1);
  expect(result.source).toBe("1. e4 (1. d4 d5) e5 2. Bc4 *");
  expect(result.schedules[0]).toMatchObject({
    intervalIndex: 3,
    dueAt: 123,
    uciPath: "e2e4 e7e5 f1c4",
  });
  expect(result.game).toMatchObject({
    ok: true,
    game: { pgn: game.pgn, repertoireMistake: { playedSan: "Nf3", expectedSan: "Bc4" } },
  });
  expect(result.stats).toMatchObject({
    ok: true,
    data: { games: 1, moves: [{ san: "e4", games: 1 }] },
  });
  expect(result.links).toMatchObject({
    ok: true,
    links: [{ chapterId: "c", uciPath: "e2e4 e7e5 f1c4" }],
  });
});

test("keeps move indexes atomic through edits, conflicts, failures, and deletion", async ({
  page,
}) => {
  await expectLocalOnly(page);
  await page.goto(STORAGE_ORIGIN_PATH);
  const result = await page.evaluate(async () => {
    const dbPath = "/src/storage/localDatabase.ts";
    const storagePath = "/src/storage/index.ts";
    const { localDatabase } = (await import(
      /* @vite-ignore */ dbPath
    )) as typeof import("../../src/storage/localDatabase");
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import("../../src/storage");
    const db = localDatabase();
    await storage.createRepertoireAndChapter(
      { id: "r", handle: "r", name: "Local", orientation: "white" },
      { id: "c", repertoireId: "r", handle: "c", name: "Chapter", pgnId: "p" },
      "1. e4 e5 2. Nf3 *",
    );
    const before = await db.read();
    const original = storage.records<import("../../src/storage/contracts").StoredPgn>(
      before,
      "pgns",
    )[0];
    if (original === undefined) throw new Error("Missing source");
    const edit = (pgn: string) => ({
      expectedVersion: before.version,
      put: [storage.record("pgns", "p", { ...original, pgn })],
      remove: [],
    });
    const commits = await Promise.all([
      db.commit(edit("1. d4 d5 *")),
      db.commit(edit("1. c4 e5 *")),
    ]);
    const readMoves = async () =>
      storage.records<import("../../src/lib/moveIndex").MoveOccurrence>(
        await db.read([{ store: "repertoire-moves", index: "by-source", key: "p" }]),
        "repertoire-moves",
      );
    const afterConflict = { source: await storage.getPgn("p"), moves: await readMoves() };
    let failed = false;
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "repertoire-moves")
        throw new DOMException("Simulated index write failure", "QuotaExceededError");
      return originalPut.call(this, value, key);
    };
    try {
      await storage.savePgnMutation("p", "1. Nf3 *", [{ type: "createPgn", pgn: "1. Nf3 *" }]);
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
    const afterFailure = { source: await storage.getPgn("p"), moves: await readMoves() };
    await storage.savePgnMutation("p", "1. e4 (1. d4) c5 *", [
      { type: "createPgn", pgn: "1. e4 (1. d4) c5 *" },
    ]);
    const afterEdit = await readMoves();
    await storage.deleteChapter("c", "p");
    return {
      commits,
      afterConflict,
      failed,
      afterFailure,
      afterEdit,
      afterDelete: await readMoves(),
      deletedSource: await storage.getPgn("p"),
    };
  });
  expect(result.commits.filter(Boolean)).toHaveLength(1);
  expect(result.afterConflict.moves.map((move) => move.san)).toEqual(
    result.afterConflict.source?.includes("d4") ? ["d4", "d5"] : ["c4", "e5"],
  );
  expect(result.failed).toBe(true);
  expect(result.afterFailure).toEqual(result.afterConflict);
  expect(result.afterEdit.map((move) => move.san)).toEqual(["e4", "d4", "c5"]);
  expect(result.afterDelete).toEqual([]);
  expect(result.deletedSource).toBeUndefined();
});

test("an invalid v1 PGN aborts indexing without modifying or resetting the library", async ({
  page,
}) => {
  await expectLocalOnly(page);
  const metadata = { updatedAt: "2026-01-01", deletedAt: null, dirty: false };
  await seedIndexedDb(page, {
    repertoires: [{ id: "r", name: "Keep me", handle: "r", orientation: "white", ...metadata }],
    chapters: [
      { id: "c", repertoireId: "r", pgnId: "p", name: "Chapter", handle: "c", ...metadata },
    ],
    pgns: [{ id: "p", pgn: "1. e5 *", ...metadata }],
  });
  const result = await page.evaluate(async () => {
    const modulePath = "/src/storage/localDatabase.ts";
    const { localDatabase } = (await import(
      /* @vite-ignore */ modulePath
    )) as typeof import("../../src/storage/localDatabase");
    let error = "";
    try {
      await localDatabase().read();
    } catch (cause) {
      error = String(cause);
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("en-passant-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const version = db.version;
    const stores = [...db.objectStoreNames];
    const pgn = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction("pgns").objectStore("pgns").get("p");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { error, version, stores, pgn };
  });
  expect(result.error).toContain("Original data was preserved");
  expect(result.version).toBe(1);
  expect(result.stores).not.toContain("repertoire-moves");
  expect(result.pgn).toMatchObject({ id: "p", pgn: "1. e5 *" });
});

test("queries matching games directly and replaces or removes their indexed occurrences", async ({
  page,
}) => {
  await expectLocalOnly(page);
  await page.goto(STORAGE_ORIGIN_PATH);
  const result = await page.evaluate(async () => {
    const dbPath = "/src/storage/localDatabase.ts";
    const storagePath = "/src/storage/index.ts";
    const gamesPath = "/src/lib/games.ts";
    const parserPath = "/src/lib/localGames.ts";
    const { localDatabase } = (await import(
      /* @vite-ignore */ dbPath
    )) as typeof import("../../src/storage/localDatabase");
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import("../../src/storage");
    const games = (await import(
      /* @vite-ignore */ gamesPath
    )) as typeof import("../../src/lib/games");
    const { parseGameImport } = (await import(
      /* @vite-ignore */ parserPath
    )) as typeof import("../../src/lib/localGames");
    const db = localDatabase();
    const first = parseGameImport(
      '[Result "1-0"]\n\n1. e4 e5 2. Nf3 *',
      "",
      "white",
      () => "first",
    )[0];
    const other = parseGameImport('[Result "0-1"]\n\n1. d4 d5 *', "", "white", () => "other")[0];
    if (first === undefined || other === undefined) throw new Error("Missing games");
    await db.commit({
      expectedVersion: (await db.read([])).version,
      put: [storage.record("games", first.id, first), storage.record("games", other.id, other)],
      remove: [],
    });
    const moves = storage.records<import("../../src/lib/moveIndex").MoveOccurrence>(
      await db.read([{ store: "game-moves", index: "by-source", key: "first" }]),
      "game-moves",
    );
    const e5 = moves.find((move) => move.san === "e5");
    if (e5 === undefined) throw new Error("Missing indexed move");
    const originalGetAll = IDBObjectStore.prototype.getAll;
    const gameReads: (IDBValidKey | IDBKeyRange | null | undefined)[] = [];
    IDBObjectStore.prototype.getAll = function (
      query?: IDBValidKey | IDBKeyRange | null,
      count?: number,
    ) {
      if (this.name === "pgns") throw new Error("Unexpected PGN scan");
      if (this.name === "games") gameReads.push(query);
      return originalGetAll.call(this, query, count);
    };
    let stats: Awaited<ReturnType<typeof games.loadPositionMoves>>;
    try {
      stats = await games.loadPositionMoves(e5.beforeKey, "white");
      await storage.getInitialRepertoiresAndChapters();
    } finally {
      IDBObjectStore.prototype.getAll = originalGetAll;
    }
    await db.commit({
      expectedVersion: (await db.read([])).version,
      put: [storage.record("games", "first", { ...first, pgn: "1. c4 e5 *" })],
      remove: [],
    });
    const afterReplace = await games.loadPositionMoves(e5.beforeKey, "white");
    await db.commit({
      expectedVersion: (await db.read([])).version,
      put: [],
      remove: [{ store: "games", id: "first" }],
    });
    const afterDelete = await db.read([{ store: "game-moves", index: "by-source", key: "first" }]);
    const unaffected = await games.loadGame("other");
    return { stats, gameReads, afterReplace, deletedMoves: afterDelete.records, unaffected };
  });
  expect(result.stats).toMatchObject({ ok: true, data: { games: 1, moves: [{ san: "e5" }] } });
  expect(result.gameReads).toEqual(["first"]);
  expect(result.afterReplace).toMatchObject({ ok: true, data: { games: 0, moves: [] } });
  expect(result.deletedMoves).toEqual([]);
  expect(result.unaffected).toMatchObject({ ok: true, game: { id: "other" } });
});

test("removes unused v2 indexes while preserving every stored record and revision", async ({
  page,
}) => {
  await expectLocalOnly(page);
  const metadata = { updatedAt: "2026-01-01", deletedAt: null, dirty: false };
  const pgn = "1. e4 e5 *";
  const game = parseGameImport('[Result "1-0"]\n\n1. e4 e5 *', "", "white", () => "g")[0];
  if (game === undefined) throw new Error("Missing game fixture");
  await seedIndexedDb(page, {
    repertoires: [{ id: "r", name: "White", handle: "r", orientation: "white", ...metadata }],
    chapters: [
      { id: "c", repertoireId: "r", pgnId: "p", name: "Chapter", handle: "c", ...metadata },
    ],
    pgns: [{ id: "p", pgn, ...metadata }],
    games: [game],
    trainingLineSchedules: [
      {
        repertoireId: "r",
        chapterId: "c",
        uciPath: "e2e4",
        intervalIndex: 2,
        dueAt: 123,
        lastReviewedAt: 100,
        algorithmVersion: 1,
        ...metadata,
      },
    ],
  });
  const result = await page.evaluate(
    async ({ repertoireMoves, gameMoves }) => {
      // Recreate the historical v2 schema, independent of the current schema builder.
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("en-passant-local-v1", 2);
        request.onupgradeneeded = () => {
          const tx = request.transaction;
          if (tx === null) throw new Error("Missing upgrade transaction");
          tx.objectStore("chapters").createIndex("by-pgn", "pgnId");
          tx.objectStore("chapters").createIndex("by-repertoire", "repertoireId");
          for (const name of ["repertoire-moves", "game-moves"]) {
            const store = request.result.createObjectStore(name);
            store.createIndex("by-source", "sourceId");
            store.createIndex("by-position", "beforeKey");
            store.createIndex("by-position-move", ["beforeKey", "uci"]);
            store.createIndex("by-resulting-position", "afterKey");
            for (const move of name === "repertoire-moves" ? repertoireMoves : gameMoves) {
              store.put(move, move.id);
            }
          }
          tx.objectStore("metadata").put(17, "revision");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const stores = [...db.objectStoreNames];
      const tx = db.transaction(stores, "readonly");
      const before = Object.fromEntries(
        await Promise.all(
          stores.map(async (name) => {
            const values = await new Promise<unknown[]>((resolve, reject) => {
              const request = tx.objectStore(name).getAll();
              request.onsuccess = () => resolve(request.result as unknown[]);
              request.onerror = () => reject(request.error);
            });
            return [name, values];
          }),
        ),
      );
      db.close();
      // A v2 upgrade must not read/reparse documents to rebuild the existing move stores.
      const originalCursor = IDBObjectStore.prototype.openCursor;
      IDBObjectStore.prototype.openCursor = function (
        query?: IDBValidKey | IDBKeyRange | null,
        direction?: IDBCursorDirection,
      ) {
        if (this.name === "pgns" || this.name === "games")
          throw new Error("Unexpected source rebuild");
        return originalCursor.call(this, query, direction);
      };
      try {
        const modulePath = "/src/storage/localDatabase.ts";
        const { localDatabase } = (await import(
          /* @vite-ignore */ modulePath
        )) as typeof import("../../src/storage/localDatabase");
        const snapshot = await localDatabase().read([
          { store: "repertoires" },
          { store: "chapters" },
          { store: "pgns" },
          { store: "games" },
          { store: "training-line-schedules" },
          { store: "repertoire-moves" },
          { store: "game-moves" },
        ]);
        const after = Object.fromEntries(
          stores.map((name) => [
            name,
            name === "metadata"
              ? [snapshot.version]
              : snapshot.records
                  .filter((record) => record.store === name)
                  .map((record) => JSON.parse(record.value) as unknown),
          ]),
        );
        return { before, after };
      } finally {
        IDBObjectStore.prototype.openCursor = originalCursor;
      }
    },
    {
      repertoireMoves: indexPgnMoves("p", pgn, "tree"),
      gameMoves: indexPgnMoves("g", game.pgn, "mainline"),
    },
  );
  expect(result.after).toEqual(result.before);
  expect(await storedDatabaseSchema(page)).toEqual(currentSchema);
});

test("move reviews merge concurrent results and reject stale source moves atomically", async ({
  page,
}) => {
  await expectLocalOnly(page);
  await page.goto(STORAGE_ORIGIN_PATH);
  const result = await page.evaluate(async () => {
    const storagePath = "/src/storage/index.ts";
    const statePath = "/src/lib/AppState.ts";
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import("../../src/storage");
    const state = (await import(
      /* @vite-ignore */ statePath
    )) as typeof import("../../src/lib/AppState");
    const pgn = "1. e4 e5 2. Nf3 *";
    await storage.createRepertoireAndChapter(
      { id: "r", name: "White", handle: "r", orientation: "white" },
      { id: "c", repertoireId: "r", name: "Main", handle: "c", pgnId: "p" },
      pgn,
    );
    const targets = state.getTrainingMoveTargets("r", state.normalizePgn(pgn), "white");
    const attempts = targets.map((target) => ({
      identity: target,
      chapterId: "c",
      uciPath: target.uciPath,
      outcome: "correct" as const,
      now: 100,
    }));
    await Promise.all(attempts.map((attempt) => storage.recordTrainingMoveAttempts([attempt])));
    const initial = await storage.getAllTrainingMoveSchedules();
    const first = attempts[0];
    const second = attempts[1];
    if (first === undefined || second === undefined) throw new Error("Missing test moves");
    await Promise.all([
      storage.recordTrainingMoveAttempts([{ ...first, now: 4_000_000 }]),
      storage.recordTrainingMoveAttempts([{ ...first, now: 4_000_000 }]),
    ]);
    const advanced = await storage.getAllTrainingMoveSchedules();
    await storage.savePgnMutation("p", "1. e4 *", [{ type: "replacePgn", pgn: "1. e4 *" }]);
    let rejected = false;
    try {
      await storage.recordTrainingMoveAttempts([
        { ...first, now: 100_000_000 },
        { ...second, now: 100_000_000 },
      ]);
    } catch {
      rejected = true;
    }
    return {
      initial,
      advanced,
      rejected,
      after: await storage.getAllTrainingMoveSchedules(),
      pgn: await storage.getPgn("p"),
    };
  });
  expect(result.initial).toHaveLength(2);
  expect(result.advanced.find((review) => review.uci === "e2e4")).toMatchObject({
    intervalIndex: 1,
    successes: 2,
  });
  expect(result.advanced.find((review) => review.uci === "g1f3")).toMatchObject({
    intervalIndex: 0,
    successes: 1,
  });
  expect(result.rejected).toBe(true);
  expect(result.after).toEqual(result.advanced);
  expect(result.pgn).toBe("1. e4 *");
});

for (const previousVersion of [3, 4]) {
  for (const failUpgrade of [false, true]) {
    test(`v${previousVersion} additive upgrade ${failUpgrade ? "rolls back on failure" : "preserves sources, schedules and occurrences"}`, async ({
      page,
    }) => {
      await expectLocalOnly(page);
      const metadata = { updatedAt: "2026-01-01", deletedAt: null, dirty: false };
      await seedIndexedDb(page, {
        repertoires: [{ id: "r", name: "White", handle: "r", orientation: "white", ...metadata }],
        chapters: [
          { id: "c", repertoireId: "r", pgnId: "p", name: "Main", handle: "c", ...metadata },
        ],
        pgns: [{ id: "p", pgn: "1. e4 *", ...metadata }],
        trainingLineSchedules: [
          {
            repertoireId: "r",
            chapterId: "c",
            uciPath: "e2e4",
            intervalIndex: 4,
            dueAt: 123,
            lastReviewedAt: 100,
            algorithmVersion: 1,
            ...metadata,
          },
        ],
      });
      const result = await page.evaluate(
        async ({ failUpgrade, moves, previousVersion }) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const opening = indexedDB.open("en-passant-local-v1", previousVersion);
            opening.onupgradeneeded = () => {
              const tx = opening.transaction;
              if (tx === null) throw new Error("Missing transaction");
              tx.objectStore("chapters").createIndex("by-repertoire", "repertoireId");
              for (const name of ["repertoire-moves", "game-moves"]) {
                const store = opening.result.createObjectStore(name);
                store.createIndex("by-source", "sourceId");
                if (name === "game-moves") store.createIndex("by-position", "beforeKey");
                if (name === "repertoire-moves") for (const move of moves) store.put(move, move.id);
              }
              if (previousVersion === 4)
                opening.result.createObjectStore("training-move-schedules");
              tx.objectStore("metadata").put(23, "revision");
            };
            opening.onsuccess = () => resolve(opening.result);
            opening.onerror = () => reject(opening.error);
          });
          async function snapshot(database: IDBDatabase) {
            const tx = database.transaction([...database.objectStoreNames], "readonly");
            return Object.fromEntries(
              await Promise.all(
                [...database.objectStoreNames].map(async (name) => {
                  const values = await new Promise<unknown[]>((resolve, reject) => {
                    const r = tx.objectStore(name).getAll();
                    r.onsuccess = () => resolve(r.result as unknown[]);
                    r.onerror = () => reject(r.error);
                  });
                  return [name, values];
                }),
              ),
            );
          }
          const before = await snapshot(db);
          db.close();
          const originalCreate = IDBDatabase.prototype.createObjectStore;
          const originalCursor = IDBObjectStore.prototype.openCursor;
          IDBDatabase.prototype.createObjectStore = function (name, options) {
            const store = originalCreate.call(this, name, options);
            if (
              failUpgrade &&
              name === (previousVersion === 3 ? "training-move-schedules" : "game-imports")
            )
              store.transaction.abort();
            return store;
          };
          IDBObjectStore.prototype.openCursor = function () {
            throw new Error("Unexpected occurrence rebuild");
          };
          let failed = false;
          try {
            const path = "/src/storage/localDatabase.ts";
            const storage = (await import(
              /* @vite-ignore */ path
            )) as typeof import("../../src/storage/localDatabase");
            await storage.localDatabase().read([]);
          } catch {
            failed = true;
          } finally {
            IDBDatabase.prototype.createObjectStore = originalCreate;
            IDBObjectStore.prototype.openCursor = originalCursor;
          }
          const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open("en-passant-local-v1");
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          const after = await snapshot(reopened);
          const version = reopened.version;
          reopened.close();
          return { before, after, version, failed };
        },
        { failUpgrade, previousVersion, moves: indexPgnMoves("p", "1. e4 *", "tree") },
      );
      expect(result.failed).toBe(failUpgrade);
      expect(result.version).toBe(failUpgrade ? previousVersion : 5);
      expect(result.after).toEqual(
        failUpgrade
          ? result.before
          : { ...result.before, "training-move-schedules": [], "game-imports": [] },
      );
    });
  }
}

test("saves a repeated terminal decision under its existing position identity", async ({
  page,
}) => {
  await expectLocalOnly(page);
  await page.goto(STORAGE_ORIGIN_PATH);
  const result = await page.evaluate(async () => {
    const storagePath = "/src/storage/index.ts";
    const statePath = "/src/lib/AppState.ts";
    const storage = (await import(
      /* @vite-ignore */ storagePath
    )) as typeof import("../../src/storage");
    const state = (await import(
      /* @vite-ignore */ statePath
    )) as typeof import("../../src/lib/AppState");
    const pgn = "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 *";
    const path = "g1f3 g8f6 f3g1 f6g8 g1f3";
    await storage.createRepertoireAndChapter(
      { id: "r", name: "White", handle: "r", orientation: "white" },
      { id: "c", repertoireId: "r", name: "Main", handle: "c", pgnId: "p" },
      pgn,
    );
    const target = state
      .getLineMoveTargets("r", state.normalizePgn(pgn), "white", path)
      .find((entry) => entry.uciPath === path);
    if (target === undefined) throw new Error("Missing repeated target");
    await storage.recordTrainingMoveAttempts([
      { identity: target, chapterId: "c", uciPath: path, outcome: "correct", now: 100 },
    ]);
    return storage.getAllTrainingMoveSchedules();
  });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ uci: "g1f3", intervalIndex: 0, successes: 1 });
});
