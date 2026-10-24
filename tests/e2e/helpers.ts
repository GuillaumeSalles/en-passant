import type { TrainingMoveReview } from "../../src/lib/app-state/trainingMoves";
import { expect, type Page } from "@playwright/test";
import type { StoredGame } from "../../src/lib/gameContracts";

export const STORAGE_ORIGIN_PATH = "/stockfish-18-lite-single.js";

const ENGINE_ENABLED_KEY = "en_passant_engine_enabled";

export async function pausePacingClock(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}

export async function advanceTrainingPacing(page: Page, phase: string, durationMs: number) {
  await expect(page.locator(`[data-training-flow-state="${phase}"]`)).toBeVisible();
  await page.clock.runFor(durationMs);
}

export async function expectTrainingInputReady(page: Page) {
  await expect(page.locator('[data-training-flow-state="awaiting-line-move"]')).toBeVisible();
}

export async function advanceLearningPacing(page: Page, durationMs: number) {
  await expect(page.locator('[data-learning-flow-state="pacing"]')).toBeVisible();
  await page.clock.runFor(durationMs);
}

export type RepertoireRecord = {
  id: string;
  handle: string;
  name: string;
  orientation: "white" | "black";
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
};

export type ChapterRecord = {
  id: string;
  repertoireId: string;
  handle: string;
  name: string;
  pgnId: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
};

export type PgnRecord = {
  id: string;
  pgn: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
};

export type TrainingLineScheduleRecord = {
  repertoireId: string;
  chapterId: string;
  uciPath: string;
  intervalIndex: number;
  dueAt: number;
  lastReviewedAt: number;
  algorithmVersion: number;
  updatedAt: string;
  dirty: boolean;
};

export function collectUnexpectedConsole(page: Page): string[] {
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      const location = message.location();
      consoleMessages.push(
        `${message.type()}: ${message.text()} (${location.url}:${location.lineNumber})`,
      );
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });
  return consoleMessages;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function expectLocalOnly(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    await route.abort();
    throw new Error(`Unexpected backend request: ${route.request().url()}`);
  });
}

export async function gotoStorageOrigin(page: Page): Promise<void> {
  await page.goto(STORAGE_ORIGIN_PATH);
}

export async function enableEngine(page: Page): Promise<void> {
  await gotoStorageOrigin(page);
  await page.evaluate((engineEnabledKey) => {
    window.localStorage.setItem(engineEnabledKey, "true");
  }, ENGINE_ENABLED_KEY);
}

export async function clearLocalStorageAndIndexedDb(page: Page): Promise<void> {
  await gotoStorageOrigin(page);
  await page.evaluate(async () => {
    const deleteIndexedDb = () =>
      new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase("en-passant-local-v1");
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => reject(new Error("Database deletion blocked"));
        deleteRequest.onsuccess = () => resolve();
      });

    localStorage.clear();
    await deleteIndexedDb();
  });
}

