import { expect, test } from "vitest";
import { getTrainingMoveTargets, nextTrainingMoveReview, normalizePgn } from "@/lib/AppState";
import { createMutationContext } from "@/tests/mocks";
import { recordTrainingMove } from "./trainingMove";

function setup() {
  const pgn = normalizePgn("1. e4 e5 2. Nf3 *");
  const context = createMutationContext(
    {
      repertoires: {
        status: "success",
        data: { r: { id: "r", handle: "r", name: "White", orientation: "white" } },
      },
      chapters: {
        status: "success",
        data: { c: { id: "c", handle: "c", repertoireId: "r", name: "Main", pgnId: "p" } },
      },
      pgns: { p: { status: "success", data: pgn } },
    },
    { type: "variation-training", repertoireHandle: "r", chapterHandle: "c" },
  );
  const target = getTrainingMoveTargets("r", pgn, "white")[1];
  if (target === undefined) throw new Error("Missing target");
  return { context, target };
}

test("publishes only durable move progress and leaves legacy line schedules untouched", async () => {
  const { context, target } = setup();
  const review = nextTrainingMoveReview(target, undefined, "correct", 123);
  let finish: () => void = () => {
    throw new Error("Save did not start");
  };
  context.storage.recordTrainingMoveAttempts.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve([review]);
      }),
  );
  const pending = recordTrainingMove(context, { moveId: target.moveId, outcome: "correct" });
  expect(context.state.training.moveReviews).toEqual({});
  expect(context.storage.recordTrainingMoveAttempts).toHaveBeenCalledWith([
    expect.objectContaining({ chapterId: "c", uciPath: "e2e4 e7e5 g1f3", outcome: "correct" }),
  ]);
  finish();
  await pending;
  expect(context.state.training.moveReviews[target.key]).toEqual(review);
  expect(context.storage.saveTrainingLineSchedule).not.toHaveBeenCalled();
});

test("failed persistence cannot claim a successful save", async () => {
  const { context, target } = setup();
  context.storage.recordTrainingMoveAttempts.mockRejectedValue(new Error("Disk full"));
  await expect(
    recordTrainingMove(context, { moveId: target.moveId, outcome: "incorrect" }),
  ).rejects.toThrow("Disk full");
  expect(context.state.training.moveReviews).toEqual({});
});

test("missing chapters and move IDs do not write progress", async () => {
  const { context } = setup();
  await expect(recordTrainingMove(context, { moveId: 999, outcome: "correct" })).rejects.toThrow(
    "no longer available",
  );
  expect(context.storage.recordTrainingMoveAttempts).not.toHaveBeenCalled();
  context.state.set("chapters", { status: "success", data: {} });
  await expect(recordTrainingMove(context, { moveId: 0, outcome: "correct" })).rejects.toThrow(
    "no longer available",
  );
});
