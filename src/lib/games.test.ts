import { describe, expect, test } from "vitest";
import { parseGameResponse, parseGamesResponse, parsePositionMovesResponse } from "./games";

const game = {
  id: "lichess-abc123",
  source: "lichess",
  sourceGameId: "abc123",
  importedAccount: "PlayerOne",
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

describe("parseGamesResponse", () => {
  test("accepts stored game metadata", () => {
    expect(parseGamesResponse({ games: [game] })).toEqual({ games: [game] }.games);
  });

  test("rejects malformed game metadata", () => {
    expect(parseGamesResponse({ games: [{ ...game, userColor: "green" }] })).toBeNull();
  });

  test("accepts a single stored game response", () => {
    expect(parseGameResponse({ game })).toEqual(game);
  });

  test("accepts an older response without repertoire coverage", () => {
    const { latestRepertoireMove: _latestRepertoireMove, ...olderGame } = game;
    expect(parseGameResponse({ game: olderGame })).toEqual({
      ...olderGame,
      latestRepertoireMove: null,
    });
  });

  test("rejects malformed repertoire coverage", () => {
    expect(
      parseGameResponse({
        game: { ...game, latestRepertoireMove: { ...game.latestRepertoireMove, ply: 0 } },
      }),
    ).toBeNull();
  });
});

describe("parsePositionMovesResponse", () => {
  test("accepts frequency-sorted white-win, draw, and black-win statistics", () => {
    const positionKey = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
    expect(
      parsePositionMovesResponse({
        positionKey,
        playedBy: "user",
        games: 8,
        moves: [
          {
            uci: "e2e4",
            san: "e4",
            games: 8,
            whiteWins: 4,
            draws: 2,
            blackWins: 2,
            whiteWinRate: 0.5,
            drawRate: 0.25,
            blackWinRate: 0.25,
          },
        ],
      }),
    ).toEqual({
      positionKey,
      playedBy: "user",
      games: 8,
      moves: [
        {
          uci: "e2e4",
          san: "e4",
          games: 8,
          whiteWins: 4,
          draws: 2,
          blackWins: 2,
          whiteWinRate: 0.5,
          drawRate: 0.25,
          blackWinRate: 0.25,
        },
      ],
    });
  });

  test("rejects inconsistent totals", () => {
    expect(
      parsePositionMovesResponse({
        positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
        playedBy: "user",
        games: 2,
        moves: [],
      }),
    ).toBeNull();
  });

  test("rejects a response without the player whose moves are listed", () => {
    expect(
      parsePositionMovesResponse({
        positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
        games: 0,
        moves: [],
      }),
    ).toBeNull();
  });
});
