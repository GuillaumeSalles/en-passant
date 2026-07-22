import { expect, type Page } from "@playwright/test";

export const STORAGE_ORIGIN_PATH = "/stockfish-18-lite-single.js";

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

type SyncChanges = {
  repertoires: unknown[];
  chapters: unknown[];
  pgns: unknown[];
};

export function acceptedSyncChanges(body: unknown): SyncChanges {
  const changes = isRecord(body) && isRecord(body["changes"]) ? body["changes"] : emptyChanges();
  return {
    repertoires: Array.isArray(changes["repertoires"]) ? changes["repertoires"] : [],
    chapters: Array.isArray(changes["chapters"]) ? changes["chapters"] : [],
    pgns: [],
  };
}

export function acceptedPgnAcknowledgment(body: unknown): unknown {
  const changes = isRecord(body) && isRecord(body["changes"]) ? body["changes"] : null;
  const mutation = changes !== null && Array.isArray(changes["pgns"]) ? changes["pgns"][0] : null;
  if (!isRecord(mutation)) return null;
  return {
    id: mutation["id"],
    revision: "server-ack-revision",
    byteSize: 0,
    updatedAt: "2026-06-26T00:00:01.000Z",
    deletedAt: mutation["deletedAt"] ?? null,
  };
}

export function pgnSnapshot(id: string, pgn: string, updatedAt: string) {
  return {
    id,
    revision: `revision-${id}`,
    byteSize: new TextEncoder().encode(pgn).byteLength,
    updatedAt,
    deletedAt: null,
  };
}

export type MockAuthSession = {
  pgnUploads: { id: string; pgn: string }[];
  signIn: () => void;
  signOut: () => void;
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

export async function mockSignedOutAuth(page: Page): Promise<void> {
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: "null",
    });
  });
  await page.route("**/api/sync", async (route) => {
    await route.fulfill({
      status: 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "unauthorized" }),
    });
  });
  await page.route("**/api/games/position-moves?*", async (route) => {
    await route.fulfill({
      status: 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "unauthorized" }),
    });
  });
}

export async function mockSignedInUser(
  page: Page,
  onSync?: () => void,
  image: string | null = null,
  syncResponseForRequest?: (body: unknown) => unknown,
  remotePgnBodies: Record<string, string> = {},
): Promise<MockAuthSession> {
  let isSignedIn = false;
  const pgnBodies = new Map(Object.entries(remotePgnBodies));
  const pgnUploads: { id: string; pgn: string }[] = [];
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        isSignedIn
          ? {
              user: {
                id: "player-user",
                email: "player@example.com",
                emailVerified: true,
                name: "Player One",
                image,
                createdAt: "2026-06-26T00:00:00.000Z",
                updatedAt: "2026-06-26T00:00:00.000Z",
              },
              session: {
                id: "player-session",
                token: "player-session-token",
                userId: "player-user",
                expiresAt: "2026-07-26T00:00:00.000Z",
                createdAt: "2026-06-26T00:00:00.000Z",
                updatedAt: "2026-06-26T00:00:00.000Z",
              },
            }
          : null,
      ),
    });
  });
  await page.route("**/api/sync", async (route) => {
    onSync?.();
    const body = route.request().postDataJSON() as unknown;
    const responseBody = syncResponseForRequest?.(body) ?? {
      cursor: "2026-06-26T00:00:01.000Z",
      changes: acceptedSyncChanges(body),
      acknowledgedPgn: acceptedPgnAcknowledgment(body),
    };
    await route.fulfill({
      status: isSignedIn ? 200 : 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isSignedIn ? responseBody : { error: "unauthorized" }),
    });
  });
  await page.route("**/api/pgns/*", async (route) => {
    const pgnId = decodeURIComponent(
      new URL(route.request().url()).pathname.split("/").at(-1) ?? "",
    );
    if (!isSignedIn) {
      await route.fulfill({
        status: 401,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "unauthorized" }),
      });
      return;
    }

    if (route.request().method() === "PUT") {
      const pgn = route.request().postData() ?? "";
      pgnBodies.set(pgnId, pgn);
      pgnUploads.push({ id: pgnId, pgn });
      await route.fulfill({
        status: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: pgnId,
          revision: `revision-${pgnId}`,
          byteSize: new TextEncoder().encode(pgn).byteLength,
          updatedAt: "2026-06-26T00:00:01.000Z",
          deletedAt: null,
        }),
      });
      return;
    }

    const pgn = pgnBodies.get(pgnId);
    if (pgn === undefined) {
      await route.fulfill({
        status: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "pgn_not_found" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/x-chess-pgn; charset=utf-8",
        "x-pgn-revision": `revision-${pgnId}`,
      },
      body: pgn,
    });
  });
  await page.route("**/api/games/position-moves?*", async (route) => {
    const requestedPositionKey = new URL(route.request().url()).searchParams.get("positionKey");
    await route.fulfill({
      status: isSignedIn ? 200 : 401,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        isSignedIn
          ? { positionKey: requestedPositionKey, playedBy: "user", games: 0, moves: [] }
          : { error: "unauthorized" },
      ),
    });
  });
  return {
    pgnUploads,
    signIn() {
      isSignedIn = true;
    },
    signOut() {
      isSignedIn = false;
    },
  };
}

export function emptyChanges(): SyncChanges {
  return { repertoires: [], chapters: [], pgns: [] };
}

export async function gotoStorageOrigin(page: Page): Promise<void> {
  await page.goto(STORAGE_ORIGIN_PATH);
}

export async function clearLocalStorageAndIndexedDb(page: Page): Promise<void> {
  await gotoStorageOrigin(page);
  await page.evaluate(async () => {
    const deleteIndexedDb = () =>
      new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase("en-passant");
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
  };
  await gotoStorageOrigin(page);
  await page.evaluate(
    async ({ records }) => {
      const deleteIndexedDb = () =>
        new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase("en-passant");
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => reject(new Error("Database deletion blocked"));
          deleteRequest.onsuccess = () => resolve();
        });
      const openSeedDatabase = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const openRequest = indexedDB.open("en-passant", 4);
          openRequest.onerror = () => reject(openRequest.error);
          openRequest.onupgradeneeded = () => {
            const db = openRequest.result;
            db.createObjectStore("repertoires");
            db.createObjectStore("chapters");
            db.createObjectStore("pgns");
            db.createObjectStore("training-line-schedules");
            db.createObjectStore("metadata");
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
          ["repertoires", "chapters", "pgns", "training-line-schedules"],
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
  const values = await readObjectStore(page, "pgns", (record) =>
    isRecord(record) && typeof record["pgn"] === "string" ? record["pgn"] : null,
  );
  const pgn = values.find((value) => value !== null) ?? null;
  expect(pgn).not.toBeNull();
  return pgn;
}

export async function storedTrainingLineUciPaths(page: Page): Promise<string[]> {
  return await readObjectStore(page, "training-line-schedules", (record) =>
    isRecord(record) && typeof record["uciPath"] === "string" ? record["uciPath"] : "",
  );
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
          const openRequest = indexedDB.open("en-passant");
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
