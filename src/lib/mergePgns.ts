import { normalizePgn, toPgn } from "./app-state/pgnTree";
import type { Move, NormalizedPgn } from "./app-state/types";

type PgnTags = {
  lines: string[];
};

type MutableMergePgn = {
  rootMoveIds: number[];
  moves: Record<number, Move>;
  moveIdCounter: number;
  movesByParentAndSan: Map<number | null, Map<string, number>>;
};

export function mergePgns(firstPgn: string, secondPgn: string): string {
  const merger = new PgnMerger(firstPgn);
  merger.add(secondPgn);
  return merger.toPgn();
}

export class PgnMerger {
  readonly #tags: PgnTags;
  readonly #merged: MutableMergePgn;

  constructor(firstPgn: string) {
    this.#tags = parseTags(firstPgn);
    this.#merged = clonePgn(normalizePgn(firstPgn));
  }

  add(pgn: string): void {
    const source = normalizePgn(pgn);
    mergeMoveList(this.#merged, source, source.rootMoveIds, null);
  }

  toPgn(): string {
    return addTags(this.#tags, toPgn(this.#merged));
  }
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

  const merged = {
    rootMoveIds: [...pgn.rootMoveIds],
    moves,
    moveIdCounter: pgn.moveIdCounter,
    movesByParentAndSan: new Map<number | null, Map<string, number>>(),
  };
  indexMoveList(merged, null, merged.rootMoveIds);
  for (const move of Object.values(merged.moves)) {
    indexMoveList(merged, move.id, move.next);
  }

  return merged;
}

function cloneMove(move: Move): Move {
  return {
    ...move,
    metadata: [...move.metadata],
    nags: [...move.nags],
    next: [...move.next],
  };
}

function mergeMoveList(
  target: MutableMergePgn,
  source: NormalizedPgn,
  sourceMoveIds: number[],
  previousMoveId: number | null,
): void {
  const targetMoveIds =
    previousMoveId === null ? target.rootMoveIds : requireTargetMove(target, previousMoveId).next;
  const movesBySan = requireMoveIndex(target, previousMoveId);

  for (const sourceMoveId of sourceMoveIds) {
    const sourceMove = requireMove(source, sourceMoveId);
    const matchingMoveId = movesBySan.get(sourceMove.san);

    if (matchingMoveId === undefined) {
      const copiedMoveId = copyMoveTree(target, source, sourceMoveId, previousMoveId);
      targetMoveIds.push(copiedMoveId);
      movesBySan.set(sourceMove.san, copiedMoveId);
      continue;
    }

    const matchingMove = requireTargetMove(target, matchingMoveId);
    mergeMoveAnnotations(matchingMove, sourceMove);
    mergeMoveList(target, source, sourceMove.next, matchingMoveId);
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

function indexMoveList(
  pgn: MutableMergePgn,
  previousMoveId: number | null,
  moveIds: number[],
): void {
  const movesBySan = new Map<string, number>();
  for (const moveId of moveIds) {
    const move = requireTargetMove(pgn, moveId);
    if (!movesBySan.has(move.san)) {
      movesBySan.set(move.san, moveId);
    }
  }
  pgn.movesByParentAndSan.set(previousMoveId, movesBySan);
}

function requireMoveIndex(
  pgn: MutableMergePgn,
  previousMoveId: number | null,
): Map<string, number> {
  const movesBySan = pgn.movesByParentAndSan.get(previousMoveId);
  if (movesBySan === undefined) {
    const created = new Map<string, number>();
    pgn.movesByParentAndSan.set(previousMoveId, created);
    return created;
  }

  return movesBySan;
}

function mergeMoveAnnotations(targetMove: Move, sourceMove: Move): void {
  targetMove.commentBefore ??= sourceMove.commentBefore;
  targetMove.commentAfter ??= sourceMove.commentAfter;
  targetMove.clock ??= sourceMove.clock;
  targetMove.timeSpent ??= sourceMove.timeSpent;
  for (const metadata of sourceMove.metadata) {
    if (!targetMove.metadata.includes(metadata)) {
      targetMove.metadata.push(metadata);
    }
  }
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
  const copiedNextMovesBySan = requireMoveIndex(target, copiedMoveId);

  for (const sourceNextMoveId of sourceMove.next) {
    const copiedNextMoveId = copyMoveTree(target, source, sourceNextMoveId, copiedMoveId);
    requireTargetMove(target, copiedMoveId).next.push(copiedNextMoveId);
    const copiedNextMove = requireTargetMove(target, copiedNextMoveId);
    if (!copiedNextMovesBySan.has(copiedNextMove.san)) {
      copiedNextMovesBySan.set(copiedNextMove.san, copiedNextMoveId);
    }
  }

  return copiedMoveId;
}
