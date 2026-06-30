import { describe, expect, test } from "vitest";
import { mergePgns } from "./mergePgns";

describe("mergePgns", () => {
  test("keeps metadata from the first PGN", () => {
    const merged = mergePgns(
      `[Event "First"]
[Site "Home"]
[White "Alice"]

1. e4 e5 *`,
      `[Event "Second"]
[Site "Away"]
[Black "Bob"]

1. e4 c5 *`,
    );

    expect(merged).toBe(`[Event "First"]
[Site "Home"]
[White "Alice"]

1. e4 e5 (1... c5) *`);
  });

  test("adds missing branches from the second PGN", () => {
    const merged = mergePgns("1. e4 e5 2. Nf3 *", "1. e4 c5 2. Nf3 d6 *");

    expect(merged).toBe("1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 *");
  });

  test("keeps first PGN annotations and NAGs on matching moves", () => {
    const merged = mergePgns(
      "1. e4! {first after} 1... {first before} e5 $14 2. Nf3 *",
      "1. e4? {second after} 1... {second before} e5 $15 2. Nf3 *",
    );

    expect(merged).toBe("1. e4 $1 {first after} 1... {first before} e5 $14 2. Nf3 *");
  });

  test("fills missing annotations from the second PGN on matching moves", () => {
    const merged = mergePgns("1. e4 e5 2. Nf3 *", "1. e4! {king pawn} e5 2. Nf3 $14 *");

    expect(merged).toBe("1. e4 $1 {king pawn} e5 2. Nf3 $14 *");
  });

  test("keeps first PGN main line order when second PGN shares a variation", () => {
    const merged = mergePgns("1. d4 d5 (1... Nf6) 2. c4 *", "1. d4 Nf6 2. c4 *");

    expect(merged).toBe("1. d4 d5 (1... Nf6 2. c4) 2. c4 *");
  });
});
