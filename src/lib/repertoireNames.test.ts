import { describe, expect, test } from "vitest";
import {
  formatRepertoireName,
  limitRepertoireNameLength,
  MAX_REPERTOIRE_NAME_LENGTH,
} from "./repertoireNames";

describe("repertoire names", () => {
  test("limits names to 100 characters", () => {
    const longName = "A".repeat(MAX_REPERTOIRE_NAME_LENGTH + 1);
    expect(limitRepertoireNameLength(longName)).toHaveLength(MAX_REPERTOIRE_NAME_LENGTH);
  });

  test("trims before applying the fallback", () => {
    expect(formatRepertoireName("   ", "Untitled Repertoire")).toBe("Untitled Repertoire");
  });
});
