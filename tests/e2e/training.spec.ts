import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  collectUnexpectedConsole,
  mockSignedInUser,
  mockSignedOutAuth,
  seedIndexedDb,
  type ChapterRecord,
  type RepertoireRecord,
  type TrainingLineScheduleRecord,
} from "./helpers";

const updatedAt = "2026-07-21T00:00:00.000Z";
const repertoire = {
  id: "training-repertoire",
  handle: "white-repertoire",
  name: "White repertoire",
  orientation: "white",
  updatedAt,
  deletedAt: null,
  dirty: false,
} satisfies RepertoireRecord;
const chapter = {
  id: "training-chapter",
  repertoireId: repertoire.id,
  handle: "open-games",
  name: "Open games",
  pgnId: "training-pgn",
  updatedAt,
  deletedAt: null,
  dirty: false,
} satisfies ChapterRecord;

function schedule(
  uciPath: string,
  dueAt: number,
  intervalIndex: number,
): TrainingLineScheduleRecord {
  return {
    repertoireId: repertoire.id,
    chapterId: chapter.id,
    uciPath,
    intervalIndex,
    dueAt,
    lastReviewedAt: dueAt - 60_000,
    algorithmVersion: 1,
    updatedAt,
    dirty: false,
  };
}

async function dragPiece(page: Page, from: string, to: string) {
  const sourceBox = await page.locator(`[data-square="${from}"]`).boundingBox();
  const targetBox = await page.locator(`[data-square="${to}"]`).boundingBox();
  if (sourceBox === null || targetBox === null) {
    throw new Error(`Cannot drag from ${from} to ${to}; square is not visible`);
  }
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await mockSignedOutAuth(page);
});

test("lists scheduled lines by training priority", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [
      {
        id: chapter.pgnId,
        pgn: "1. e4 (1. d4 d5) e5 *",
        updatedAt,
        deletedAt: null,
        dirty: false,
      },
    ],
    trainingLineSchedules: [
      schedule("e2e4 e7e5", Date.now() - 60_000, 1),
      schedule("d2d4 d7d5", Date.now() - 120_000, 2),
    ],
  });

  await page.goto("/app/training");

  await expect(page.getByRole("heading", { name: "Training queue" })).toBeVisible();
  await expect(page.getByText("2 due · 2 scheduled")).toBeVisible();
  const lines = page.locator("[data-training-queue-line]");
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toContainText("Priority 1");
  await expect(lines.nth(0)).toContainText("d4 d5");
  await expect(lines.nth(0).locator('[data-mastery-level="practiced"]')).toBeVisible();
  await expect(lines.nth(1)).toContainText("e4 e5");
  await expect(lines.nth(1).locator('[data-mastery-level="familiar"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Review lines" })).toHaveAttribute(
    "href",
    /\/app\/repertoires\/white-repertoire\/open-games\/train\/v1-.*\?review=due$/,
  );
  await expect(lines.nth(0).getByRole("link", { name: "Review", exact: true })).toBeVisible();
  expect(consoleMessages).toEqual([]);
});

test("reviews every due line across chapters and stops before future lines", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const secondChapter = {
    id: "training-chapter-2",
    repertoireId: repertoire.id,
    handle: "queens-pawn",
    name: "Queen's pawn",
    pgnId: "training-pgn-2",
    updatedAt,
    deletedAt: null,
    dirty: false,
  } satisfies ChapterRecord;
  const futureLine = schedule("c2c4 e7e5", Date.now() + 60 * 60 * 1000, 2);
  futureLine.chapterId = secondChapter.id;

  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter, secondChapter],
    pgns: [
      {
        id: chapter.pgnId,
        pgn: "1. e4 e5 *",
        updatedAt,
        deletedAt: null,
        dirty: false,
      },
      {
        id: secondChapter.pgnId,
        pgn: "1. d4 (1. c4 e5) d5 *",
        updatedAt,
        deletedAt: null,
        dirty: false,
      },
    ],
    trainingLineSchedules: [
      schedule("e2e4 e7e5", Date.now() - 120_000, 1),
      {
        ...schedule("d2d4 d7d5", Date.now() - 60_000, 1),
        chapterId: secondChapter.id,
      },
      futureLine,
    ],
  });

  await page.goto("/app/training");
  await expect(page.getByText("2 due · 3 scheduled")).toBeVisible();
  await page.getByRole("link", { name: "Review lines" }).click();

  await expect(page).toHaveURL(
    /\/app\/repertoires\/white-repertoire\/open-games\/train\/v1-.*\?review=due$/,
  );
  await expect(page.getByText("0/2", { exact: true })).toBeVisible();
  await dragPiece(page, "e2", "e4");

  await expect(page).toHaveURL(
    /\/app\/repertoires\/white-repertoire\/queens-pawn\/train\/v1-.*\?review=due$/,
  );
  await expect(page.getByText("1/2", { exact: true })).toBeVisible();

  await page.locator('a[href="/app/training"]').click();
  await expect(page.getByText("1 due · 3 scheduled")).toBeVisible();
  await page.getByRole("link", { name: "Review lines" }).click();
  await expect(page.getByText("0/1", { exact: true })).toBeVisible();

  await dragPiece(page, "d2", "d4");

  await expect(page).toHaveURL("/app/training");
  await expect(page.getByText("0 due · 3 scheduled")).toBeVisible();
  const reviewLinesButton = page.getByRole("button", { name: "Review lines" });
  await expect(reviewLinesButton).toBeDisabled();
  await reviewLinesButton.hover({ force: true });
  await expect(page.getByRole("tooltip")).toHaveText("You have no variation to review");
  expect(consoleMessages).toEqual([]);
});

test("stops an imported-mistake exercise at the scheduled partial ply", async ({ page }) => {
  const session = await mockSignedInUser(page);
  session.signIn();
  await page.route("**/api/games/training-mistakes", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        links: [
          {
            chapterId: chapter.id,
            uciPath: "e2e4 e7e5 g1f3",
            game: {
              id: "lichess-mistake",
              createdAt: 1_765_000_000_000,
              opponentName: "Opponent",
            },
          },
        ],
      }),
    });
  });
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [
      {
        id: chapter.pgnId,
        pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 *",
        updatedAt,
        deletedAt: null,
        dirty: false,
      },
    ],
    trainingLineSchedules: [schedule("e2e4 e7e5 g1f3", 0, 0)],
  });
  await page.goto("/app/training");
  await expect(page.getByRole("link", { name: "Review game vs Opponent" })).toHaveAttribute(
    "href",
    "/app/games/lichess-mistake",
  );
  await page
    .locator("[data-training-queue-line]")
    .getByRole("link", { name: "Review", exact: true })
    .click();

  await dragPiece(page, "e2", "e4");
  await expect(page.locator('[data-square="e5"]')).toHaveAttribute("data-piece", "p");
  await dragPiece(page, "g1", "f3");

  await expect(page.getByText("Good job!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move Nc6" })).toHaveCount(0);
});
