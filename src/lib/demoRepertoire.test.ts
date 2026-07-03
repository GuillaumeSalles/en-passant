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
      expect.arrayContaining(["d4", "Bf4", "e3", "Nf3", "O-O", "c4"]),
    );
    expect(Object.values(pgn.moves).filter((move) => move.next.length > 1)).toHaveLength(3);
    expect(serialized).toContain("{The London bishop reaches f4 before the e-pawn closes it in.}");
    expect(serialized).toContain("{This is the main central break to watch for.}");
  });
});
