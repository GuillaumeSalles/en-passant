import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  advanceTrainingPacing,
  collectUnexpectedConsole,
  expectLocalOnly,
  expectTrainingInputReady,
  pausePacingClock,
  seedIndexedDb,
  storedTrainingMoves,
} from "./helpers";
import { normalizePgn } from "../../src/lib/app-state/pgnTree";
import {
  getTrainingMoveTargets,
  nextTrainingMoveReview,
} from "../../src/lib/app-state/trainingMoves";
import { trainingLineIdFromUciPath } from "../../src/lib/app-state/trainingLines";

const metadata = { updatedAt: "2026-01-01", deletedAt: null, dirty: false };
const repertoire = {
  id: "r",
  handle: "white",
  name: "White",
  orientation: "white" as const,
  ...metadata,
};
const chapter = {
  id: "c",
  repertoireId: "r",
  handle: "main",
  name: "Main",
  pgnId: "p",
  ...metadata,
};
const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 *";
const targets = getTrainingMoveTargets("r", normalizePgn(pgn), "white");

async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

function route(path: string, startMove?: number) {
  const id = trainingLineIdFromUciPath(path);
  if (id === null) throw new Error("Invalid path");
  return `/app/white/main/${id}/train${startMove === undefined ? "" : `?startMove=${startMove}`}`;
}

test.beforeEach(async ({ page }) => {
  await expectLocalOnly(page);
});

test("a line with nothing due finishes without changing move knowledge or inflating its level", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const future = Date.now() + 86400000;
  const reviews = targets.map((target) => ({
    ...nextTrainingMoveReview(target, undefined, "correct", 0),
    intervalIndex: 2,
    dueAt: future,
  }));
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: reviews,
    trainingLineSchedules: [
      {
        repertoireId: "r",
        chapterId: "c",
        uciPath: "e2e4 e7e5 g1f3 b8c6 f1b5",
        intervalIndex: 2,
        dueAt: 1,
        lastReviewedAt: 0,
        algorithmVersion: 1,
        ...metadata,
      },
    ],
  });
  await page.goto(route("e2e4 e7e5 g1f3 b8c6 f1b5"));
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  expect((await storedTrainingMoves(page)).sort((a, b) => a.uci.localeCompare(b.uci))).toEqual(
    [...reviews].sort((a, b) => a.uci.localeCompare(b.uci)),
  );
  await page.goto("/app/training");
  await expect(page.getByText("0 due · 1 scheduled")).toBeVisible();
  await expect(page.getByText("Practiced", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("0 due · 1 scheduled")).toBeVisible();
  expect((await storedTrainingMoves(page)).sort((a, b) => a.uci.localeCompare(b.uci))).toEqual(
    [...reviews].sort((a, b) => a.uci.localeCompare(b.uci)),
  );
  expect(consoleMessages).toEqual([]);
});

test("skips future moves at the start, middle and end, but tests due and new decisions", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O *";
  const targets = getTrainingMoveTargets("r", normalizePgn(pgn), "white");
  const future = Date.now() + 86400000;
  const reviews = targets
    .filter((target) => target.san !== "Ba4")
    .map((target) => ({
      ...nextTrainingMoveReview(target, undefined, "correct", 0),
      dueAt: target.san === "Nf3" ? 1 : future,
    }));
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: reviews,
  });
  await page.goto(route("e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1"));
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await expectTrainingInputReady(page);
  await pausePacingClock(page);
  await move(page, "g1", "f3");
  await advanceTrainingPacing(page, "waiting-for-response", 500);
  await expect(page.locator('[data-square="b5"]')).toHaveAttribute("data-piece", "B");
  await expectTrainingInputReady(page);
  await move(page, "b5", "a4");
  await advanceTrainingPacing(page, "waiting-for-response", 500);
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute("data-piece", "K");
  const saved = await storedTrainingMoves(page);
  for (const review of reviews.filter((review) => review.uci !== "g1f3")) {
    expect(saved.find((value) => value.uci === review.uci)).toEqual(review);
  }
  expect(saved.find((value) => value.uci === "g1f3")).toMatchObject({
    successes: 2,
    intervalIndex: 1,
  });
  expect(saved.find((value) => value.uci === "b5a4")).toMatchObject({
    successes: 1,
    intervalIndex: 0,
  });
  expect(consoleMessages).toEqual([]);
});

