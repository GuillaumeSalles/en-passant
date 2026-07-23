import { describe, expect, test } from "vitest";
import { applyMove, applySan, createChessPosition, fen, isMoveLegal, STARTING_FEN } from "./chess";

describe("chess rules", () => {
  test("starts from the standard position", () => {
    expect(fen(createChessPosition())).toBe(STARTING_FEN);
  });

  test("applies SAN and tracks FEN metadata", () => {
    const position = createChessPosition();

    expect(applySan(position, "e4")).toMatchObject({
      from: "e2",
      to: "e4",
      san: "e4",
      promotion: null,
    });
    expect(fen(position)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");

    expect(applySan(position, "e5")).toMatchObject({
      from: "e7",
      to: "e5",
      san: "e5",
    });
    expect(fen(position)).toBe("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2");
  });

  test("rejects illegal moves", () => {
    const position = createChessPosition();

    expect(isMoveLegal(position, { from: "e2", to: "e5" })).toBe(false);
    expect(() => applyMove(position, { from: "e2", to: "e5" })).toThrow(/Illegal move/);
  });

  test("generates castling SAN and updates rook position", () => {
    const position = createChessPosition("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");

    expect(applyMove(position, { from: "e1", to: "g1" })).toMatchObject({
      san: "O-O",
      animation: {
        movements: [
          { piece: "K", from: "e1", to: "g1" },
          { piece: "R", from: "h1", to: "f1" },
        ],
      },
    });
    expect(fen(position)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");

    expect(applyMove(position, { from: "e8", to: "c8" })).toMatchObject({
      san: "O-O-O",
    });
    expect(fen(position)).toBe("2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2");
  });

  test("applies en passant captures", () => {
    const position = createChessPosition();

    applySan(position, "e4");
    applySan(position, "a6");
    applySan(position, "e5");
    applySan(position, "d5");

    expect(applyMove(position, { from: "e5", to: "d6" })).toMatchObject({
      san: "exd6",
      from: "e5",
      to: "d6",
      animation: {
        captures: [{ piece: "p", square: "d5" }],
      },
    });
    expect(fen(position)).toBe("rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3");
  });

  test("generates promotion SAN with check", () => {
    const position = createChessPosition("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");

    expect(applyMove(position, { from: "a7", to: "a8", promotion: "q" })).toMatchObject({
      san: "a8=Q+",
      promotion: "q",
      animation: {
        movements: [{ piece: "P", from: "a7", to: "a8" }],
        promotion: { piece: "Q", square: "a8" },
      },
    });
  });

  test("disambiguates piece moves", () => {
    const position = createChessPosition(
      "rnbqkbnr/pppppppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1",
    );

    expect(applyMove(position, { from: "b1", to: "d2" })).toMatchObject({
      san: "Nbd2",
    });
  });

  test("accepts redundant SAN disambiguation when only one move is legal", () => {
    const position = createChessPosition();
    for (const san of [
      "e4",
      "c5",
      "Nf3",
      "Nc6",
      "b4",
      "cxb4",
      "d4",
      "d5",
      "exd5",
      "Qxd5",
      "c4",
      "bxc3",
      "Nxc3",
      "Qa5",
      "Rb1",
      "e6",
      "Bd2",
      "Qd8",
      "Bb5",
      "Bd6",
      "Ne4",
      "Bc7",
      "O-O",
    ]) {
      applySan(position, san);
    }

    expect(applySan(position, "Nge7")).toMatchObject({
      san: "Ne7",
      from: "g8",
      to: "e7",
    });
  });

  test("adds checkmate suffix", () => {
    const position = createChessPosition();

    applySan(position, "f3");
    applySan(position, "e5");
    applySan(position, "g4");

    expect(applySan(position, "Qh4#")).toMatchObject({
      san: "Qh4#",
    });
  });
});
