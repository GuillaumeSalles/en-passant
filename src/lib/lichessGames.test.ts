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
});
