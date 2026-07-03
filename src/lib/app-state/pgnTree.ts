import { applySan, clonePosition, createChessPosition, fen as positionToFen } from "@/lib/chess";
import { parsePgnMoves, type ParsedPgnMove } from "@/lib/pgn-parser";
import { normalizeNags } from "./nags";
import {
  createReactiveNormalizedPgn,
  movesFromIds,
  requireMove,
  requireMoveId,
} from "./reactivePgn";
import type { Move, NormalizedPgn } from "./types";

export function getVariationsEnds(normalizedPgn: NormalizedPgn): number[] {
  const ends: number[] = [];

  for (const id in normalizedPgn.moves) {
    const move = normalizedPgn.moves[id];
    if (move === undefined) continue;

    if (move.next.length === 0) {
      ends.push(move.id);
    }
  }

  return ends;
}

export function normalizePgn(pgn: string): NormalizedPgn {
  let moveIdCounter = 0;

  const pgnMoves = parsePgnMoves(pgn);

  const moves: Record<string, Move> = {};
  const position = createChessPosition();

  function addLine(
    line: ParsedPgnMove[],
    startingPosition: ReturnType<typeof createChessPosition>,
    prevMove: Move | null,
  ) {
    let previousMove = prevMove;
    const position = clonePosition(startingPosition);

    for (const pgnMove of line) {
      for (let i = pgnMove.variations.length - 1; i >= 0; i--) {
        const variation = pgnMove.variations[i];
        if (variation === undefined) continue;

        addLine(variation, position, previousMove);
      }

      const parsedMove = applySan(position, pgnMove.notation.notation);

      const move: Move = {
        id: moveIdCounter,
        san: pgnMove.notation.notation,
        nags: normalizeNags(pgnMove.nags),
        fen: positionToFen(position),
        from: parsedMove.from,
        to: parsedMove.to,
        promotion: parsedMove.promotion,
        next: [],
        prev: previousMove?.id ?? null,
        halfMoveNumber: previousMove ? previousMove.halfMoveNumber + 1 : 0,
        commentBefore: pgnMove.commentBefore ?? null,
        commentAfter: pgnMove.commentAfter ?? null,
      };

      if (previousMove !== null) {
        previousMove.next.unshift(moveIdCounter);
      } else {
        rootMoveIds.unshift(moveIdCounter);
      }

      previousMove = move;

      moves[moveIdCounter] = move;

      moveIdCounter++;
    }
  }

  const rootMoveIds: number[] = [];

  addLine(pgnMoves, position, null);

  return createReactiveNormalizedPgn({
    rootMoveIds,
    moves,
    moveIdCounter,
  });
}

export function getMoveNumber(move: Move) {
  return Math.floor(move.halfMoveNumber / 2) + 1;
}

export function isMoveWhite(move: Move) {
  return move.halfMoveNumber % 2 === 0;
}

export function toPgn(normalizedPgn: NormalizedPgn): string {
  if (normalizedPgn.rootMoveIds.length === 0) {
    return "";
  }

  function addMove(
    main: Move,
    variations: Move[],
    options: { forceBlackMoveNumber?: boolean } = {},
  ): string {
    let result = "";
    const isWhite = isMoveWhite(main);
    const moveNumber = getMoveNumber(main);

    if (isWhite) {
      result += `${moveNumber}. `;
    } else if (options.forceBlackMoveNumber || main.commentBefore) {
      result += `${moveNumber}... `;
    }

    if (main.commentBefore) {
      result += `{${main.commentBefore}} `;
    }

    result += `${main.san}`;

    if (main.nags.length > 0) {
      result += ` ${main.nags.map((nag) => `$${nag}`).join(" ")}`;
    }

    if (main.commentAfter) {
      result += ` {${main.commentAfter}}`;
    }

    if (variations.length > 0) {
      result += " ";
    }

    result += variations
      .map(
        (variation) =>
          `(${addMove(variation, [], {
            forceBlackMoveNumber: !isMoveWhite(variation),
          })})`,
      )
      .join(" ");

    if (main.next.length === 0) {
      return result;
    }

    result += " ";

    const nextMain = requireMove(normalizedPgn.moves, requireMoveId(main.next[0]));

    return (
      result +
      addMove(nextMain, movesFromIds(normalizedPgn.moves, main.next.slice(1)), {
        forceBlackMoveNumber: variations.length > 0 && isWhite,
      })
    );
  }

  return (
    addMove(
      requireMove(normalizedPgn.moves, requireMoveId(normalizedPgn.rootMoveIds[0])),
      movesFromIds(normalizedPgn.moves, normalizedPgn.rootMoveIds.slice(1)),
    ) + " *"
  );
}
