import { expect, test } from "@playwright/test";
import { mockSignedInUser } from "./helpers";

test("shows the latest repertoire move on an imported game", async ({ page }) => {
  const session = await mockSignedInUser(page);
  session.signIn();
  await page.route("**/api/lichess/games/abc123", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        game: {
          id: "abc123",
          importedHandle: "PlayerOne",
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
        },
      }),
    });
  });

  await page.goto("/app/games/abc123");

  const move = page.getByRole("button", { name: "Move Nc6" });
  const indicator = move.locator('[data-move-indicator="repertoire"]');
  const coverageBanner = page.locator("[data-repertoire-coverage]");
  await expect(coverageBanner).toContainText("Last repertoire move 2... Nc6");
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
