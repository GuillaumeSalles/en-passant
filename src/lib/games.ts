import { localDatabase, updateDatabase } from "@/storage/localDatabase";
import { records, record } from "@/storage";
import type { StoredChapter, StoredPgn, StoredRepertoire } from "@/storage/contracts";
import {
  analyzeGame,
  filterGames,
  parseGameImport,
  positionMoves,
  mistakeLinks,
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
export type * from "./gameContracts";
async function library() {
  const snapshot = await localDatabase().read();
  return {
    games: records<StoredGame>(snapshot, "games"),
    repertoires: records<StoredRepertoire>(snapshot, "repertoires"),
    chapters: records<StoredChapter>(snapshot, "chapters"),
    pgns: records<StoredPgn>(snapshot, "pgns"),
  };
}
export async function importGames(pgn: string, player: string, color: GameColor): Promise<number> {
  const games = parseGameImport(pgn, player, color, () => crypto.randomUUID());
  let count = 0;
  await updateDatabase((s) => {
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
  });
  return count;
}
export async function loadGames(
  filters: { timeControl?: string; color?: GameColor; sort?: GameSort } = {},
): Promise<GamesResult> {
  try {
    const data = await library();
    return {
      ok: true,
      games: filterGames(data.games, filters).map((g) => analyzeGame(g, data)),
      total: data.games.length,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadGame(id: string): Promise<GameResult> {
  try {
    const data = await library();
    const game = data.games.find((g) => g.id === id);
    return game === undefined
      ? { ok: false, reason: "not-found" }
      : { ok: true, game: analyzeGame(game, data) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadPositionMoves(
  key: string,
  color: GameColor,
): Promise<PositionMovesResult> {
  try {
    return { ok: true, data: positionMoves((await library()).games, key, color) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
export async function loadTrainingMistakeLinks(): Promise<TrainingMistakeLinksResult> {
  try {
    const data = await library();
    return { ok: true, links: mistakeLinks(data.games, data) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
