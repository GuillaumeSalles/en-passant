import type { Move, NormalizedPgn, Orientation } from "./types";

export type TrainingLine = {
  id: string;
  terminalMoveId: number;
  plyCount: number;
  isAlternative: boolean;
};

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const PROMOTION_CODES: Record<string, number> = {
  q: 1,
  r: 2,
  b: 3,
  n: 4,
};

function squareCode(square: string): number {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    throw new Error(`Invalid move square: ${square}`);
  }
  return rank * 8 + file;
}

function encodeBytes(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = first * 65_536 + (second ?? 0) * 256 + (third ?? 0);

    result += BASE64_URL_ALPHABET[(value >> 18) & 63];
    result += BASE64_URL_ALPHABET[(value >> 12) & 63];
    if (second !== undefined) result += BASE64_URL_ALPHABET[(value >> 6) & 63];
    if (third !== undefined) result += BASE64_URL_ALPHABET[value & 63];
  }
  return result;
}

export function trainingLineId(moves: readonly Move[]): string {
  const bytes = new Uint8Array(moves.length * 2);
  moves.forEach((move, index) => {
    const promotion = move.promotion === null ? 0 : (PROMOTION_CODES[move.promotion] ?? 0);
    const value = squareCode(move.from) | (squareCode(move.to) << 6) | (promotion << 12);
    bytes[index * 2] = value >> 8;
    bytes[index * 2 + 1] = value & 255;
  });
  return `v1-${encodeBytes(bytes)}`;
}

function isUserMove(move: Move, orientation: Orientation): boolean {
  return (move.halfMoveNumber % 2 === 0 ? "white" : "black") === orientation;
}

export function isAlternativeTrainingMove(
  pgn: NormalizedPgn,
  expectedMoveId: number,
  orientation: Orientation,
  from: string,
  to: string,
): boolean {
  const expectedMove = pgn.moves[expectedMoveId];
  if (expectedMove === undefined || !isUserMove(expectedMove, orientation)) return false;

  const siblingIds =
    expectedMove.prev === null ? pgn.rootMoveIds : (pgn.moves[expectedMove.prev]?.next ?? []);
  return siblingIds.some((moveId) => {
    if (moveId === expectedMoveId) return false;
    const move = pgn.moves[moveId];
    return move?.from === from && move.to === to;
  });
}

export function getTrainingLines(pgn: NormalizedPgn, orientation: Orientation): TrainingLine[] {
  const lines: TrainingLine[] = [];
  const path: Move[] = [];

  function visit(moveId: number, isAlternative: boolean): void {
    const move = pgn.moves[moveId];
    if (move === undefined) return;

    path.push(move);
    if (move.next.length === 0) {
      lines.push({
        id: trainingLineId(path),
        terminalMoveId: move.id,
        plyCount: path.length,
        isAlternative,
      });
    } else {
      move.next.forEach((childId, index) => {
        const child = pgn.moves[childId];
        visit(
          childId,
          isAlternative || (index > 0 && child !== undefined && isUserMove(child, orientation)),
        );
      });
    }
    path.pop();
  }

  pgn.rootMoveIds.forEach((rootMoveId, index) => {
    const move = pgn.moves[rootMoveId];
    visit(rootMoveId, index > 0 && move !== undefined && isUserMove(move, orientation));
  });
  return lines;
}
