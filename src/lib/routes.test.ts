import { expect, test } from "vitest";
import {
  firstRepertoireChapterPath,
  learningLinePath,
  parseMoveId,
  repertoireMovePath,
} from "./routes";

test("builds a learning line path", () => {
  expect(learningLinePath("white", "main", "v1-line")).toBe(
    "/app/repertoires/white/main/learn/v1-line",
  );
});

test("builds a chapter path that selects a move", () => {
  expect(repertoireMovePath("white", "main", 42)).toBe("/app/repertoires/white/main?moveId=42");
});

test("parses move ids from query strings", () => {
  expect(parseMoveId("42")).toBe(42);
  expect(parseMoveId("0")).toBe(0);
  expect(parseMoveId(undefined)).toBeNull();
  expect(parseMoveId("-1")).toBeNull();
  expect(parseMoveId("1.5")).toBeNull();
  expect(parseMoveId("move-1")).toBeNull();
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
