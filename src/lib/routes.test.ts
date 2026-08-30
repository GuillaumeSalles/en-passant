import { expect, test } from "vitest";
import {
  chapterTrainingLineReviewPath,
  firstRepertoireChapterPath,
  learningLinePath,
  lineReaderPath,
  parseSelectedPositionKey,
  parseTrainingStartMove,
  repertoireMovePath,
  trainingLinePath,
  trainingLineReviewPath,
  trainingQueueReviewPath,
} from "./routes";

test("builds a read-only line path from handles", () => {
  expect(lineReaderPath("white-repertoire", "main-line", "v1-line")).toBe(
    "/app/white-repertoire/main-line/v1-line",
  );
});

test("builds a learning line path", () => {
  expect(learningLinePath("white", "main", "v1-line")).toBe("/app/white/main/v1-line/learn");
});

test("builds a training line path from a specific move", () => {
  expect(trainingLinePath("white", "main", "v1-line", { startMove: 12 })).toBe(
    "/app/white/main/v1-line/train?startMove=12",
  );
});

test("parses training start moves from query strings", () => {
  expect(parseTrainingStartMove("12")).toBe(12);
  expect(parseTrainingStartMove(null)).toBeNull();
  expect(parseTrainingStartMove(undefined)).toBeNull();
  expect(parseTrainingStartMove("0")).toBeNull();
  expect(parseTrainingStartMove("01")).toBeNull();
  expect(parseTrainingStartMove("1.5")).toBeNull();
  expect(parseTrainingStartMove("move-12")).toBeNull();
  expect(parseTrainingStartMove("9007199254740992")).toBeNull();
});

test("builds paths for reviewing all due lines", () => {
  expect(trainingQueueReviewPath()).toBe("/app/training?review=due");
  expect(trainingLineReviewPath("white", "main", "v1-line")).toBe(
    "/app/white/main/v1-line/train?review=due",
  );
});

test("builds a path for reviewing due lines in one chapter", () => {
  expect(chapterTrainingLineReviewPath("white", "main", "v1-line")).toBe(
    "/app/white/main/v1-line/train?review=chapter",
  );
});

test("builds a chapter path that selects a move", () => {
  expect(
    repertoireMovePath("white", "main", "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"),
  ).toBe(
    "/app/repertoires/white/main?selectedPositionKey=rnbqkbnr%2Fpppp1ppp%2F8%2F4p3%2F4P3%2F8%2FPPPP1PPP%2FRNBQKBNR%20w%20KQkq%20-",
  );
});

test("parses selected position keys from query strings", () => {
  const key = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -";
  expect(parseSelectedPositionKey(key)).toBe(key);
  expect(parseSelectedPositionKey(undefined)).toBeNull();
  expect(parseSelectedPositionKey("")).toBeNull();
  expect(parseSelectedPositionKey(`${key} 0 1`)).toBeNull();
  expect(parseSelectedPositionKey("not-a-position")).toBeNull();
});

test("builds a path for the alphabetically first chapter of the alphabetically first repertoire", () => {
  expect(
    firstRepertoireChapterPath(
      [
        { id: "second-repertoire", handle: "second", name: "Zebra repertoire" },
        { id: "first-repertoire", handle: "first", name: "Alpha repertoire" },
      ],
      [
        {
          id: "second-chapter",
          repertoireId: "first-repertoire",
          handle: "second-chapter",
          name: "Zebra chapter",
        },
        {
          id: "first-chapter",
          repertoireId: "first-repertoire",
          handle: "first-chapter",
          name: "Alpha chapter",
        },
        {
          id: "other-repertoire-chapter",
          repertoireId: "second-repertoire",
          handle: "other-repertoire-chapter",
          name: "A chapter in another repertoire",
        },
      ],
    ),
  ).toBe("/app/repertoires/first/first-chapter");
});

test("does not build a path when the first repertoire has no chapter", () => {
  expect(
    firstRepertoireChapterPath(
      [{ id: "first-repertoire", handle: "first", name: "Alpha repertoire" }],
      [
        {
          id: "chapter",
          repertoireId: "second-repertoire",
          handle: "chapter-1",
          name: "Chapter 1",
        },
      ],
    ),
  ).toBeNull();
});
