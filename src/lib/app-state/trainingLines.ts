import type { Move, NormalizedPgn, Orientation } from "./types";

export type TrainingLine = {
  id: string;
  uciPath: string;
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
const PROMOTIONS_BY_CODE: Record<number, string> = {
  1: "q",
  2: "r",
  3: "b",
  4: "n",
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

type EncodableMove = Pick<Move, "from" | "to" | "promotion">;

export function trainingLineId(moves: readonly EncodableMove[]): string {
  const bytes = new Uint8Array(moves.length * 2);
  moves.forEach((move, index) => {
    const promotion = move.promotion === null ? 0 : (PROMOTION_CODES[move.promotion] ?? 0);
    const value = squareCode(move.from) | (squareCode(move.to) << 6) | (promotion << 12);
    bytes[index * 2] = value >> 8;
    bytes[index * 2 + 1] = value & 255;
  });
  return `v1-${encodeBytes(bytes)}`;
}

export function trainingLineIdFromUciPath(uciPath: string): string | null {
  const moves = uciPath.split(" ").map((uci) => {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    return {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length === 5 ? uci.charAt(4) : null,
    };
  });
  return moves.some((move) => move === null)
    ? null
    : trainingLineId(moves.filter((move) => move !== null));
}

function decodeCharacters(value: string): Uint8Array | null {
  if (value.length === 0) return null;
  const bytes: number[] = [];
  let bits = 0;
  let bitCount = 0;
  for (const character of value) {
    const code = BASE64_URL_ALPHABET.indexOf(character);
    if (code < 0) return null;
    bits = bits * 64 + code;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push(Math.floor(bits / 2 ** bitCount) & 255);
      bits %= 2 ** bitCount;
    }
  }
  return bitCount > 0 && bits !== 0 ? null : new Uint8Array(bytes);
}

function squareFromCode(code: number): string | null {
  if (code < 0 || code > 63) return null;
  return `${String.fromCharCode("a".charCodeAt(0) + (code % 8))}${Math.floor(code / 8) + 1}`;
}

export function trainingLineUciPathFromId(lineId: string): string | null {
  if (!lineId.startsWith("v1-")) return null;
  const bytes = decodeCharacters(lineId.slice(3));
  if (bytes === null || bytes.length === 0 || bytes.length % 2 !== 0) return null;

  const moves: string[] = [];
  for (let index = 0; index < bytes.length; index += 2) {
    const first = bytes[index];
    const second = bytes[index + 1];
    if (first === undefined || second === undefined) return null;
    const value = (first << 8) | second;
    const from = squareFromCode(value & 63);
    const to = squareFromCode((value >> 6) & 63);
    const promotionCode = (value >> 12) & 15;
    const promotion = promotionCode === 0 ? "" : PROMOTIONS_BY_CODE[promotionCode];
    if (from === null || to === null || promotion === undefined) return null;
    moves.push(`${from}${to}${promotion}`);
  }
  return moves.join(" ");
}

export function trainingLineUciPath(moves: readonly Move[]): string {
  return moves.map((move) => `${move.from}${move.to}${move.promotion ?? ""}`).join(" ");
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
        uciPath: trainingLineUciPath(path),
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

function variationMoveIds(pgn: NormalizedPgn, terminalMoveId: number): number[] {
  const moveIds: number[] = [];
  let moveId: number | null = terminalMoveId;
  while (moveId !== null) {
    const move: Move | undefined = pgn.moves[moveId];
    if (move === undefined) return [];
    moveIds.unshift(moveId);
    moveId = move.prev;
  }
  return moveIds;
}

export function getTrainingLineByUciPath(
  pgn: NormalizedPgn,
  orientation: Orientation,
  uciPath: string,
): TrainingLine | undefined {
  const requestedMoves = uciPath.split(" ");
  if (requestedMoves.length === 0) return undefined;
  const leaf = getTrainingLines(pgn, orientation).find(
    (line) => line.uciPath === uciPath || line.uciPath.startsWith(`${uciPath} `),
  );
  if (leaf === undefined) return undefined;

  const moveIds = variationMoveIds(pgn, leaf.terminalMoveId).slice(0, requestedMoves.length);
  const moves = moveIds.map((moveId) => pgn.moves[moveId]).filter((move) => move !== undefined);
  if (moves.length !== requestedMoves.length || trainingLineUciPath(moves) !== uciPath) {
    return undefined;
  }
  const terminalMove = moves.at(-1);
  if (terminalMove === undefined) return undefined;

  return {
    id: trainingLineId(moves),
    uciPath,
    terminalMoveId: terminalMove.id,
    plyCount: moves.length,
    isAlternative: leaf.isAlternative,
  };
}

export function getTrainingLinesWithScheduledPaths(
  pgn: NormalizedPgn,
  orientation: Orientation,
  scheduledUciPaths: readonly string[],
): TrainingLine[] {
  const lines = getTrainingLines(pgn, orientation);
  const paths = new Set(lines.map((line) => line.uciPath));
  for (const uciPath of scheduledUciPaths) {
    if (paths.has(uciPath)) continue;
    const line = getTrainingLineByUciPath(pgn, orientation, uciPath);
    if (line === undefined) continue;
    lines.push(line);
    paths.add(uciPath);
  }
  return lines;
}
