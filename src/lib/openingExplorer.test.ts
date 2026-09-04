import { expect, test, vi } from "vitest";
import { loadMastersPosition } from "./openingExplorer";

vi.mock("@/lib/authSession", () => ({
  handleUnauthorizedResponse: async (response: Response) => response.status === 401,
}));

test("loads a master position with optional year filters", async () => {
  const body = {
    source: "lichess-masters",
    positionKey: "position-key",
    since: 2000,
    until: 2025,
    games: 1,
    moves: [],
    topGames: [],
  } as const;
  const fetcher = vi.fn(async () => Response.json(body));

  await expect(
    loadMastersPosition("position-key", { since: 2000, until: 2025 }, { fetcher }),
  ).resolves.toEqual({ ok: true, data: body });
  expect(fetcher).toHaveBeenCalledWith(
    "/api/opening-explorer/masters?positionKey=position-key&since=2000&until=2025",
    {
      credentials: "include",
      headers: { accept: "application/json" },
    },
  );
});

test.each([
  { error: "lichess_rate_limited", reason: "rate-limited" },
  { error: "lichess_api_token_required", reason: "configuration" },
  { error: "lichess_api_token_rejected", reason: "configuration" },
] as const)("maps $error responses", async ({ error, reason }) => {
  const fetcher = vi.fn(async () => Response.json({ error }, { status: 503 }));

  await expect(loadMastersPosition("position-key", {}, { fetcher })).resolves.toEqual({
    ok: false,
    reason,
  });
});
