import { render, screen, waitFor } from "@solidjs/testing-library";
import { expect, test, vi } from "vitest";
import { PositionMoveStats } from "./PositionMoveStats";
import { STARTING_FEN } from "@/lib/chess";
vi.mock("@/lib/games", () => ({
  loadPositionMoves: vi.fn(async () => ({
    ok: true,
    data: { games: 0, moves: [], recentGames: [] },
  })),
}));
test("shows local statistics with no account requirement", async () => {
  render(() => <PositionMoveStats fen={STARTING_FEN} color="white" onMove={() => {}} />);
  await waitFor(() => expect(screen.getByText("0 games in this position")).toBeDefined());
  expect(screen.queryByText("Sign in")).toBeNull();
});
