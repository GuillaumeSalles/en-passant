import { describe, expect, test } from "vitest";
import { handleFromName, uniqueHandle } from "./handles";

describe("handleFromName", () => {
  test("normalizes display names to URL handles", () => {
    expect(handleFromName("King Pawn Ideas", "untitled")).toBe("king-pawn-ideas");
    expect(handleFromName("  Café: King's Pawn!!  ", "untitled")).toBe("cafe-king-s-pawn");
  });

  test("uses the fallback when the name has no URL-safe content", () => {
    expect(handleFromName("...", "untitled")).toBe("untitled");
  });
});

describe("uniqueHandle", () => {
  test("keeps an unused handle", () => {
    expect(uniqueHandle("king-pawn", ["queen-pawn"])).toBe("king-pawn");
  });

  test("adds the next available suffix for conflicts", () => {
    expect(uniqueHandle("king-pawn", ["king-pawn", "king-pawn-1", "king-pawn-3"])).toBe(
      "king-pawn-2",
    );
  });
});
