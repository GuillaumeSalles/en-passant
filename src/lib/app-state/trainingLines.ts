import type { Move, NormalizedPgn } from "./types";

export type TrainingLine = {
  id: string;
  terminalMoveId: number;
  plyCount: number;
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

export function getTrainingLines(pgn: NormalizedPgn): TrainingLine[] {
  const lines: TrainingLine[] = [];
  const path: Move[] = [];

  function visit(moveId: number): void {
    const move = pgn.moves[moveId];
    if (move === undefined) return;

    path.push(move);
    if (move.next.length === 0) {
      lines.push({
        id: trainingLineId(path),
        terminalMoveId: move.id,
        plyCount: path.length,
      });
    } else {
      for (const childId of move.next) visit(childId);
    }
    path.pop();
  }

  for (const rootMoveId of pgn.rootMoveIds) visit(rootMoveId);
  return lines;
}
