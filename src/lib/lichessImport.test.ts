import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  DatabaseCommit,
  DatabaseQuery,
  DatabaseRecord,
  DatabaseSnapshot,
} from "@/storage/databaseContract";
import type { LichessImportSettings } from "./lichessImport";

const memory = vi.hoisted(() => ({
  rows: new Map<string, DatabaseRecord>(),
  revision: 0,
  failGames: false,
  conflict: false,
}));
vi.mock("@/storage/localDatabase", () => {
  async function read(queries: readonly DatabaseQuery[] = []): Promise<DatabaseSnapshot> {
    return {
      version: memory.revision,
      records: [...memory.rows.values()].filter((row) =>
        queries.some(
          (query) => query.store === row.store && (query.key === undefined || query.key === row.id),
        ),
      ),
    };
  }
  return {
    localDatabase: () => ({ read }),
    updateDatabase: async (
      edit: (snapshot: DatabaseSnapshot) => DatabaseCommit,
      queries: readonly DatabaseQuery[],
    ) => {
      let change = edit(await read(queries));
      if (memory.conflict) {
        memory.conflict = false;
        memory.revision++;
        change = edit(await read(queries));
      }
      if (memory.failGames && change.put.some((row) => row.store === "games"))
        throw new Error("Disk full");
      for (const row of change.put) memory.rows.set(`${row.store}/${row.id}`, row);
      memory.revision++;
    },
  };
});
const started = 1_700_000_000_000;
function game(index: number, status = "mate") {
  const id = index.toString().padStart(8, "0");
  return {
    id,
    createdAt: started + index * 1000,
    status,
    variant: "standard",
    moves: "e4 e5",
    pgn: `[Site "https://lichess.org/${id}"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0`,
  };
}
function response(games: unknown[]) {
  return new Response(games.map((entry) => JSON.stringify(entry)).join("\n"));
}
function settings(): LichessImportSettings | undefined {
  const row = memory.rows.get("game-imports/lichess");
  return row === undefined ? undefined : (JSON.parse(row.value) as LichessImportSettings);
}
function savedGames() {
  return [...memory.rows.values()].filter((row) => row.store === "games");
}
beforeEach(() => {
  vi.resetModules();
  memory.rows.clear();
  memory.revision = 0;
  memory.failGames = false;
  memory.conflict = false;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("imports an unlimited history in batches and deduplicates repeated IDs", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () => response([...Array.from({ length: 123 }, (_, i) => game(i)), game(122)]),
  );
  vi.stubGlobal("fetch", fetchMock);
  const service = await import("./lichessImport");
  memory.conflict = true;
  await service.syncLichessGames("Alice");
  expect(savedGames()).toHaveLength(123);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "success", imported: 123 });
  expect(settings()).toMatchObject({ username: "alice", automatic: true });
  expect(memory.revision).toBeGreaterThanOrEqual(4);
  fetchMock.mockImplementationOnce(async () => response([]));
  const checkpoint = settings()?.since;
  await service.syncLichessGames("ALICE");
  expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get("since")).toBe(
    String(checkpoint),
  );
  expect(savedGames()).toHaveLength(123);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "success", imported: 0 });
});

test("interrupted history resumes from a durable batch and does not miss equal-date games", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () =>
      new Response(
        `${Array.from({ length: 50 }, (_, i) => JSON.stringify(game(i))).join("\n")}\n{broken`,
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  let service = await import("./lichessImport");
  await service.syncLichessGames("alice");
  expect(service.lichessImportStatus().phase).toBe("error");
  expect(savedGames()).toHaveLength(50);
  expect(settings()?.since).toBe(started + 49_000 - 60_000);
  fetchMock.mockImplementationOnce(async () =>
    response([
      ...Array.from({ length: 51 }, (_, i) => game(i)),
      { ...game(51), createdAt: game(50).createdAt },
    ]),
  );
  vi.resetModules();
  service = await import("./lichessImport");
  await service.initializeLichessImport();
  expect(savedGames()).toHaveLength(52);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "success", imported: 2 });
});