test("skips future black moves after the opening reply", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const pgn = "1. e4 c5 2. Nf3 Nc6 *";
  const target = getTrainingMoveTargets("r", normalizePgn(pgn), "black")[0];
  if (target === undefined) throw new Error("Missing target");
  const review = nextTrainingMoveReview(target, undefined, "correct", Date.now());
  await seedIndexedDb(page, {
    repertoires: [{ ...repertoire, orientation: "black" }],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: [review],
  });
  await page.goto(route("e2e4 c7c5 g1f3 b8c6"));
  await expect(page.locator('[data-square="f3"]')).toHaveAttribute("data-piece", "N");
  await expectTrainingInputReady(page);
  await move(page, "b8", "c6");
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  expect((await storedTrainingMoves(page)).find((value) => value.uci === "c7c5")).toEqual(review);
  expect((await storedTrainingMoves(page)).find((value) => value.uci === "b8c6")).toMatchObject({
    successes: 1,
  });
  expect(consoleMessages).toEqual([]);
});

test("learning still requires reinforcement for moves that are not due", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const pgn = "1. e4 *";
  const target = getTrainingMoveTargets("r", normalizePgn(pgn), "white")[0];
  if (target === undefined) throw new Error("Missing target");
  const review = nextTrainingMoveReview(target, undefined, "correct", Date.now());
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: [review],
  });
  await page.goto(route("e2e4").replace(/train$/, "learn"));
  await expect(page.getByText("Now repeat the move.")).toBeVisible();
  await move(page, "e2", "e4");
  await expect(page.getByText(/Practice 1 of 2: White to play\./)).toBeVisible();
  await pausePacingClock(page);
  await move(page, "e2", "e4");
  await advanceTrainingPacing(page, "line-boundary", 1000);
  await expect(page.getByText(/Practice 2 of 2: White to play\./)).toBeVisible();
  await move(page, "e2", "e4");
  await advanceTrainingPacing(page, "line-boundary", 1000);
  await expect(page.getByText("Line learned.")).toBeVisible();
  expect(await storedTrainingMoves(page)).toEqual([review]);
  expect(consoleMessages).toEqual([]);
});

test("keeps the line-based queue while move knowledge persists independently", async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const reviews = targets.map((target) => ({
    ...nextTrainingMoveReview(target, undefined, "correct", 0),
    intervalIndex: 2,
    dueAt: 1,
  }));
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: reviews,
    trainingLineSchedules: [
      {
        repertoireId: "r",
        chapterId: "c",
        uciPath: "e2e4 e7e5 g1f3 b8c6 f1b5",
        intervalIndex: 2,
        dueAt: 1,
        lastReviewedAt: 0,
        algorithmVersion: 1,
        ...metadata,
      },
    ],
  });
  await page.goto("/app/training");
  await expect(page.getByText("1 due · 1 scheduled")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review lines" })).toBeVisible();
  await expect(page.locator("[data-training-queue-line]")).toHaveCount(1);
  await expect(page.getByText("Earlier line review")).toHaveCount(0);
  await expect(page.getByText("Move review", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).not.toHaveURL(/startMove=/);
  await expectTrainingInputReady(page);
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  await page.goto(route("e2e4 e7e5 g1f3", 3));
  await expectTrainingInputReady(page);
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute("data-piece", "P");
  await move(page, "g1", "f3");
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  const saved = await storedTrainingMoves(page);
  expect(saved.find((review) => review.uci === "g1f3")).toMatchObject({
    intervalIndex: 3,
    successes: 2,
  });
  for (const uci of ["e2e4", "f1b5"])
    expect(saved.find((review) => review.uci === uci)).toEqual(
      reviews.find((review) => review.uci === uci),
    );
  await page.reload();
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  expect((await storedTrainingMoves(page)).find((review) => review.uci === "g1f3")).toEqual(
    saved.find((review) => review.uci === "g1f3"),
  );
  expect(consoleMessages).toEqual([]);
});

