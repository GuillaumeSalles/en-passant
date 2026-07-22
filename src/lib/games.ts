import { createChessPosition, positionKey } from "./chess";

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
  | { ok: true; games: StoredGame[]; imported?: number }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "invalid-response"
        | "not-found"
        | "unavailable"
        | "lichess-auth-required";
    };

export type GameResult =
  | { ok: true; game: StoredGame }
  | {
      ok: false;
      reason: "unauthorized" | "invalid-response" | "not-found" | "unavailable";
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

export type PositionMoves = {
  positionKey: string;
  playedBy: "user" | "opponent";
  games: number;
  moves: PositionMoveStat[];
};

export type PositionMovesResult =
  | { ok: true; data: PositionMoves }
  | { ok: false; reason: "unauthorized" | "invalid-response" | "unavailable" };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value >= 0;
}

function isRate(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 1;
}

function parseColor(value: unknown): GameColor | null {
  return value === "white" || value === "black" ? value : null;
}

function parseOpening(value: unknown): StoredGame["opening"] {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }

  const eco = value["eco"];
  const name = value["name"];
  return typeof eco === "string" && typeof name === "string" ? { eco, name } : null;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return isNumber(value) ? value : undefined;
}

function nullableColor(value: unknown): GameColor | null | undefined {
  if (value === null) return null;
  return parseColor(value) ?? undefined;
}

function parseNamedHandle(value: unknown): { handle: string; name: string } | null {
  if (!isRecord(value)) return null;
  const handle = value["handle"];
  const name = value["name"];
  return typeof handle === "string" && typeof name === "string" ? { handle, name } : null;
}

function parseLatestRepertoireMove(value: unknown): LatestRepertoireMove | null | undefined {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return undefined;

  const ply = value["ply"];
  const matchedPositionKey = value["positionKey"];
  const san = value["san"];
  const repertoire = parseNamedHandle(value["repertoire"]);
  const chapter = parseNamedHandle(value["chapter"]);
  if (
    !isNumber(ply) ||
    !Number.isInteger(ply) ||
    ply < 1 ||
    typeof matchedPositionKey !== "string" ||
    !isPositionKey(matchedPositionKey) ||
    typeof san !== "string" ||
    repertoire === null ||
    chapter === null
  ) {
    return undefined;
  }

  return { ply, positionKey: matchedPositionKey, san, repertoire, chapter };
}

function isPositionKey(value: string): boolean {
  try {
    return positionKey(createChessPosition(`${value} 0 1`)) === value;
  } catch {
    return false;
  }
}

function parseGame(value: unknown): StoredGame | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value["id"];
  const source = value["source"];
  const sourceGameId = value["sourceGameId"];
  const importedAccount = value["importedAccount"];
  const userColor = parseColor(value["userColor"]);
  const opponentName = value["opponentName"];
  const opponentRating = nullableNumber(value["opponentRating"]);
  const userRating = nullableNumber(value["userRating"]);
  const whiteName = value["whiteName"];
  const blackName = value["blackName"];
  const whiteRating = nullableNumber(value["whiteRating"]);
  const blackRating = nullableNumber(value["blackRating"]);
  const winner = nullableColor(value["winner"]);
  const result = value["result"];
  const speed = value["speed"];
  const perf = value["perf"];
  const rated = value["rated"];
  const timeControl = value["timeControl"];
  const createdAt = value["createdAt"];
  const lastMoveAt = nullableNumber(value["lastMoveAt"]);
  const pgn = value["pgn"];
  const importedAt = value["importedAt"];
  const latestRepertoireMove = parseLatestRepertoireMove(value["latestRepertoireMove"]);

  if (
    typeof id !== "string" ||
    typeof source !== "string" ||
    typeof sourceGameId !== "string" ||
    typeof importedAccount !== "string" ||
    userColor === null ||
    typeof opponentName !== "string" ||
    opponentRating === undefined ||
    userRating === undefined ||
    typeof whiteName !== "string" ||
    typeof blackName !== "string" ||
    whiteRating === undefined ||
    blackRating === undefined ||
    winner === undefined ||
    (result !== "1-0" && result !== "0-1" && result !== "1/2-1/2" && result !== "*") ||
    typeof speed !== "string" ||
    typeof perf !== "string" ||
    typeof rated !== "boolean" ||
    typeof timeControl !== "string" ||
    !isNumber(createdAt) ||
    lastMoveAt === undefined ||
    typeof pgn !== "string" ||
    typeof importedAt !== "string" ||
    latestRepertoireMove === undefined
  ) {
    return null;
  }

  return {
    id,
    source,
    sourceGameId,
    importedAccount,
    userColor,
    opponentName,
    opponentRating,
    userRating,
    whiteName,
    blackName,
    whiteRating,
    blackRating,
    winner,
    result,
    speed,
    perf,
    rated,
    timeControl,
    createdAt,
    lastMoveAt,
    opening: parseOpening(value["opening"]),
    pgn,
    importedAt,
    latestRepertoireMove,
  };
}

