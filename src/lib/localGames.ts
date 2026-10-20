import { moveChildren, type MoveOccurrence } from "./moveIndex";
import { normalizePgn } from "./app-state/pgnTree";
import { parsePgnTags } from "./pgn-parser";
import type {
  GameColor,
  GameSort,
  StoredGame,
  PositionMoves,
  PositionMoveStat,
  TrainingMistakeLink,
} from "./gameContracts";
import type { StoredChapter, StoredRepertoire } from "../storage/contracts";

export type GameLibrary = {
  repertoires: StoredRepertoire[];
  chapters: StoredChapter[];
  repertoireMoves: Map<string, ReturnType<typeof moveChildren>>;
};

export function groupMovesBySource(moves: MoveOccurrence[]): Map<string, MoveOccurrence[]> {
  const grouped = new Map<string, MoveOccurrence[]>();
  for (const move of moves) {
    const group = grouped.get(move.sourceId) ?? [];
    group.push(move);
    grouped.set(move.sourceId, group);
  }
  for (const group of grouped.values()) group.sort((a, b) => a.ply - b.ply || a.moveId - b.moveId);
  return grouped;
}

export function repertoireMoveTrees(moves: MoveOccurrence[]): GameLibrary["repertoireMoves"] {
  return new Map([...groupMovesBySource(moves)].map(([id, group]) => [id, moveChildren(group)]));
}
// Split only at tag sections following movetext, so PGNs need not contain an Event tag.
export function parseGameImport(
  text: string,
  player: string,
  fallback: GameColor,
  id: () => string,
): StoredGame[] {
  const chunks = text
    .trim()
    .split(/\n\s*\n(?=\[\w+\s+")/)
    .reduce<string[]>((all, part) => {
      const last = all[all.length - 1];
      if (
        last !== undefined &&
        !/\n\s*\d+\./.test(last) &&
        /^\s*\[/.test(last) &&
        /^\s*\[/.test(part)
      )
        all[all.length - 1] = `${last}\n${part}`;
      else all.push(part);
      return all;
    }, []);
  return chunks
    .filter((c) => c.trim() !== "")
    .map((pgn) => {
      // Preserve the editor's import validation, including annotated variations.
      // Only the persisted game index is restricted to the played main line.
      if (normalizePgn(pgn).rootMoveIds.length === 0)
        throw new Error("No legal moves found in the PGN.");
      const tags = parsePgnTags(pgn);
      const whiteName = tags["White"] ?? "White",
        blackName = tags["Black"] ?? "Black";
      const name = player.trim().toLowerCase();
      if (name !== "" && ![whiteName, blackName].some((n) => n.toLowerCase() === name))
        throw new Error(`Player ${player} is not in ${whiteName} – ${blackName}.`);
      const userColor =
        name === "" ? fallback : whiteName.toLowerCase() === name ? "white" : "black";
      const rating = (value: string | undefined) =>
        value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
      const whiteRating = rating(tags["WhiteElo"]),
        blackRating = rating(tags["BlackElo"]);
      const result = tags["Result"];
      const timeControl = tags["TimeControl"] ?? "-";
      const [seconds, increment] = timeControl.split("+").map(Number);
      const duration = (seconds ?? 0) + 40 * (increment ?? 0);
      const speed =
        duration === 0 || !Number.isFinite(duration)
          ? "unknown"
          : duration < 180
            ? "bullet"
            : duration < 600
              ? "blitz"
              : duration < 1800
                ? "rapid"
                : "classical";
      const date = Date.parse(
        (tags["UTCDate"] ?? tags["Date"] ?? "").replaceAll(".", "-") +
          "T" +
          (tags["UTCTime"] ?? "00:00:00") +
          "Z",
      );
      return {
        id: id(),
        source: "pgn",
        sourceGameId: tags["Site"] ?? "",
        importedAccount: player.trim(),
        userColor,
        whiteName,
        blackName,
        whiteRating,
        blackRating,
        opponentName: userColor === "white" ? blackName : whiteName,
        opponentRating: userColor === "white" ? blackRating : whiteRating,
        userRating: userColor === "white" ? whiteRating : blackRating,
        result: result === "1-0" || result === "0-1" || result === "1/2-1/2" ? result : "*",
        winner: result === "1-0" ? "white" : result === "0-1" ? "black" : null,
        speed,
        perf: speed,
        rated: false,
        timeControl,
        createdAt: Number.isNaN(date) ? Date.now() : date,
        lastMoveAt: null,
        opening:
          tags["Opening"] === undefined ? null : { eco: tags["ECO"] ?? "", name: tags["Opening"] },
        pgn,
        importedAt: new Date().toISOString(),
        latestRepertoireMove: null,
        repertoireMistake: null,
      };
    });
}
export function filterGames(
  games: StoredGame[],
  filters: { color?: string; timeControl?: string; sort?: GameSort } = {},
): StoredGame[] {
  return games
    .filter(
      (g) =>
        (filters.color === undefined || filters.color === "all" || g.userColor === filters.color) &&
        (filters.timeControl === undefined ||
          filters.timeControl === "all" ||
          g.speed === filters.timeControl),
    )
    .sort((a, b) =>
      filters.sort === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt,
    );
}
export function analyzeGame(
  game: StoredGame,
  library: GameLibrary,
  line: readonly MoveOccurrence[],
): StoredGame {
  const result = { ...game, latestRepertoireMove: null, repertoireMistake: null } as StoredGame;
  for (const repertoire of library.repertoires.filter(
    (r) => r.deletedAt == null && r.orientation === game.userColor,
  )) {
    for (const chapter of library.chapters.filter(
      (c) => c.deletedAt == null && c.repertoireId === repertoire.id,
    )) {
      const tree = library.repertoireMoves.get(chapter.pgnId);
      if (tree === undefined) continue;
      let choices = tree.get(null) ?? [];
      for (const step of line) {
        const candidates = choices;
        const matched = candidates.find((m) => m.uci === step.uci);
        const details = {
          ply: step.ply,
          positionKey: step.beforeKey,
          repertoire: { handle: repertoire.handle, name: repertoire.name },
          chapter: { handle: chapter.handle, name: chapter.name },
        };
        if (matched === undefined) {
          const expected = candidates[0];
          const turn = step.beforeKey.split(" ")[1] === "w" ? "white" : "black";
          if (
            expected !== undefined &&
            turn === game.userColor &&
            (result.repertoireMistake === null || step.ply > result.repertoireMistake.ply)
          )
            result.repertoireMistake = {
              ...details,
              playedSan: step.san,
              expectedSan: expected.san,
              uciPath: [...line.slice(0, step.ply - 1).map((m) => m.uci), expected.uci].join(" "),
            };
          break;
        }
        if (result.latestRepertoireMove === null || step.ply > result.latestRepertoireMove.ply)
          result.latestRepertoireMove = { ...details, san: step.san };
        choices = tree.get(matched.moveId) ?? [];
      }
    }
  }
  return result;
}
export function positionMoves(
  games: StoredGame[],
  key: string,
  color: GameColor,
  occurrences: MoveOccurrence[],
): PositionMoves {
  const moves = new Map<string, PositionMoveStat>();
  const recentGames: PositionMoves["recentGames"] = [];
  const byGame = groupMovesBySource(occurrences);
  for (const game of filterGames(games, { color })) {
    if (game.result === "*") continue;
    const step = byGame.get(game.id)?.find((s) => s.beforeKey === key);
    if (step === undefined) continue;
    const stat = moves.get(step.uci) ?? {
      uci: step.uci,
      san: step.san,
      games: 0,
      whiteWins: 0,
      draws: 0,
      blackWins: 0,
      whiteWinRate: 0,
      drawRate: 0,
      blackWinRate: 0,
    };
    stat.games++;
    stat.whiteWins += Number(game.result === "1-0");
    stat.blackWins += Number(game.result === "0-1");
    stat.draws += Number(game.result === "1/2-1/2");
    stat.whiteWinRate = stat.whiteWins / stat.games;
    stat.blackWinRate = stat.blackWins / stat.games;
    stat.drawRate = stat.draws / stat.games;
    moves.set(step.uci, stat);
    recentGames.push({
      id: game.id,
      source: game.source,
      createdAt: game.createdAt,
      white: { name: game.whiteName, rating: game.whiteRating },
      black: { name: game.blackName, rating: game.blackRating },
      result: game.result,
      speed: game.speed,
      timeControl: game.timeControl,
      move: { ply: step.ply, uci: step.uci, san: step.san },
    });
  }
  return {
    positionKey: key,
    playedBy: (key.split(" ")[1] === "w") === (color === "white") ? "user" : "opponent",
    games: recentGames.length,
    moves: [...moves.values()].sort((a, b) => b.games - a.games),
    recentGames: recentGames.slice(0, 20),
  };
}
export function mistakeLinks(games: StoredGame[], library: GameLibrary): TrainingMistakeLink[] {
  return games.flatMap((game) => {
    const mistake = game.repertoireMistake;
    if (mistake === null) return [];
    const rep = library.repertoires.find(
      (r) => r.handle === mistake.repertoire.handle && r.deletedAt == null,
    );
    const chapter = library.chapters.find(
      (c) =>
        c.repertoireId === rep?.id && c.handle === mistake.chapter.handle && c.deletedAt == null,
    );
    return chapter === undefined
      ? []
      : [
          {
            chapterId: chapter.id,
            uciPath: mistake.uciPath,
            game: { id: game.id, createdAt: game.createdAt, opponentName: game.opponentName },
          },
        ];
  });
}
