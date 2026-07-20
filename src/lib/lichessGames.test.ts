import { describe, expect, test } from "vitest";
import { parseLichessGameResponse, parseLichessGamesResponse } from "./lichessGames";

const game = {
  id: "abc123",
  importedHandle: "PlayerOne",
  userColor: "white",
  opponentName: "Opponent",
  opponentRating: 1810,
  userRating: 1800,
  whiteName: "PlayerOne",
  blackName: "Opponent",
  whiteRating: 1800,
  blackRating: 1810,
  winner: "white",
  result: "1-0",
  speed: "blitz",
  perf: "blitz",
  rated: true,
  timeControl: "180+2",
  createdAt: 1_765_000_000_000,
  lastMoveAt: 1_765_000_120_000,
  opening: { eco: "C20", name: "King's Pawn Game" },
  pgn: "1. e4 e5 1-0",
  importedAt: "2026-07-13T00:00:00.000Z",
  latestRepertoireMove: {
    ply: 3,
    positionKey: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
    san: "Nf3",
    repertoire: { handle: "white", name: "White" },
    chapter: { handle: "open-games", name: "Open Games" },
  },
};

describe("parseLichessGamesResponse", () => {
  test("accepts stored game metadata", () => {
    expect(parseLichessGamesResponse({ games: [game] })).toEqual({ games: [game] }.games);
  });

  test("rejects malformed game metadata", () => {
    expect(parseLichessGamesResponse({ games: [{ ...game, userColor: "green" }] })).toBeNull();
  });

  test("accepts a single stored game response", () => {
    expect(parseLichessGameResponse({ game })).toEqual(game);
  });

  test("accepts an older response without repertoire coverage", () => {
    const { latestRepertoireMove: _latestRepertoireMove, ...olderGame } = game;
    expect(parseLichessGameResponse({ game: olderGame })).toEqual({
      ...olderGame,
      latestRepertoireMove: null,
    });
  });

  test("rejects malformed repertoire coverage", () => {
    expect(
      parseLichessGameResponse({
        game: { ...game, latestRepertoireMove: { ...game.latestRepertoireMove, ply: 0 } },
      }),
    ).toBeNull();
  });
});
