import { localDatabase, updateDatabase } from "@/storage/localDatabase";
import { records, record } from "@/storage";
import type { StoredChapter, StoredRepertoire } from "@/storage/contracts";
import {
  analyzeGame,
  filterGames,
  parseGameImport,
  positionMoves,
  mistakeLinks,
  groupMovesBySource,
  repertoireMoveTrees,
} from "./localGames";
import type {
  GameColor,
  GameSort,
  StoredGame,
  GamesResult,
  GameResult,
  PositionMovesResult,
  TrainingMistakeLinksResult,
} from "./gameContracts";
import type { MoveOccurrence } from "./moveIndex";
export type * from "./gameContracts";
async function library(gameId?: string) {
  const snapshot = await localDatabase().read([
    gameId === undefined ? { store: "games" } : { store: "games", key: gameId },
    { store: "repertoires" },
    { store: "chapters" },
    { store: "repertoire-moves" },
    gameId === undefined
      ? { store: "game-moves" }
      : { store: "game-moves", index: "by-source", key: gameId },
  ]);
  return {
    games: records<StoredGame>(snapshot, "games"),
    repertoires: records<StoredRepertoire>(snapshot, "repertoires"),
    chapters: records<StoredChapter>(snapshot, "chapters"),
    repertoireMoves: repertoireMoveTrees(records<MoveOccurrence>(snapshot, "repertoire-moves")),
    gameMoves: groupMovesBySource(records<MoveOccurrence>(snapshot, "game-moves")),
  };
}
export async function importGames(pgn: string, player: string, color: GameColor): Promise<number> {
  const games = parseGameImport(pgn, player, color, () => crypto.randomUUID());
  let count = 0;
  await updateDatabase(
    (s) => {
      const existing = new Set(records<StoredGame>(s, "games").map((g) => g.pgn.trim()));
      const added = games.filter((g) => {
        if (existing.has(g.pgn.trim())) return false;
        existing.add(g.pgn.trim());
        return true;
      });
      count = added.length;
      return {
        expectedVersion: s.version,
        put: added.map((g) => record("games", g.id, g)),
        remove: [],
      };
    },
    [{ store: "games" }],
  );
  return count;
}
export async function loadGames(
  filters: { timeControl?: string; color?: GameColor; sort?: GameSort } = {},
): Promise<GamesResult> {
  try {
    const data = await library();
    return {
      ok: true,
      games: filterGames(data.games, filters).map((g) =>
        analyzeGame(g, data, data.gameMoves.get(g.id) ?? []),
      ),
      total: data.games.length,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadGame(id: string): Promise<GameResult> {
  try {
    const data = await library(id);
    const game = data.games.find((g) => g.id === id);
    return game === undefined
      ? { ok: false, reason: "not-found" }
      : { ok: true, game: analyzeGame(game, data, data.gameMoves.get(game.id) ?? []) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadPositionMoves(
  key: string,
  color: GameColor,
): Promise<PositionMovesResult> {
  try {
    // Resolve the matching game ids first, then read only those game documents.
    // Verify revisions so another tab cannot mix two snapshots during an import/delete.
    for (let attempt = 0; attempt < 20; attempt++) {
      const matches = await localDatabase().read([
        { store: "game-moves", index: "by-position", key },
      ]);
      const occurrences = records<MoveOccurrence>(matches, "game-moves");
      const ids = [...new Set(occurrences.map((move) => move.sourceId))];
      const games = await localDatabase().read(ids.map((id) => ({ store: "games", key: id })));
      if (matches.version !== games.version) continue;
      return {
        ok: true,
        data: positionMoves(records<StoredGame>(games, "games"), key, color, occurrences),
      };
    }
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadTrainingMistakeLinks(): Promise<TrainingMistakeLinksResult> {
  try {
    const data = await library();
    return {
      ok: true,
      links: mistakeLinks(
        data.games.map((g) => analyzeGame(g, data, data.gameMoves.get(g.id) ?? [])),
        data,
      ),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