export async function seedIndexedDb(
  page: Page,
  records: {
    repertoires: RepertoireRecord[];
    chapters: ChapterRecord[];
    pgns: PgnRecord[];
    trainingLineSchedules?: TrainingLineScheduleRecord[];
    trainingMoveSchedules?: TrainingMoveReview[];
    games?: StoredGame[];
    clearLocalStorage?: boolean;
  },
): Promise<void> {
  const preparedRecords = {
    ...records,
    pgns: records.pgns.map((record) => ({
      id: record.id,
      pgn: record.pgn,
      revision: record.dirty ? null : `revision-${record.id}`,
      byteSize: new TextEncoder().encode(record.pgn).byteLength,
      pendingMutations: record.dirty ? [{ type: "createPgn", pgn: record.pgn }] : [],
      metadataDirty: record.dirty,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    })),
    trainingLineSchedules: records.trainingLineSchedules ?? [],
    trainingMoveSchedules: records.trainingMoveSchedules ?? [],
    games: records.games ?? [],
  };
  await gotoStorageOrigin(page);
  await page.evaluate(
    async ({ records }) => {
      const deleteIndexedDb = () =>
        new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase("en-passant-local-v1");
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => reject(new Error("Database deletion blocked"));
          deleteRequest.onsuccess = () => resolve();
        });
      const openSeedDatabase = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const openRequest = indexedDB.open("en-passant-local-v1", 1);
          openRequest.onerror = () => reject(openRequest.error);
          openRequest.onupgradeneeded = () => {
            const db = openRequest.result;
            db.createObjectStore("repertoires");
            db.createObjectStore("chapters");
            db.createObjectStore("pgns");
            db.createObjectStore("training-line-schedules");
            if (records.trainingMoveSchedules.length > 0)
              db.createObjectStore("training-move-schedules");
            db.createObjectStore("metadata");
            db.createObjectStore("games");
          };
          openRequest.onsuccess = () => resolve(openRequest.result);
        });

      if (records.clearLocalStorage === true) {
        localStorage.clear();
      }
      await deleteIndexedDb();
      const db = await openSeedDatabase();

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          [
            "repertoires",
            "chapters",
            "pgns",
            "training-line-schedules",
            "metadata",
            "games",
            ...(records.trainingMoveSchedules.length > 0 ? ["training-move-schedules"] : []),
          ],
          "readwrite",
        );
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        for (const repertoire of records.repertoires) {
          transaction.objectStore("repertoires").put(repertoire, repertoire.id);
        }
        for (const chapter of records.chapters) {
          transaction.objectStore("chapters").put(chapter, chapter.id);
        }
        for (const pgn of records.pgns) {
          transaction.objectStore("pgns").put(pgn, pgn.id);
        }
        for (const game of records.games) {
          transaction.objectStore("games").put(game, game.id);
        }
        for (const schedule of records.trainingMoveSchedules) {
          transaction
            .objectStore("training-move-schedules")
            .put(
              schedule,
              JSON.stringify([schedule.repertoireId, schedule.positionKey, schedule.uci]),
            );
        }
        for (const schedule of records.trainingLineSchedules) {
          const key = `${schedule.repertoireId}/${schedule.chapterId}/${schedule.uciPath}`;
          transaction.objectStore("training-line-schedules").put(schedule, key);
        }
      });
    },
    { records: preparedRecords },
  );
}

export async function storedRepertoireHandles(page: Page): Promise<string[]> {
  return await readObjectStore(page, "repertoires", (record) =>
    isRecord(record) && typeof record["handle"] === "string" ? record["handle"] : "",
  );
}

export async function firstStoredPgn(page: Page): Promise<string> {
  const values = await storedPgns(page);
  const pgn = values[0] ?? null;
  expect(pgn).not.toBeNull();
  return pgn;
}

export async function storedPgns(page: Page): Promise<string[]> {
  const values = await readObjectStore(page, "pgns", (record) =>
    isRecord(record) && typeof record["pgn"] === "string" ? record["pgn"] : null,
  );
  return values.filter((value) => value !== null);
}

export async function storedTrainingLineUciPaths(page: Page): Promise<string[]> {
  return await readObjectStore(page, "training-line-schedules", (record) =>
    isRecord(record) && typeof record["uciPath"] === "string" ? record["uciPath"] : "",
  );
}

export async function storedTrainingMoves(page: Page): Promise<TrainingMoveReview[]> {
  return readObjectStore(page, "training-move-schedules", (record) => record as TrainingMoveReview);
}

async function readObjectStore<T>(
  page: Page,
  storeName: string,
  mapRecord: (record: unknown) => T,
): Promise<T[]> {
  return await page
    .evaluate(
      async ({ storeName }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const openRequest = indexedDB.open("en-passant-local-v1");
          openRequest.onerror = () => reject(openRequest.error);
          openRequest.onsuccess = () => resolve(openRequest.result);
        });

        return await new Promise<unknown[]>((resolve, reject) => {
          const transaction = db.transaction([storeName], "readonly");
          const request = transaction.objectStore(storeName).getAll();
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => db.close();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as unknown[]);
        });
      },
      { storeName },
    )
    .then((records) => records.map(mapRecord));
}

export async function storedDatabaseSchema(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("en-passant-local-v1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = [...db.objectStoreNames];
    const tx = db.transaction(stores, "readonly");
    const schema = {
      version: db.version,
      indexes: Object.fromEntries(
        stores.map((name) => [name, [...tx.objectStore(name).indexNames]]),
      ),
    };
    db.close();
    return schema;
  });
}