test("a missed decision resets only itself, and corrective replays cannot erase it", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  const reviews = targets.map((target) => ({
    ...nextTrainingMoveReview(target, undefined, "correct", 0),
    intervalIndex: 3,
    dueAt: 1,
  }));
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
    trainingMoveSchedules: reviews,
  });
  await page.goto(route("e2e4 e7e5 g1f3", 3));
  await expectTrainingInputReady(page);
  await pausePacingClock(page);
  await move(page, "f1", "c4");
  await advanceTrainingPacing(page, "showing-feedback", 1000);
  await move(page, "g1", "f3");
  for (let index = 0; index < 2; index++) {
    await advanceTrainingPacing(page, "preparing-replay", 500);
    await expect(page.locator('[data-training-flow-state="awaiting-replay-move"]')).toBeVisible();
    await move(page, "g1", "f3");
  }
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  const saved = await storedTrainingMoves(page);
  expect(saved.find((review) => review.uci === "g1f3")).toMatchObject({
    intervalIndex: 0,
    lapses: 1,
    successes: 1,
    lastOutcome: "incorrect",
  });
  expect(saved.find((review) => review.uci === "e2e4")).toEqual(reviews[0]);
  expect(consoleMessages).toEqual([]);
});

test("an interrupted line retains only tested moves and alternatives are neutral", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn: "1. e4 (1. d4 d5) e5 2. Nf3 *", ...metadata }],
  });
  await page.goto(route("e2e4 e7e5 g1f3"));
  await expectTrainingInputReady(page);
  await pausePacingClock(page);
  await move(page, "d2", "d4");
  await advanceTrainingPacing(page, "showing-feedback", 1000);
  expect(await storedTrainingMoves(page)).toEqual([]);
  await move(page, "e2", "e4");
  await advanceTrainingPacing(page, "waiting-for-response", 500);
  await page.goto("/app/repertoires/white/main/train");
  await expect(page.getByText("0/2 trained")).toBeVisible();
  expect((await storedTrainingMoves(page)).map((review) => review.uci)).toEqual(["e2e4"]);
  expect(consoleMessages).toEqual([]);
});

test("a failed durable write restores input and never claims saved move progress", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
  });
  await page.goto(route("e2e4", 1));
  await expectTrainingInputReady(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === "training-move-schedules") {
        IDBObjectStore.prototype.put = original;
        throw new Error("Test move save failed");
      }
      return original.call(this, value, key);
    };
  });
  await move(page, "e2", "e4");
  await expect(page.getByText("Test move save failed", { exact: false })).toBeVisible();
  await expectTrainingInputReady(page);
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute("data-piece", "P");
  expect(await storedTrainingMoves(page)).toEqual([]);
  await move(page, "e2", "e4");
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  expect(await storedTrainingMoves(page)).toHaveLength(1);
  expect(consoleMessages).toEqual([]);
});

test("a game deviation keeps the original Train action and records moves in the background", async ({
  page,
}) => {
  const consoleMessages = collectUnexpectedConsole(page);
  await seedIndexedDb(page, {
    repertoires: [repertoire],
    chapters: [chapter],
    pgns: [{ id: "p", pgn, ...metadata }],
  });
  const gameId = await page.evaluate(async () => {
    const path = "/src/lib/games.ts";
    const games = (await import(/* @vite-ignore */ path)) as typeof import("../../src/lib/games");
    await games.importGames(
      '[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 2. Bc4 *',
      "Player",
      "white",
    );
    const result = await games.loadGames();
    if (!result.ok || result.games[0] === undefined) throw new Error("Missing game");
    return result.games[0].id;
  });
  await page.goto(`/app/games/${gameId}`);
  await expect(page.getByRole("link", { name: "Practice this position" })).toHaveCount(0);
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await expect(page).not.toHaveURL(/startMove=/);
  await expectTrainingInputReady(page);
  await pausePacingClock(page);
  await move(page, "e2", "e4");
  await advanceTrainingPacing(page, "waiting-for-response", 500);
  await expectTrainingInputReady(page);
  await move(page, "g1", "f3");
  await expect(page.locator('[data-training-flow-state="line-complete"]')).toBeVisible();
  expect((await storedTrainingMoves(page)).map((review) => review.uci).sort()).toEqual([
    "e2e4",
    "g1f3",
  ]);
  await expect(page.locator("[data-training-move-progress]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Practice this move" })).toHaveCount(0);
  expect(consoleMessages).toEqual([]);
});
