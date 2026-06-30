import { normalizePgn, toPgn } from "./app-state/pgnTree";
import type { Move, NormalizedPgn } from "./app-state/types";

type PgnTags = {
  lines: string[];
};

type MutableMergePgn = {
  rootMoveIds: number[];
  moves: Record<number, Move>;
  moveIdCounter: number;
};

export function mergePgns(firstPgn: string, secondPgn: string): string {
  const first = normalizePgn(firstPgn);
  const second = normalizePgn(secondPgn);
  const merged = clonePgn(first);

  mergeMoveList(merged, merged.rootMoveIds, second, second.rootMoveIds, null);

  return addTags(parseTags(firstPgn), toPgn(merged));
}

function parseTags(pgn: string): PgnTags {
  return {
    lines: pgn
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("[") && line.endsWith("]")),
  };
}

function addTags(tags: PgnTags, moves: string): string {
  if (tags.lines.length === 0) {
    return moves;
  }

  return `${tags.lines.join("\n")}\n\n${moves}`;
}

function clonePgn(pgn: NormalizedPgn): MutableMergePgn {
  const moves: Record<number, Move> = {};

  for (const move of Object.values(pgn.moves)) {
    moves[move.id] = cloneMove(move);
  }

  return {
    rootMoveIds: [...pgn.rootMoveIds],
    moves,
    moveIdCounter: pgn.moveIdCounter,
  };
}

function cloneMove(move: Move): Move {
  return {
    ...move,
    nags: [...move.nags],
    next: [...move.next],
  };
}

function mergeMoveList(
  target: MutableMergePgn,
  targetMoveIds: number[],
  source: NormalizedPgn,
  sourceMoveIds: number[],
  previousMoveId: number | null,
): void {
  for (const sourceMoveId of sourceMoveIds) {
    const sourceMove = requireMove(source, sourceMoveId);
    const matchingMoveId = findMoveBySan(target, targetMoveIds, sourceMove.san);

    if (matchingMoveId === null) {
      const copiedMoveId = copyMoveTree(target, source, sourceMoveId, previousMoveId);
      targetMoveIds.push(copiedMoveId);
      continue;
    }

    const matchingMove = requireTargetMove(target, matchingMoveId);
    mergeMoveAnnotations(matchingMove, sourceMove);
    mergeMoveList(target, matchingMove.next, source, sourceMove.next, matchingMoveId);
  }
}

function requireMove(pgn: NormalizedPgn, moveId: number): Move {
  const move = pgn.moves[moveId];
  if (move === undefined) {
    throw new Error(`Missing PGN move ${moveId}`);
  }

  return move;
}

function requireTargetMove(pgn: MutableMergePgn, moveId: number): Move {
  const move = pgn.moves[moveId];
  if (move === undefined) {
    throw new Error(`Missing merged PGN move ${moveId}`);
  }

  return move;
}

function findMoveBySan(pgn: MutableMergePgn, moveIds: number[], san: string): number | null {
  return moveIds.find((moveId) => pgn.moves[moveId]?.san === san) ?? null;
}

function mergeMoveAnnotations(targetMove: Move, sourceMove: Move): void {
  targetMove.commentBefore ??= sourceMove.commentBefore;
  targetMove.commentAfter ??= sourceMove.commentAfter;
  if (targetMove.nags.length === 0) {
    targetMove.nags = [...sourceMove.nags];
  }
}

function copyMoveTree(
  target: MutableMergePgn,
  source: NormalizedPgn,
  sourceMoveId: number,
  previousMoveId: number | null,
): number {
  const sourceMove = requireMove(source, sourceMoveId);
  const copiedMoveId = target.moveIdCounter;
  target.moveIdCounter += 1;

  target.moves[copiedMoveId] = {
    ...cloneMove(sourceMove),
    id: copiedMoveId,
    prev: previousMoveId,
    next: [],
  };

  for (const sourceNextMoveId of sourceMove.next) {
    const copiedNextMoveId = copyMoveTree(target, source, sourceNextMoveId, copiedMoveId);
    requireTargetMove(target, copiedMoveId).next.push(copiedNextMoveId);
  }

  return copiedMoveId;
}
