import { describe, expect, test } from "vitest";
import {
  loadGame,
  loadGames,
  loadLichessImport,
  loadPositionMoves,
  startLichessImport,
} from "./games";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("trusted game API contracts", () => {
  test("returns games without frontend field validation", async () => {
    const games = [{ id: "game-from-backend", addedContractField: true }];
    const result = await loadGames({}, { fetcher: async () => jsonResponse({ games, total: 42 }) });

    expect(result).toEqual({ ok: true, games, total: 42 });
  });

  test("returns a game without frontend field validation", async () => {
    const game = { id: "game-from-backend", addedContractField: true };
    const result = await loadGame("game-from-backend", {
      fetcher: async () => jsonResponse({ game }),
    });

    expect(result).toEqual({ ok: true, game });
  });

  test("does not recheck server-owned position statistics invariants", async () => {
    const data = {
      positionKey: "backend-owned-position-key",
      playedBy: "user",
      games: 2,
      moves: [],
      recentGames: [],
    };
    const result = await loadPositionMoves("position-key", "white", {
      fetcher: async () => jsonResponse(data),
    });

    expect(result).toEqual({ ok: true, data });
  });

  test("starts an asynchronous Lichess import without a game limit", async () => {
    let request: RequestInit | undefined;
    const gameImport = {
      id: "import-id",
      source: "lichess",
      account: "PlayerOne",
      kind: "backfill",
      status: "queued",
      processedGames: 0,
      totalGames: null,
      error: null,
      createdAt: "2026-07-23T00:00:00.000Z",
      startedAt: null,
      updatedAt: "2026-07-23T00:00:00.000Z",
      completedAt: null,
    } as const;
    const result = await startLichessImport("PlayerOne", {
      fetcher: async (_input, init) => {
        request = init;
        return jsonResponse({ import: gameImport }, 202);
      },
    });

    expect(JSON.parse(String(request?.body))).toEqual({ handle: "PlayerOne" });
    expect(result).toEqual({ ok: true, import: gameImport });
  });

  test("loads the current import state", async () => {
    const result = await loadLichessImport({
      fetcher: async () => jsonResponse({ import: null }),
    });

    expect(result).toEqual({ ok: true, import: null });
  });
});
