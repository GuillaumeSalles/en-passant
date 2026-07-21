import { expect, test } from "@playwright/test";
import {
  collectUnexpectedConsole,
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
  await expect(page.getByRole("link", { name: "Train next" })).toHaveAttribute(
    "href",
    /\/app\/repertoires\/white-repertoire\/open-games\/train\/v1-/,
  );
  expect(consoleMessages).toEqual([]);
});
