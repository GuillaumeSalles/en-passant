export type GameColor = "white" | "black";
export type GameSort = "asc" | "desc";

export type LatestRepertoireMove = {
  ply: number;
  positionKey: string;
  san: string;
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

type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;
type GamesResponse = { games: StoredGame[]; total: number };
type GameResponse = { game: StoredGame };
type ErrorResponse = { error?: string };

export type GameImportState = {
  id: string;
  source: "lichess";
  account: string;
  kind: "backfill" | "poll";
  status: "queued" | "running" | "completed" | "failed";
  processedGames: number;
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

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string | null> {
  const { error } = await readJson<ErrorResponse>(response).catch((): ErrorResponse => ({}));
  return error ?? null;
}

function errorResult(response: Response, error: string | null): GamesResult {
  if (response.status === 401) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status === 404 && error === "lichess_user_not_found")
    return { ok: false, reason: "not-found" };
  return { ok: false, reason: "unavailable" };
}

export async function loadGames(
  filters: {
    timeControl?: string;
    color?: GameColor;
    sort?: GameSort;
  } = {},
  options: { fetcher?: Fetcher } = {},
): Promise<GamesResult> {
  const params = new URLSearchParams();
  if (filters.timeControl !== undefined) {
    params.set("timeControl", filters.timeControl);
  }
  if (filters.color !== undefined) {
    params.set("color", filters.color);
  }
  if (filters.sort !== undefined) {
    params.set("sort", filters.sort);
  }

  const path = `/api/games${params.size === 0 ? "" : `?${params}`}`;
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(path, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return errorResult(response, await readError(response));
  }

  const { games, total } = await readJson<GamesResponse>(response);
  return { ok: true, games, total };
}

export async function loadGame(
  gameId: string,
  options: { fetcher?: Fetcher } = {},
): Promise<GameResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`/api/games/${encodeURIComponent(gameId)}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 401) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status === 404) {
    return { ok: false, reason: "not-found" };
  }
  if (!response.ok) {
    return { ok: false, reason: "unavailable" };
  }

  const { game } = await readJson<GameResponse>(response);
  return { ok: true, game };
}

export async function loadPositionMoves(
  currentPositionKey: string,
  color: GameColor,
  options: { fetcher?: Fetcher } = {},
): Promise<PositionMovesResult> {
  const fetcher = options.fetcher ?? fetch;
  const params = new URLSearchParams({ positionKey: currentPositionKey, color });
  let response: Response;
  try {
    response = await fetcher(`/api/games/position-moves?${params}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401) return { ok: false, reason: "unauthorized" };
  if (!response.ok) return { ok: false, reason: "unavailable" };

  const data = await readJson<PositionMoves>(response);
  return { ok: true, data };
}

function gameImportErrorResult(response: Response): GameImportResult {
  return {
    ok: false,
    reason: response.status === 401 ? "unauthorized" : "unavailable",
  };
}

export async function startLichessImport(
  handle: string,
  options: { fetcher?: Fetcher } = {},
): Promise<GameImportResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher("/api/game-imports/lichess", {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ handle }),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) return gameImportErrorResult(response);
  return readJson<{ import: GameImportState }>(response).then((body) => ({
    ok: true,
    import: body.import,
  }));
}

export async function loadLichessImport(
  options: { fetcher?: Fetcher } = {},
): Promise<GameImportResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher("/api/game-imports/lichess", {
      credentials: "include",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!response.ok) return gameImportErrorResult(response);
  return readJson<{ import: GameImportState | null }>(response).then((body) => ({
    ok: true,
    import: body.import,
  }));
}
