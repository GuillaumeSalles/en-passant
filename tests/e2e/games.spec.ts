import { expect, test } from "@playwright/test";
import { mockSignedInUser } from "./helpers";

test("keeps games visible while an asynchronous Lichess import progresses", async ({ page }) => {
  const session = await mockSignedInUser(page);
  session.signIn();
  let started = false;
  let polls = 0;

  await page.route("**/api/games", async (route) => {
    const existingGame = {
      id: "lichess-existing",
      source: "lichess",
      sourceGameId: "existing",
      importedAccount: "PlayerOne",
      userColor: "white",
      opponentName: "Existing Opponent",
      opponentRating: 1810,
      userRating: 1800,
      whiteName: "PlayerOne",
      blackName: "Existing Opponent",
      whiteRating: 1800,
      blackRating: 1810,
      winner: "white",
      result: "1-0",
      speed: "blitz",
      perf: "blitz",
      rated: true,
      timeControl: "180+2",
      createdAt: 1_765_000_000_000,
      lastMoveAt: 1_765_000_120_000,
      opening: null,
      pgn: "1. e4 e5 1-0",
      importedAt: "2026-07-13T00:00:00.000Z",
      latestRepertoireMove: null,
    };
    const games =
      polls === 0
        ? [existingGame]
        : [
            existingGame,
            {
              ...existingGame,
              id: "lichess-new",
              sourceGameId: "new",
              opponentName: "Newly Imported Opponent",
            },
          ];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        total: games.length,
        games,
      }),
    });
  });
  await page.route("**/api/game-imports/lichess", async (route) => {
    const baseImport = {
      id: "import-id",
      source: "lichess",
      account: "PlayerOne",
      kind: "backfill",
      processedGames: 0,
      totalGames: 142,
      error: null,
      createdAt: "2026-07-23T00:00:00.000Z",
      startedAt: null,
      updatedAt: "2026-07-23T00:00:00.000Z",
      completedAt: null,
    };
    if (route.request().method() === "POST") {
      started = true;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ import: { ...baseImport, status: "queued" } }),
      });
      return;
    }
    if (!started) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ import: null }),
      });
      return;
    }
    polls += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        import:
          polls === 1
            ? {
                ...baseImport,
                status: "running",
                processedGames: 100,
                startedAt: "2026-07-23T00:00:01.000Z",
              }
            : {
                ...baseImport,
                status: "completed",
                processedGames: 142,
                completedAt: "2026-07-23T00:00:05.000Z",
              },
      }),
    });
  });

  await page.goto("/app/games");
  await expect(page.getByText("Existing Opponent")).toBeVisible();
  await page.getByLabel("Lichess handle").fill("PlayerOne");
  await page.getByRole("button", { name: "Import" }).click();

  await expect(page.getByText("Waiting to import PlayerOne…")).toBeVisible();
  await expect(page.getByText("Existing Opponent")).toBeVisible();
  await expect(page.getByText(/100 of 142 finished games processed/)).toBeVisible();
  await expect(page.getByText("Newly Imported Opponent")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Importing PlayerOne" })).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.getByText(/Import complete — 142 finished games processed/)).toBeVisible();
  await page.waitForTimeout(500);
  const settledPolls = polls;
  await page.waitForTimeout(3000);
  expect(polls).toBe(settledPolls);
});

test("shows the latest repertoire move on an imported game", async ({ page }) => {
  const session = await mockSignedInUser(page);
  session.signIn();
  await page.route("**/api/games/lichess-abc123", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        game: {
          id: "lichess-abc123",
          source: "lichess",
          sourceGameId: "abc123",
          importedAccount: "PlayerOne",
          userColor: "white",
          opponentName: "Opponent",
          opponentRating: 1810,
          userRating: 1800,
          whiteName: "PlayerOne",
          blackName: "Opponent",
          whiteRating: 1800,
          blackRating: 1810,
          winner: "white",
          result: "1-0",
          speed: "blitz",
          perf: "blitz",
          rated: true,
          timeControl: "180+2",
          createdAt: 1_765_000_000_000,
          lastMoveAt: 1_765_000_120_000,
          opening: { eco: "C50", name: "Italian Game" },
          pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 *",
          importedAt: "2026-07-13T00:00:00.000Z",
          latestRepertoireMove: {
            ply: 4,
            positionKey: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
            san: "Nc6",
            repertoire: { handle: "white", name: "White repertoire" },
            chapter: { handle: "italian", name: "Italian Game" },
          },
          repertoireMistake: {
            ply: 5,
            positionKey: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
            playedSan: "Bc4",
            expectedSan: "Bb5",
            uciPath: "e2e4 e7e5 g1f3 b8c6 f1b5",
            repertoire: { handle: "white", name: "White repertoire" },
            chapter: { handle: "italian", name: "Italian Game" },
          },
        },
      }),
    });
  });

  await page.goto("/app/games/lichess-abc123");

  const move = page.getByRole("button", { name: "Move Nc6" });
  const indicator = move.locator('[data-move-indicator="repertoire"]');
  const coverageBanner = page.locator("[data-repertoire-coverage]");
  const mistakeBanner = page.locator("[data-repertoire-mistake]");
  await expect(page.locator('[aria-label="Evaluation bar"]')).toBeVisible();
  await expect(coverageBanner).toContainText("Last repertoire move 2... Nc6");
  await expect(mistakeBanner).toContainText("You played 3. Bc4; your repertoire has 3. Bb5");
  await expect(mistakeBanner.getByRole("link", { name: "Train" })).toHaveAttribute(
    "href",
    /\/app\/repertoires\/white\/italian\/train\/v1-/,
  );
  await expect(
    coverageBanner.getByRole("link", { name: "White repertoire / Italian Game" }),
  ).toHaveAttribute(
    "href",
    "/app/repertoires/white/italian?selectedPositionKey=r1bqkbnr%2Fpppp1ppp%2F2n5%2F4p3%2F4P3%2F5N2%2FPPPP1PPP%2FRNBQKB1R%20w%20KQkq%20-",
  );
  await expect(indicator).toHaveAttribute(
    "aria-label",
    "Latest position found in one of your repertoires",
  );
  await expect(indicator).toHaveClass(/self-center/);
  await expect(indicator).toHaveClass(/text-amber-500/);
  await indicator.hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Latest position found in one of your repertoires",
  );
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(move).not.toHaveAttribute("aria-current", "true");

  await page.reload();

  await expect(move).not.toHaveAttribute("aria-disabled", "true");
  await move.getByText("Nc6", { exact: true }).click();
  await expect(move).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-square="c6"]')).toHaveAttribute("data-piece", "n");
  await expect(page.locator('[data-square="b8"]')).not.toHaveAttribute("data-piece");

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Move Nf3" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.locator('[data-square="c6"]')).not.toHaveAttribute("data-piece");
  await expect(page.locator('[data-square="b8"]')).toHaveAttribute("data-piece", "n");

  await page.keyboard.press("ArrowRight");
  await expect(move).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-square="c6"]')).toHaveAttribute("data-piece", "n");

  await page.keyboard.press("1");
  await expect(move.locator("[data-nag]")).toHaveCount(0);
});
