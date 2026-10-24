import { cleanup, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import { PositionMoveStats } from "./PositionMoveStats";
import { STARTING_FEN } from "@/lib/chess";
import { notifyGamesChanged } from "@/lib/gameUpdates";
import { loadPositionMoves } from "@/lib/games";
vi.mock("@/lib/games", () => ({
  loadPositionMoves: vi.fn(async () => ({
    ok: true,
    data: { games: 0, moves: [], recentGames: [] },
  })),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("shows local statistics with no account requirement", async () => {
  render(() => <PositionMoveStats fen={STARTING_FEN} color="white" onMove={() => {}} />);
  await waitFor(() => expect(screen.getByText("0 games in this position")).toBeDefined());
  expect(screen.queryByText("Sign in")).toBeNull();
});

test("refreshes the current position when an import finishes", async () => {
  const view = render(() => (
    <PositionMoveStats fen={STARTING_FEN} color="white" onMove={() => {}} />
  ));
  await waitFor(() => expect(view.getByText("0 games in this position")).toBeDefined());
  vi.mocked(loadPositionMoves).mockResolvedValueOnce({
    ok: true,
    data: {
      positionKey: STARTING_FEN,
      playedBy: "user",
      games: 12,
      moves: [],
      recentGames: [],
    },
  });
  notifyGamesChanged();
  await waitFor(() => expect(view.getByText("12 games in this position")).toBeDefined());
});
