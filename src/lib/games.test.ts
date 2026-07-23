import { describe, expect, test } from "vitest";
import { loadGame, loadGames, loadPositionMoves } from "./games";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("trusted game API contracts", () => {
  test("returns games without frontend field validation", async () => {
    const games = [{ id: "game-from-backend", addedContractField: true }];
    const result = await loadGames({}, { fetcher: async () => jsonResponse({ games }) });

    expect(result).toEqual({ ok: true, games });
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
});
