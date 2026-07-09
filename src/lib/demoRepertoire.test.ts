import { describe, expect, test } from "vitest";
import { createDemoRepertoireSeed, DEMO_REPERTOIRE_PGN } from "./demoRepertoire";
import { normalizePgn, toPgn } from "./AppState";

describe("createDemoRepertoireSeed", () => {
  test("creates the first-run demo repertoire and London System chapter", () => {
    const seed = createDemoRepertoireSeed();

    expect(seed.repertoire).toMatchObject({
      handle: "demo-repertoire",
      name: "Demo repertoire",
      orientation: "white",
    });
    expect(seed.chapter).toMatchObject({
      handle: "london-system",
      name: "London system",
      repertoireId: seed.repertoire.id,
    });
    expect(seed.chapter.pgnId).not.toBe(seed.repertoire.id);
    expect(seed.pgn).toBe(DEMO_REPERTOIRE_PGN);
  });

  test("contains legal London System variations and comments", () => {
    const pgn = normalizePgn(DEMO_REPERTOIRE_PGN);
    const serialized = toPgn(pgn);

    expect(Object.values(pgn.moves).map((move) => move.san)).toEqual(
      expect.arrayContaining(["d4", "Bf4", "e3", "Nf3", "c3", "Nbd2", "Bg3", "Bd3", "Ne5"]),
    );
    expect(
      Object.values(pgn.moves).reduce(
        (variationCount, move) => variationCount + Math.max(0, move.next.length - 1),
        0,
      ),
    ).toBe(3);
    expect(serialized).toContain("{Bishop out before e3.}");
    expect(serialized).toContain("{Meet ...c5 with c3.}");
  });
});
