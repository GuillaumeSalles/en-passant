import type { StoredGame } from "./gameContracts";
import { parseGameImport } from "./localGames";

export function lichessGameId(game: Pick<StoredGame, "source" | "sourceGameId">): string | null {
  if (game.source === "lichess" && /^[a-zA-Z0-9]{8}$/.test(game.sourceGameId))
    return game.sourceGameId;
  return (
    /^https?:\/\/(?:www\.)?lichess\.org\/([a-zA-Z0-9]{8})(?:\/(?:white|black))?\/?(?:[?#].*)?$/.exec(
      game.sourceGameId,
    )?.[1] ?? null
  );
}

export function normalizeLichessUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(normalized))
    throw new Error(
      "Enter a valid Lichess username (2–30 letters, numbers, underscores or hyphens).",
    );
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type LichessGame = {
  createdAt: number;
  ongoing: boolean;
  game: StoredGame | null;
};

export function parseLichessGame(value: unknown, username: string): LichessGame {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    !/^[a-zA-Z0-9]{8}$/.test(value["id"]) ||
    typeof value["createdAt"] !== "number" ||
    !Number.isSafeInteger(value["createdAt"]) ||
    value["createdAt"] < 0 ||
    typeof value["status"] !== "string" ||
    typeof value["variant"] !== "string"
  )
    throw new Error("Lichess returned an invalid game. Import can be retried.");
  const createdAt = value["createdAt"];
  const ongoing = value["status"] === "created" || value["status"] === "started";
  // The editor supports standard chess. Unfinished and empty games have no reviewable result.
  if (
    value["variant"] !== "standard" ||
    ongoing ||
    value["status"] === "aborted" ||
    value["status"] === "noStart"
  )
    return { createdAt, ongoing: ongoing && value["variant"] === "standard", game: null };
  if (typeof value["moves"] !== "string" || typeof value["pgn"] !== "string")
    throw new Error("Lichess returned a game without its moves. Import can be retried.");
  if (value["moves"].trim() === "") return { createdAt, ongoing: false, game: null };
  const game = parseGameImport(value["pgn"], username, "white", () => `lichess:${value["id"]}`)[0];
  if (game === undefined) throw new Error("Lichess returned an empty PGN.");
  if (game.result === "*")
    throw new Error("Lichess returned an unfinished result. Import can be retried.");
  return {
    createdAt,
    ongoing: false,
    game: {
      ...game,
      source: "lichess",
      sourceGameId: value["id"],
      createdAt,
      lastMoveAt: typeof value["lastMoveAt"] === "number" ? value["lastMoveAt"] : null,
      rated: value["rated"] === true,
      speed: typeof value["speed"] === "string" ? value["speed"] : game.speed,
      perf: typeof value["perf"] === "string" ? value["perf"] : game.perf,
    },
  };
}

// Lichess exports the complete history as NDJSON; no max limit or recursive pagination.
export async function* streamLichessGames(
  username: string,
  since: number | null,
  until: number,
  signal: AbortSignal,
): AsyncGenerator<LichessGame> {
  const url = new URL(`https://lichess.org/api/games/user/${normalizeLichessUsername(username)}`);
  url.search = new URLSearchParams({
    pgnInJson: "true",
    moves: "true",
    tags: "true",
    opening: "true",
    clocks: "false",
    evals: "false",
    ongoing: "true",
    finished: "true",
    sort: "dateAsc",
    perfType: "ultraBullet,bullet,blitz,rapid,classical,correspondence",
    until: String(until),
    ...(since === null ? {} : { since: String(since) }),
  }).toString();
  const response = await fetch(url, {
    headers: { Accept: "application/x-ndjson" },
    credentials: "omit",
    signal,
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Lichess username not found.");
    if (response.status === 429)
      throw new Error("Lichess is rate limiting imports. Wait at least a minute before retrying.");
    throw new Error(`Lichess import failed (${response.status}). Please try again later.`);
  }
  if (response.body === null) throw new Error("Lichess did not return a game stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line !== "") yield parseLichessGame(JSON.parse(line) as unknown, username);
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer.trim() !== "") yield parseLichessGame(JSON.parse(buffer) as unknown, username);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
