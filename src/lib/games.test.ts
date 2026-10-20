import { describe, expect, test } from "vitest";
import { parseGameImport, positionMoves, filterGames, analyzeGame } from "./localGames";
import { positionKey, createChessPosition } from "./chess";
const pgn = '[White "Alice"]\n[Black "Bob"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 *';
describe("local games", () => {
  test("imports PGNs with player perspective and computes position statistics", () => {
    const games = parseGameImport(pgn, "Alice", "black", () => "one");
    expect(games[0]?.userColor).toBe("white");
    expect(games[0]?.opponentName).toBe("Bob");
    const stats = positionMoves(games, positionKey(createChessPosition()), "white");
    expect(stats.games).toBe(1);
    expect(stats.moves[0]).toMatchObject({ san: "e4", whiteWins: 1, whiteWinRate: 1 });
    expect(filterGames(games, { color: "black" })).toEqual([]);
  });
  test("imports multiple games and rejects invalid moves or a mismatched player", () => {
    expect(parseGameImport(`${pgn}\n\n${pgn}`, "", "white", () => "id")).toHaveLength(2);
    expect(() => parseGameImport(pgn, "Nobody", "white", () => "id")).toThrow("not in");
    expect(() => parseGameImport("1. e5 *", "", "white", () => "id")).toThrow();
  });
  test("finds repertoire coverage without network access", () => {
    const game = parseGameImport(pgn, "Alice", "white", () => "id")[0];
    if (game === undefined) throw Error("game");
    const metadata = { updatedAt: "today", deletedAt: null };
    const result = analyzeGame(game, {
      repertoires: [{ id: "r", handle: "white", name: "White", orientation: "white", ...metadata }],
      chapters: [
        { id: "c", repertoireId: "r", pgnId: "p", handle: "king", name: "King", ...metadata },
      ],
      pgns: [{ id: "p", pgn: "1. e4 e5 2. Bc4 *", byteSize: 20, ...metadata }],
    });
    expect(result.latestRepertoireMove?.san).toBe("e5");
    expect(result.repertoireMistake).toMatchObject({ playedSan: "Nf3", expectedSan: "Bc4" });
  });
});