function parseGames(value: unknown): StoredGame[] | null {
  if (!isRecord(value) || !Array.isArray(value["games"])) {
    return null;
  }

  const games = value["games"].map(parseGame);
  return games.some((game) => game === null) ? null : games.filter((game) => game !== null);
}

function parsePositionMove(value: unknown): PositionMoveStat | null {
  if (!isRecord(value)) return null;
  const uci = value["uci"];
  const san = value["san"];
  const games = value["games"];
  const whiteWins = value["whiteWins"];
  const draws = value["draws"];
  const blackWins = value["blackWins"];
  const whiteWinRate = value["whiteWinRate"];
  const drawRate = value["drawRate"];
  const blackWinRate = value["blackWinRate"];
  if (
    typeof uci !== "string" ||
    typeof san !== "string" ||
    !isNonNegativeInteger(games) ||
    !isNonNegativeInteger(whiteWins) ||
    !isNonNegativeInteger(draws) ||
    !isNonNegativeInteger(blackWins) ||
    whiteWins + draws + blackWins !== games ||
    !isRate(whiteWinRate) ||
    !isRate(drawRate) ||
    !isRate(blackWinRate)
  ) {
    return null;
  }
  return { uci, san, games, whiteWins, draws, blackWins, whiteWinRate, drawRate, blackWinRate };
}

export function parsePositionMovesResponse(value: unknown): PositionMoves | null {
  if (!isRecord(value)) return null;
  const currentPositionKey = value["positionKey"];
  const playedBy = value["playedBy"];
  const games = value["games"];
  const rawMoves = value["moves"];
  if (
    typeof currentPositionKey !== "string" ||
    !isPositionKey(currentPositionKey) ||
    (playedBy !== "user" && playedBy !== "opponent") ||
    !isNonNegativeInteger(games) ||
    !Array.isArray(rawMoves)
  ) {
    return null;
  }
  const moves = rawMoves.map(parsePositionMove);
  if (moves.some((move) => move === null)) return null;
  const parsedMoves = moves.filter((move) => move !== null);
  if (parsedMoves.reduce((total, move) => total + move.games, 0) !== games) return null;
  return { positionKey: currentPositionKey, playedBy, games, moves: parsedMoves };
}

function parseStoredGameResponse(value: unknown): StoredGame | null {
  if (!isRecord(value)) {
    return null;
  }
  return parseGame(value["game"]);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readError(response: Response): Promise<string | null> {
  const value = await readJson(response);
  if (!isRecord(value)) {
    return null;
  }
  const error = value["error"];
  return typeof error === "string" ? error : null;
}

function errorResult(response: Response, error: string | null): GamesResult {
  if (response.status === 401) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status === 404 && error === "lichess_user_not_found") {
    return { ok: false, reason: "not-found" };
  }
  if (
    response.status === 503 &&
    (error === "lichess_api_token_required" || error === "lichess_api_token_rejected")
  ) {
    return { ok: false, reason: "lichess-auth-required" };
  }
  return { ok: false, reason: "unavailable" };
}

export function parseGamesResponse(value: unknown): StoredGame[] | null {
  return parseGames(value);
}

export function parseGameResponse(value: unknown): StoredGame | null {
  return parseStoredGameResponse(value);
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

  const games = parseGames(await readJson(response));
  return games === null ? { ok: false, reason: "invalid-response" } : { ok: true, games };
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

  const game = parseStoredGameResponse(await readJson(response));
  return game === null ? { ok: false, reason: "invalid-response" } : { ok: true, game };
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

  const data = parsePositionMovesResponse(await readJson(response));
  return data === null ? { ok: false, reason: "invalid-response" } : { ok: true, data };
}

export async function importRecentLichessGames(
  handle: string,
  options: { fetcher?: Fetcher; max?: number } = {},
): Promise<GamesResult> {
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
      body: JSON.stringify({ handle, max: options.max ?? 20 }),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const body = await readJson(response);
  if (!response.ok) {
    const error = isRecord(body) && typeof body["error"] === "string" ? body["error"] : null;
    return errorResult(response, error);
  }
  if (!isRecord(body) || !isNumber(body["imported"])) {
    return { ok: false, reason: "invalid-response" };
  }

  const games = parseGames(body);
  return games === null
    ? { ok: false, reason: "invalid-response" }
    : { ok: true, games, imported: body["imported"] };
}
