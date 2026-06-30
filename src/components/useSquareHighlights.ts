import { useSelector } from "@/lib/useSelector";
import type { Accessor } from "solid-js";
import {
  Move,
  SquareHighlightKind,
  SquareHighlights,
  getPgn,
  selectSelectedMoveId,
} from "@/lib/AppState";

function getSquaresHighlights(
  squares: SquareHighlights,
  moves: Record<number, Move>,
  selectedMoveId: number | null,
): { [square: string]: SquareHighlightKind } {
  if (selectedMoveId === null) {
    return squares;
  }

  const lastMove = moves[selectedMoveId];
  if (lastMove === undefined) {
    return squares;
  }

  return {
    ...squares,
    [lastMove.from]: "last-move",
    [lastMove.to]: "last-move",
  };
}

export function useSquareHighlights(): Accessor<{ [square: string]: SquareHighlightKind }> {
  return useSelector((state, ctx) => {
    const pgn = getPgn(state, ctx);
    if (pgn === null) {
      return {};
    }

    return getSquaresHighlights(
      state.highlights.squares,
      pgn.moves,
      selectSelectedMoveId(state, ctx),
    );
  });
}
