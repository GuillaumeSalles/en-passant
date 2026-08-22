import { createChessPosition, positionKey } from "../chess";
import type { Move, NormalizedPgn } from "./types";

export type Opening = {
  eco: string;
  name: string;
};

export type OpeningIndex = ReadonlyMap<string, Opening>;

export function findOpening(
  pgn: NormalizedPgn,
  terminalMoveId: number,
  openings: OpeningIndex,
): Opening | undefined {
  let moveId: number | null = terminalMoveId;
  while (moveId !== null) {
    const move: Move | undefined = pgn.moves[moveId];
    if (move === undefined) return undefined;

    const opening = openings.get(positionKey(createChessPosition(move.fen)));
    if (opening !== undefined) return opening;
    moveId = move.prev;
  }
  return undefined;
}