test("does not advance checkpoints or claim success when a game batch fails to save", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response([game(1)])),
  );
  const service = await import("./lichessImport");
  memory.failGames = true;
  await service.syncLichessGames("alice");
  expect(settings()?.since).toBeNull();
  expect(savedGames()).toEqual([]);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "error", imported: 0 });
  expect(service.lichessImportStatus().message).toContain("Disk full");
  memory.failGames = false;
  await service.syncLichessGames("alice");
  expect(savedGames()).toHaveLength(1);
});

test("revisits older ongoing games until they finish", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () => response([game(1, "started"), game(100)]),
  );
  vi.stubGlobal("fetch", fetchMock);
  const service = await import("./lichessImport");
  await service.syncLichessGames("alice");
  expect(savedGames()).toHaveLength(1);
  expect(settings()?.since).toBe(started + 1000 - 60_000);
  fetchMock.mockImplementationOnce(async () => response([game(1), game(100)]));
  await service.syncLichessGames("alice");
  expect(savedGames()).toHaveLength(2);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "success", imported: 1 });
  expect(settings()?.since).toBeGreaterThan(started + 100_000);
});

test("startup needs an explicitly saved username, respects pause, and runs once", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () => response([]),
  );
  vi.stubGlobal("fetch", fetchMock);
  let service = await import("./lichessImport");
  await service.initializeLichessImport();
  expect(fetchMock).not.toHaveBeenCalled();
  await service.syncLichessGames("alice");
  await service.setAutomaticLichessImport(false);
  vi.resetModules();
  service = await import("./lichessImport");
  await service.initializeLichessImport();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await service.setAutomaticLichessImport(true);
  vi.resetModules();
  service = await import("./lichessImport");
  await Promise.all([service.initializeLichessImport(), service.initializeLichessImport()]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("deduplicates PGN imports by Lichess Site while preserving the original document", async () => {
  const { parseGameImport } = await import("./localGames");
  const original = parseGameImport(game(1).pgn, "alice", "white", () => "original")[0];
  memory.rows.set("games/original", {
    store: "games",
    id: "original",
    value: JSON.stringify(original),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response([game(1)])),
  );
  const service = await import("./lichessImport");
  await service.syncLichessGames("alice");
  expect(savedGames()).toHaveLength(1);
  expect(savedGames()[0]?.value).toBe(JSON.stringify(original));
  expect(service.lichessImportStatus().imported).toBe(0);
});

test("reports network and rate limit failures without clearing games or moving the cursor", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () => response([game(1)]),
  );
  vi.stubGlobal("fetch", fetchMock);
  const service = await import("./lichessImport");
  await service.syncLichessGames("alice");
  const checkpoint = settings()?.since;
  fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await service.syncLichessGames("alice");
  expect(service.lichessImportStatus().phase).toBe("error");
  expect(settings()?.since).toBe(checkpoint);
  fetchMock.mockImplementationOnce(async () => new Response(null, { status: 429 }));
  await service.syncLichessGames("alice");
  expect(service.lichessImportStatus().message).toContain("rate limiting");
  expect(settings()?.since).toBe(checkpoint);
  expect(savedGames()).toHaveLength(1);
});

test("stopping an export cancels its stream, keeps durable batches and prevents overlapping runs", async () => {
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async (_url, options) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(stream) {
            stream.enqueue(
              new TextEncoder().encode(
                `${Array.from({ length: 50 }, (_, index) => JSON.stringify(game(index))).join("\n")}\n`,
              ),
            );
            options?.signal?.addEventListener(
              "abort",
              () => stream.error(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const service = await import("./lichessImport");
  const first = service.syncLichessGames("alice");
  const second = service.syncLichessGames("alice");
  expect(first).toBe(second);
  await vi.waitFor(() => expect(service.lichessImportStatus().imported).toBe(50));
  service.cancelLichessImport();
  await first;
  expect(savedGames()).toHaveLength(50);
  expect(service.lichessImportStatus()).toMatchObject({ phase: "idle", imported: 50 });
  expect(service.lichessImportStatus().message).toContain("stopped");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("another tab's import lock prevents a duplicate export", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", {
    locks: {
      request: async (_name: string, _options: unknown, action: (lock: null) => Promise<void>) =>
        action(null),
    },
  });
  const service = await import("./lichessImport");
  await service.syncLichessGames("alice");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(service.lichessImportStatus().message).toContain("another tab");
});
