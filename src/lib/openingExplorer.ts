import { handleUnauthorizedResponse } from "@/lib/authSession";
import type { PositionMoveStat } from "@/lib/games";

export type MasterGame = {
  id: string;
  white: { name: string; rating: number };
  black: { name: string; rating: number };
  result: "1-0" | "0-1" | "1/2-1/2";
  moveUci: string;
};

export type MastersPosition = {
  source: "lichess-masters";
  positionKey: string;
  since: number | null;
  until: number | null;
  games: number;
  moves: PositionMoveStat[];
  topGames: MasterGame[];
};

export type MastersPositionResult =
  | { ok: true; data: MastersPosition }
  | {
      ok: false;
      reason: "unauthorized" | "rate-limited" | "configuration" | "unavailable";
    };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;
type ErrorResponse = { error?: string };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function loadMastersPosition(
  currentPositionKey: string,
  filters: { since?: number; until?: number } = {},
  options: { fetcher?: Fetcher } = {},
): Promise<MastersPositionResult> {
  const params = new URLSearchParams({ positionKey: currentPositionKey });
  if (filters.since !== undefined) params.set("since", String(filters.since));
  if (filters.until !== undefined) params.set("until", String(filters.until));

  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`/api/opening-explorer/masters?${params}`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (await handleUnauthorizedResponse(response)) {
    return { ok: false, reason: "unauthorized" };
  }
  if (!response.ok) {
    const error = await readJson<ErrorResponse>(response).catch((): ErrorResponse => ({}));
    if (error.error === "lichess_rate_limited") {
      return { ok: false, reason: "rate-limited" };
    }
    if (
      error.error === "lichess_api_token_required" ||
      error.error === "lichess_api_token_rejected"
    ) {
      return { ok: false, reason: "configuration" };
    }
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, data: await readJson<MastersPosition>(response) };
}
