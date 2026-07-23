import { MemoryRouter, Route } from "@solidjs/router";
import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, test, vi } from "vitest";
import { STARTING_FEN } from "@/lib/chess";
import { PositionMoveStats } from "./PositionMoveStats";

const mockedAuth = vi.hoisted(() => ({
  status: "signed-in" as "signed-in" | "signed-out",
  user: { id: "player-user" } as { id: string } | null,
}));

vi.mock("@/lib/authSession", () => ({
  authStatus: () => mockedAuth.status,
  currentAuthUser: () => mockedAuth.user,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mockedAuth.status = "signed-in";
  mockedAuth.user = { id: "player-user" };
});

test("shows move results and hides the total row when there is only one next move", async () => {
  const onMove = vi.fn();
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({
      positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
      playedBy: "opponent",
      games: 6,
      moves: [
        {
          uci: "e2e4",
          san: "e4",
          games: 6,
          whiteWins: 3,
          draws: 2,
          blackWins: 1,
          whiteWinRate: 0.5,
          drawRate: 1 / 3,
          blackWinRate: 1 / 6,
        },
      ],
      recentGames: [
        {
          id: "lichess-newest",
          source: "lichess",
          createdAt: 1_765_000_000_000,
          white: { name: "Player One", rating: 1800 },
          black: { name: "Opponent One", rating: 1810 },
          result: "1-0",
          speed: "blitz",
          timeControl: "180+2",
          move: { ply: 1, uci: "e2e4", san: "e4" },
        },
        {
          id: "chesscom-older",
          source: "chesscom",
          createdAt: 1_764_000_000_000,
          white: { name: "Opponent Two", rating: null },
          black: { name: "Player One", rating: 1790 },
          result: "1/2-1/2",
          speed: "rapid",
          timeControl: "600+0",
          move: { ply: 1, uci: "e2e4", san: "e4" },
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);

  render(() => (
    <MemoryRouter
      root={() => <PositionMoveStats fen={STARTING_FEN} color="black" onMove={onMove} />}
    >
      <Route path="/" component={() => null} />
    </MemoryRouter>
  ));

  await waitFor(() => expect(screen.getByText("e4")).not.toBeNull());
  const section = screen.getByRole("region", { name: "Your games" });
  expect(section.className).toContain("overflow-hidden");
  const separator = screen.getByRole("separator", {
    name: "Resize moves and your games panels",
  });
  expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
  vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
    bottom: 300,
    height: 300,
    left: 0,
    right: 400,
    top: 0,
    width: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const globalShortcut = vi.fn();
  window.addEventListener("keydown", globalShortcut);
  fireEvent.keyDown(separator, { key: "ArrowDown" });
  window.removeEventListener("keydown", globalShortcut);
  expect(globalShortcut).not.toHaveBeenCalled();
  await waitFor(() => expect(section.getAttribute("data-resized")).toBe("true"));
  expect(section.style.getPropertyValue("--position-move-stats-height")).toBe("276px");
  expect(screen.getByRole("heading", { name: "Your games" })).not.toBeNull();
  expect(screen.getByRole("button", { name: "Play e4" })).not.toBeNull();
  expect(screen.getByRole("cell", { name: "100% of games, 6 games" })).not.toBeNull();
  const resultBar = screen.getByRole("img", {
    name: "e4 results: 3 white wins (50%), 2 draws (33.3%), 1 black win (16.7%)",
  });
  expect(resultBar.children).toHaveLength(3);
  expect((resultBar.children[0] as HTMLElement).style.width).toBe("50%");
  expect((resultBar.children[1] as HTMLElement).style.width).toBe("33.3%");
  expect((resultBar.children[2] as HTMLElement).style.width).toBe("16.7%");
  expect(resultBar.children[0]?.className).toContain("bg-neutral-200");
  expect(resultBar.children[0]?.className).toContain("dark:bg-neutral-100");
  expect(resultBar.children[2]?.className).toContain("bg-neutral-900");
  expect(resultBar.children[2]?.className).toContain("dark:bg-neutral-800");
  expect(resultBar.textContent).toBe("50%33.3%16.7%");
  expect(screen.queryByRole("cell", { name: "Total" })).toBeNull();
  const recentGames = screen.getByLabelText("Recent games");
  const recentLinks = recentGames.querySelectorAll("a");
  expect(recentLinks).toHaveLength(2);
  expect(recentLinks[0]?.getAttribute("href")).toBe("/app/games/lichess-newest");
  expect(recentLinks[1]?.getAttribute("href")).toBe("/app/games/chesscom-older");
  expect(recentLinks[0]?.textContent).toBe("Player One (1800) – Opponent One (1810)3+21-0");
  expect(recentLinks[0]?.getAttribute("aria-label")).toContain(", 3+2, 1-0");

  const requestedUrl = String(fetcher.mock.calls[0]?.[0]);
  expect(requestedUrl).toContain("/api/games/position-moves?");
  expect(requestedUrl).toContain("positionKey=");
  expect(requestedUrl).toContain("color=black");

  screen.getByRole("cell", { name: "100% of games, 6 games" }).click();
  expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ uci: "e2e4", san: "e4" }));
});

test("shows the total row when there are multiple next moves", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
        playedBy: "user",
        games: 2,
        moves: [
          {
            uci: "e2e4",
            san: "e4",
            games: 1,
            whiteWins: 1,
            draws: 0,
            blackWins: 0,
            whiteWinRate: 1,
            drawRate: 0,
            blackWinRate: 0,
          },
          {
            uci: "d2d4",
            san: "d4",
            games: 1,
            whiteWins: 0,
            draws: 0,
            blackWins: 1,
            whiteWinRate: 0,
            drawRate: 0,
            blackWinRate: 1,
          },
        ],
        recentGames: [],
      }),
    ),
  );

  render(() => (
    <MemoryRouter
      root={() => <PositionMoveStats fen={STARTING_FEN} color="white" onMove={() => undefined} />}
    >
      <Route path="/" component={() => null} />
    </MemoryRouter>
  ));

  await waitFor(() => expect(screen.getByText("e4")).not.toBeNull());
  expect(screen.getByRole("cell", { name: "Total" })).not.toBeNull();
  expect(
    screen.getByRole("img", {
      name: "Total results: 1 white win (50%), 0 draws (0%), 1 black win (50%)",
    }),
  ).not.toBeNull();
});

test("hides the section for anonymous users", async () => {
  mockedAuth.status = "signed-out";
  mockedAuth.user = null;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);

  render(() => (
    <MemoryRouter
      root={() => <PositionMoveStats fen={STARTING_FEN} color="white" onMove={() => undefined} />}
    >
      <Route path="/" component={() => null} />
    </MemoryRouter>
  ));

  await waitFor(() => {
    expect(screen.queryByRole("region", { name: "Your games" })).toBeNull();
  });
  expect(fetcher).not.toHaveBeenCalled();
});
