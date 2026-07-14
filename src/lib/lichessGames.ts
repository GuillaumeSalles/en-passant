export type LichessGameColor = "white" | "black";
export type LichessGameSort = "asc" | "desc";

export type StoredLichessGame = {
  id: string;
  importedHandle: string;
  userColor: LichessGameColor;
  opponentName: string;
  opponentRating: number | null;
  userRating: number | null;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  winner: LichessGameColor | null;
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
};

export type LichessGamesResult =
  | { ok: true; games: StoredLichessGame[]; imported?: number }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "invalid-response"
        | "not-found"
        | "unavailable"
        | "lichess-auth-required";
    };

export type LichessGameResult =
  | { ok: true; game: StoredLichessGame }
  | {
      ok: false;
      reason: "unauthorized" | "invalid-response" | "not-found" | "unavailable";
    };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseColor(value: unknown): LichessGameColor | null {
  return value === "white" || value === "black" ? value : null;
}

function parseOpening(value: unknown): StoredLichessGame["opening"] {
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

function nullableColor(value: unknown): LichessGameColor | null | undefined {
  if (value === null) return null;
  return parseColor(value) ?? undefined;
}

function parseGame(value: unknown): StoredLichessGame | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = value["id"];
  const importedHandle = value["importedHandle"];
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

  if (
    typeof id !== "string" ||
    typeof importedHandle !== "string" ||
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
    typeof importedAt !== "string"
  ) {
    return null;
  }

  return {
    id,
    importedHandle,
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
  };
}

function parseGames(value: unknown): StoredLichessGame[] | null {
  if (!isRecord(value) || !Array.isArray(value["games"])) {
    return null;
  }

  const games = value["games"].map(parseGame);
  return games.some((game) => game === null) ? null : games.filter((game) => game !== null);
}

function parseGameResponse(value: unknown): StoredLichessGame | null {
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

function errorResult(response: Response, error: string | null): LichessGamesResult {
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

export function parseLichessGamesResponse(value: unknown): StoredLichessGame[] | null {
  return parseGames(value);
}

export function parseLichessGameResponse(value: unknown): StoredLichessGame | null {
  return parseGameResponse(value);
}

export async function loadLichessGames(
  filters: {
    timeControl?: string;
    color?: LichessGameColor;
    sort?: LichessGameSort;
  } = {},
  options: { fetcher?: Fetcher } = {},
): Promise<LichessGamesResult> {
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

  const path = `/api/lichess/games${params.size === 0 ? "" : `?${params}`}`;
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

export async function loadLichessGame(
  gameId: string,
  options: { fetcher?: Fetcher } = {},
): Promise<LichessGameResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`/api/lichess/games/${encodeURIComponent(gameId)}`, {
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

  const game = parseGameResponse(await readJson(response));
  return game === null ? { ok: false, reason: "invalid-response" } : { ok: true, game };
}

export async function importRecentLichessGames(
  handle: string,
  options: { fetcher?: Fetcher; max?: number } = {},
): Promise<LichessGamesResult> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher("/api/lichess/games/import", {
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
