export type GameColor = "white" | "black";
export type GameSort = "asc" | "desc";

export type LatestRepertoireMove = {
  ply: number;
  positionKey: string;
  san: string;
  repertoire: { handle: string; name: string };
  chapter: { handle: string; name: string };
};

export type RepertoireMistake = {
  ply: number;
  positionKey: string;
  playedSan: string;
  expectedSan: string;
  uciPath: string;
  repertoire: { handle: string; name: string };
  chapter: { handle: string; name: string };
};

export type StoredGame = {
  id: string;
  source: string;
  sourceGameId: string;
  importedAccount: string;
  userColor: GameColor;
  opponentName: string;
  opponentRating: number | null;
  userRating: number | null;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  winner: GameColor | null;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  speed: string;
  perf: string;
  rated: boolean;
  timeControl: string;
  createdAt: number;
  lastMoveAt: number | null;
  opening: {
    eco: string;
    name: string;
  } | null;
  pgn: string;
  importedAt: string;
  latestRepertoireMove: LatestRepertoireMove | null;
  repertoireMistake: RepertoireMistake | null;
};

export type GamesResult =
  | { ok: true; games: StoredGame[]; total: number }
  | { ok: false; reason: "unauthorized" | "not-found" | "unavailable" };

export type GameResult =
  | { ok: true; game: StoredGame }
  | {
      ok: false;
      reason: "unauthorized" | "not-found" | "unavailable";
    };

export type PositionMoveStat = {
  uci: string;
  san: string;
  games: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
  whiteWinRate: number;
  drawRate: number;
  blackWinRate: number;
};

export type RecentPositionGame = {
  id: string;
  source: string;
  createdAt: number;
  white: { name: string; rating: number | null };
  black: { name: string; rating: number | null };
  result: "1-0" | "0-1" | "1/2-1/2";
  speed: string;
  timeControl: string;
  move: { ply: number; uci: string; san: string };
};

export type PositionMoves = {
  positionKey: string;
  playedBy: "user" | "opponent";
  games: number;
  moves: PositionMoveStat[];
  recentGames: RecentPositionGame[];
};

export type PositionMovesResult =
  | { ok: true; data: PositionMoves }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export type TrainingMistakeLink = {
  chapterId: string;
  uciPath: string;
  game: {
    id: string;
    createdAt: number;
    opponentName: string;
  };
};

export type TrainingMistakeLinksResult =
  | { ok: true; links: TrainingMistakeLink[] }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export type GameImportState = {
  id: string;
  source: "lichess";
  account: string;
  kind: "backfill" | "poll";
  status: "queued" | "running" | "completed" | "failed";
  processedGames: number;
  totalGames: number | null;
  error:
    | "lichess-user-not-found"
    | "lichess-unavailable"
    | "invalid-lichess-response"
    | "queue-delivery-failed"
    | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
};

export type GameImportResult =
  | { ok: true; import: GameImportState | null }
  | { ok: false; reason: "unauthorized" | "unavailable" };
