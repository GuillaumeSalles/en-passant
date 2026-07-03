import { createSignal } from "solid-js";
import type { Move, NormalizedPgn } from "./types";

type SignalEntry = {
  get: () => number;
  set: (value: number | ((currentValue: number) => number)) => number;
};

type ReactivePgnControls = {
  setRootMoveIds: (rootMoveIds: number[]) => void;
  setMoveIdCounter: (moveIdCounter: number) => void;
  setMove: (move: Move) => void;
  deleteMove: (moveId: number) => void;
};

const reactivePgnControls = Symbol("reactivePgnControls");

type ReactiveNormalizedPgn = NormalizedPgn & {
  [reactivePgnControls]: ReactivePgnControls;
};

function hasOwnKey<T extends object>(object: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function createVersionSignal(): SignalEntry {
  const [get, set] = createSignal(0, { equals: false });
  return { get, set };
}

function bumpVersion(signal: SignalEntry): void {
  signal.set((version) => version + 1);
}

export function requireMove(moves: Record<number, Move>, moveId: number): Move {
  const move = moves[moveId];
  if (move === undefined) {
    throw new Error(`Missing normalized PGN move ${moveId}`);
  }
  return move;
}

export function requireMoveId(moveId: number | undefined): number {
  if (moveId === undefined) {
    throw new Error("Missing normalized PGN move id");
  }
  return moveId;
}

export function movesFromIds(moves: Record<number, Move>, moveIds: number[]): Move[] {
  return moveIds.map((moveId) => requireMove(moves, moveId));
}

function requireSignal(signals: Record<number, SignalEntry>, moveId: number): SignalEntry {
  const signal = signals[moveId];
  if (signal === undefined) {
    throw new Error(`Missing normalized PGN move signal ${moveId}`);
  }
  return signal;
}

export function emptyNormalizedPgn(): NormalizedPgn {
  return createReactiveNormalizedPgn({
    rootMoveIds: [],
    moves: {},
    moveIdCounter: 0,
  });
}

export function createReactiveNormalizedPgn({
  rootMoveIds: initialRootMoveIds,
  moves: initialMoves,
  moveIdCounter: initialMoveIdCounter,
}: NormalizedPgn): NormalizedPgn {
  let rootMoveIds = initialRootMoveIds;
  let moveIdCounter = initialMoveIdCounter;
  const moveValues = { ...initialMoves };
  const moveSignals: Record<number, SignalEntry> = {};
  const rootMoveIdsVersion = createVersionSignal();
  const moveIdCounterVersion = createVersionSignal();
  const moveRecordVersion = createVersionSignal();

  const moves = {} as Record<number, Move>;

  function addMoveProperty(moveId: number): void {
    if (hasOwnKey(moves, moveId)) {
      return;
    }

    moveSignals[moveId] = createVersionSignal();

    Object.defineProperty(moves, moveId, {
      enumerable: true,
      configurable: true,
      get: () => {
        requireSignal(moveSignals, moveId).get();
        return requireMove(moveValues, moveId);
      },
    });
  }

  for (const moveId of Object.keys(moveValues).map(Number)) {
    addMoveProperty(moveId);
  }

  const pgn = {} as ReactiveNormalizedPgn;
  Object.defineProperty(pgn, "rootMoveIds", {
    enumerable: true,
    get: () => {
      rootMoveIdsVersion.get();
      return rootMoveIds;
    },
  });
  Object.defineProperty(pgn, "moves", {
    enumerable: true,
    get: () => {
      moveRecordVersion.get();
      return moves;
    },
  });
  Object.defineProperty(pgn, "moveIdCounter", {
    enumerable: true,
    get: () => {
      moveIdCounterVersion.get();
      return moveIdCounter;
    },
  });
  Object.defineProperty(pgn, reactivePgnControls, {
    enumerable: false,
    value: {
      setRootMoveIds: (nextRootMoveIds: number[]) => {
        if (nextRootMoveIds === rootMoveIds) return;
        rootMoveIds = nextRootMoveIds;
        bumpVersion(rootMoveIdsVersion);
      },
      setMoveIdCounter: (nextMoveIdCounter: number) => {
        if (nextMoveIdCounter === moveIdCounter) return;
        moveIdCounter = nextMoveIdCounter;
        bumpVersion(moveIdCounterVersion);
      },
      setMove: (move: Move) => {
        const isNewMove = !hasOwnKey(moveValues, move.id);
        moveValues[move.id] = move;
        addMoveProperty(move.id);
        bumpVersion(requireSignal(moveSignals, move.id));
        if (isNewMove) {
          bumpVersion(moveRecordVersion);
        }
      },
      deleteMove: (moveId: number) => {
        if (!hasOwnKey(moveValues, moveId)) {
          return;
        }
        delete moveValues[moveId];
        delete moveSignals[moveId];
        delete moves[moveId];
        bumpVersion(moveRecordVersion);
      },
    } satisfies ReactivePgnControls,
  });

  return pgn;
}

function getReactivePgnControls(pgn: NormalizedPgn): ReactivePgnControls {
  return (pgn as ReactiveNormalizedPgn)[reactivePgnControls];
}

export function setPgnRootMoveIds(pgn: NormalizedPgn, rootMoveIds: number[]): void {
  getReactivePgnControls(pgn).setRootMoveIds(rootMoveIds);
}

export function setPgnMoveIdCounter(pgn: NormalizedPgn, moveIdCounter: number): void {
  getReactivePgnControls(pgn).setMoveIdCounter(moveIdCounter);
}

export function setPgnMove(pgn: NormalizedPgn, move: Move): void {
  getReactivePgnControls(pgn).setMove(move);
}

export function deletePgnMove(pgn: NormalizedPgn, moveId: number): void {
  getReactivePgnControls(pgn).deleteMove(moveId);
}
