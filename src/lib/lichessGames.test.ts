import { afterEach, expect, test, vi } from "vitest";
import {
  lichessGameId,
  normalizeLichessUsername,
  parseLichessGame,
  streamLichessGames,
} from "./lichessGames";

const pgn =
  '[Site "https://lichess.org/abcd1234"]\n[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
const game = {
  id: "abcd1234",
  createdAt: 1_700_000_000_000,
  lastMoveAt: 1_700_000_060_000,
  status: "mate",
  variant: "standard",
  rated: true,
  speed: "correspondence",
  perf: "correspondence",
  pgn,
  moves: "e4 e5",
};
afterEach(() => vi.unstubAllGlobals());

test("normalizes usernames and preserves Lichess identity, perspective and metadata", () => {
  expect(normalizeLichessUsername(" Alice ")).toBe("alice");
  expect(() => normalizeLichessUsername("https://lichess.org/@/Alice")).toThrow("username");
  expect(parseLichessGame(game, "ALICE").game).toMatchObject({
    id: "lichess:abcd1234",
    source: "lichess",
    sourceGameId: "abcd1234",
    userColor: "white",
    rated: true,
    speed: "correspondence",
    createdAt: game.createdAt,
    lastMoveAt: game.lastMoveAt,
  });
  expect(parseLichessGame(game, "bob").game?.userColor).toBe("black");
  expect(() => parseLichessGame(game, "nobody")).toThrow("not in");
  expect(lichessGameId({ source: "pgn", sourceGameId: "https://lichess.org/abcd1234/black" })).toBe(
    "abcd1234",
  );
  expect(lichessGameId({ source: "pgn", sourceGameId: "https://example.org/abcd1234" })).toBeNull();
});

test("tracks unfinished games, skips unsupported and empty games, and rejects malformed responses", () => {
  expect(parseLichessGame({ ...game, status: "started" }, "alice")).toEqual({
    createdAt: game.createdAt,
    ongoing: true,
    game: null,
  });
  expect(parseLichessGame({ ...game, variant: "chess960" }, "alice").game).toBeNull();
  expect(parseLichessGame({ ...game, moves: "" }, "alice").game).toBeNull();
  expect(() => parseLichessGame({ ...game, pgn: undefined }, "alice")).toThrow("moves");
  expect(() => parseLichessGame({ ...game, createdAt: NaN }, "alice")).toThrow("invalid game");
  expect(() => parseLichessGame({ ...game, pgn: pgn.replace("e4", "e5") }, "alice")).toThrow();
});

test("streams every game across UTF-8/chunk boundaries, heartbeats and an unterminated last line", async () => {
  const bytes = new TextEncoder().encode(
    `\n${JSON.stringify(game)}\r\n\n${JSON.stringify({ ...game, id: "efgh5678", pgn: pgn.replace("Bob", "Bób") })}`,
  );
  const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (let index = 0; index < bytes.length; index += 3)
              controller.enqueue(bytes.slice(index, index + 3));
            controller.close();
          },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const imported = [];
  for await (const entry of streamLichessGames(
    "Alice",
    game.createdAt,
    Date.now(),
    new AbortController().signal,
  ))
    imported.push(entry);
  expect(imported).toHaveLength(2);
  expect(imported[1]?.game?.blackName).toBe("Bób");
  const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
  expect(url.searchParams.has("max")).toBe(false);
  expect(url.searchParams.get("since")).toBe(String(game.createdAt));
  expect(url.searchParams.get("ongoing")).toBe("true");
  expect(url.searchParams.get("sort")).toBe("dateAsc");
});

test.each([404, 429, 503])("reports HTTP %i without a retry loop", async (status) => {
  const fetchMock = vi.fn(async () => new Response(null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    (async () => {
      for await (const _game of streamLichessGames(
        "alice",
        null,
        Date.now(),
        new AbortController().signal,
      )) {
        /* Consume the export. */
      }
    })(),
  ).rejects.toThrow(status === 404 ? "not found" : status === 429 ? "rate limiting" : "503");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
