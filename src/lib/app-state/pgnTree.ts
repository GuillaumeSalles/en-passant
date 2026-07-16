import { applySan, clonePosition, createChessPosition, fen as positionToFen } from "@/lib/chess";
import { parsePgnMoves, parsePgnTags, type ParsedPgnMove } from "@/lib/pgn-parser";
import { normalizeNags } from "./nags";
import {
  createReactiveNormalizedPgn,
  movesFromIds,
  requireMove,
  requireMoveId,
} from "./reactivePgn";
import type { Move, NormalizedPgn } from "./types";

type TimeControl = {
  initialSeconds: number;
  incrementSeconds: number;
};

type ClockState = {
  white: number | null;
  black: number | null;
};

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

  const timeControl = parseTimeControl(parsePgnTags(pgn)["TimeControl"]);
  const pgnMoves = parsePgnMoves(pgn);

  const moves: Record<string, Move> = {};
  const position = createChessPosition();
  const initialClocks = initialClockState(timeControl);

  function addLine(
    line: ParsedPgnMove[],
    startingPosition: ReturnType<typeof createChessPosition>,
    prevMove: Move | null,
    startingClocks: ClockState,
  ) {
    let previousMove = prevMove;
    const position = clonePosition(startingPosition);
    const clocks = cloneClockState(startingClocks);

    for (const pgnMove of line) {
      for (let i = pgnMove.variations.length - 1; i >= 0; i--) {
        const variation = pgnMove.variations[i];
        if (variation === undefined) continue;

        addLine(variation, position, previousMove, clocks);
      }

      const parsedMove = applySan(position, pgnMove.notation.notation);
      const halfMoveNumber = previousMove ? previousMove.halfMoveNumber + 1 : 0;
      const derivedTimeSpent = deriveMoveTimeSpent(
        pgnMove.clock,
        clocks,
        halfMoveNumber,
        timeControl,
      );
      const timeSpent = pgnMove.timeSpent ?? derivedTimeSpent;

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
        halfMoveNumber,
        clock: pgnMove.clock ?? null,
        commentBefore: pgnMove.commentBefore ?? null,
        commentAfter: pgnMove.commentAfter ?? null,
        timeSpent,
        timeSpentShare: null,
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

  addLine(pgnMoves, position, null, initialClocks);
  applyGameRelativeTimeSpentShares(moves);

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

function parseTimeControl(timeControl: string | undefined): TimeControl | null {
  if (timeControl === undefined) return null;

  const firstPeriod = timeControl.split(":")[0];
  if (firstPeriod === undefined || firstPeriod === "-" || firstPeriod === "?") return null;

  const suddenDeath = firstPeriod.includes("/") ? firstPeriod.split("/")[1] : firstPeriod;
  if (suddenDeath === undefined) return null;

  const [initial, increment = "0"] = suddenDeath.split("+");
  if (initial === undefined) return null;

  const initialSeconds = Number(initial);
  const incrementSeconds = Number(increment);
  if (!Number.isFinite(initialSeconds) || !Number.isFinite(incrementSeconds)) return null;

  return { initialSeconds, incrementSeconds };
}

function initialClockState(timeControl: TimeControl | null): ClockState {
  return {
    white: timeControl?.initialSeconds ?? null,
    black: timeControl?.initialSeconds ?? null,
  };
}

function cloneClockState(clockState: ClockState): ClockState {
  return {
    white: clockState.white,
    black: clockState.black,
  };
}

function clockColor(halfMoveNumber: number): keyof ClockState {
  return halfMoveNumber % 2 === 0 ? "white" : "black";
}

function deriveMoveTimeSpent(
  clock: string | undefined,
  clocks: ClockState,
  halfMoveNumber: number,
  timeControl: TimeControl | null,
): string | null {
  const color = clockColor(halfMoveNumber);
  if (clock === undefined) {
    clocks[color] = null;
    return null;
  }

  const remainingSeconds = parseClockSeconds(clock);
  if (remainingSeconds === null) {
    clocks[color] = null;
    return null;
  }

  const previousRemainingSeconds = clocks[color];
  clocks[color] = remainingSeconds;

  if (previousRemainingSeconds === null || timeControl === null) return null;

  const spentSeconds = previousRemainingSeconds + timeControl.incrementSeconds - remainingSeconds;
  if (spentSeconds < 0) return null;

  return formatClockDuration(spentSeconds);
}

function parseClockSeconds(clock: string): number | null {
  const parts = clock.split(":");
  if (parts.length === 0 || parts.length > 3) return null;

  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;

  if (values.length === 1) {
    const [seconds] = values;
    return seconds ?? null;
  }

  if (values.length === 2) {
    const [minutes, seconds] = values;
    if (minutes === undefined || seconds === undefined) return null;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = values;
  if (hours === undefined || minutes === undefined || seconds === undefined) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function formatClockDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  const trimmedSeconds = seconds.toFixed(3).replace(/\.?0+$/, "");
  const secondsText = seconds < 10 ? `0${trimmedSeconds}` : trimmedSeconds;

  return `${hours}:${String(minutes).padStart(2, "0")}:${secondsText}`;
}

function applyGameRelativeTimeSpentShares(moves: Record<string, Move>): void {
  const spentSecondsByMove = new Map<number, number>();
  let maxSpentSeconds = 0;

  for (const move of Object.values(moves)) {
    if (move.timeSpent === null) continue;

    const spentSeconds = parseClockSeconds(move.timeSpent);
    if (spentSeconds === null) continue;

    spentSecondsByMove.set(move.id, spentSeconds);
    maxSpentSeconds = Math.max(maxSpentSeconds, spentSeconds);
  }

  if (maxSpentSeconds <= 0) return;

  for (const [moveId, spentSeconds] of spentSecondsByMove) {
    const move = moves[moveId];
    if (move === undefined) continue;

    move.timeSpentShare = spentSeconds / maxSpentSeconds;
  }
}

export function formatMoveTimeSpent(timeSpent: string | null): string | null {
  if (timeSpent === null) return null;

  const totalSeconds = parseClockSeconds(timeSpent);
  if (totalSeconds === null) return timeSpent;
  if (totalSeconds < 60) return `${formatSecondsText(totalSeconds)}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}m ${formatMinuteSecondsText(seconds)}s`;
}

function formatSecondsText(seconds: number): string {
  return seconds.toFixed(1);
}

function formatMinuteSecondsText(seconds: number): string {
  const secondsText = formatSecondsText(seconds);
  return seconds < 10 ? `0${secondsText}` : secondsText;
}

function moveCommentAfter(move: Move): string | null {
  const annotations =
    move.clock !== null
      ? [`[%clk ${move.clock}]`]
      : move.timeSpent === null
        ? []
        : [`[%emt ${move.timeSpent}]`];
  const comments =
    move.commentAfter === null || move.commentAfter === "" ? [] : [move.commentAfter];
  const parts = [...annotations, ...comments];
  return parts.length === 0 ? null : parts.join(" ");
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

    const commentAfter = moveCommentAfter(main);
    if (commentAfter !== null) {
      result += ` {${commentAfter}}`;
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
