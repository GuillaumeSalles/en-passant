import { expect, test } from "vitest";
import {
  firstRepertoireChapterPath,
  learningLinePath,
  parseSelectedPositionKey,
  repertoireMovePath,
} from "./routes";

test("builds a learning line path", () => {
  expect(learningLinePath("white", "main", "v1-line")).toBe(
    "/app/repertoires/white/main/learn/v1-line",
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
