import { expect, test } from "vitest";
import { firstRepertoireChapterPath } from "./routes";

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
