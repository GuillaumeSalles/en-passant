import {
  applySan,
  clonePosition,
  createChessPosition,
  positionKey,
  type ChessPosition,
} from "./chess";
import { parsePgnMoves, parsePgnTags, type ParsedPgnMove } from "./pgn-parser";

// An occurrence belongs to a document. Position keys are shared across documents,
// but comments, variation order, and training paths still belong to occurrences.
export type MoveOccurrence = {
  id: string;
  sourceId: string;
  moveId: number;
  parentMoveId: number | null;
  variationIndex: number;
  ply: number;
  beforeKey: string;
  afterKey: string;
  uci: string;
  san: string;
};

export function indexPgnMoves(
  sourceId: string,
  pgn: string,
  mode: "tree" | "mainline",
): MoveOccurrence[] {
  const result: MoveOccurrence[] = [];
  const siblingCounts = new Map<number | null, number>();
  const position = createChessPosition(parsePgnTags(pgn)["FEN"]);

  function visit(line: ParsedPgnMove[], start: ChessPosition, parent: MoveOccurrence | null) {
    const position = clonePosition(start);
    let previous = parent;
    for (const parsed of line) {
      const beforeKey = previous?.afterKey ?? positionKey(position);
      const before = clonePosition(position);
      const applied = applySan(position, parsed.notation.notation);
      const moveId = result.length;
      const parentMoveId = previous?.moveId ?? null;
      const variationIndex = siblingCounts.get(parentMoveId) ?? 0;
      siblingCounts.set(parentMoveId, variationIndex + 1);
      const move: MoveOccurrence = {
        id: JSON.stringify([sourceId, moveId]),
        sourceId,
        moveId,
        parentMoveId,
        variationIndex,
        ply: (previous?.ply ?? 0) + 1,
        beforeKey,
        afterKey: positionKey(position),
        uci: `${applied.from}${applied.to}${applied.promotion ?? ""}`,
        san: parsed.notation.notation,
      };
      result.push(move);
      if (mode === "tree") {
        parsed.variations.forEach((variation) => {
          visit(variation, before, previous);
        });
      }
      previous = move;
    }
  }

  visit(parsePgnMoves(pgn), position, null);
  return result;
}

export function moveChildren(moves: readonly MoveOccurrence[]) {
  const children = new Map<number | null, MoveOccurrence[]>();
  for (const move of moves) {
    const siblings = children.get(move.parentMoveId) ?? [];
    siblings.push(move);
    children.set(move.parentMoveId, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.variationIndex - b.variationIndex);
  }
  return children;
}
