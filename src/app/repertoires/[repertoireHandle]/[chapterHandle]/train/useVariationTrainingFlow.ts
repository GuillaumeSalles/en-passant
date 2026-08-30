import { useState } from "@/app/AppStateProvider";
import type { MoveAnnotationData } from "@/components/Chessboard/MoveAnnotation";
import {
  type AppState,
  type Context,
  deleteMove,
  getChapterPgn,
  getTrainingLinesWithScheduledPaths,
  getVariationMoveIds,
  isAlternativeTrainingMove,
  isMoveValid,
  isTrainingReviewDue,
  moveFromChessboard,
  moveFromEvalMove,
  moveToEvalMove,
  prioritizeDueTrainingLines,
  selectAnimation,
  selectCurrentMove,
  selectFen,
  selectNextMoveIds,
  selectOrientation,
  selectSelectedMoveId,
  selectTraining,
  selectTrainingSessionStats,
  trainingLineUciPathFromId,
  type EvalMove,
} from "@/lib/AppState";
import type { StoreState } from "@/lib/createStore";
import { createPacingTimer } from "@/lib/createPacingTimer";
import {
  completeTrainingLine,
  completeTrainingReplayMove,
  discardTrainingLine,
  markTrainingCorrectMove,
  markTrainingMistake,
  prepareTrainingReplayMove,
  revealCompletedTrainingLine,
  startTrainingLine,
} from "@/mutations/trainingSession";
import { trainingLineScheduleKey } from "@/mutations/learningSession";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";
import { type MutationContext, useMutation } from "@/lib/useMutation";
import { useRouteContext } from "@/lib/useRouteContext";
import { useSelector } from "@/lib/useSelector";
import {
  acceptsTrainingMove,
  initialVariationTrainingPhase,
  reduceVariationTrainingFlow,
  trainingInstruction,
  type TrainingMoveFeedback,
  type VariationTrainingEvent,
  type VariationTrainingPhase,
} from "./variationTrainingFlow";

const FEEDBACK_DELAY = 1000;
const RESPONSE_DELAY = 500;
const REPLAY_RESET_DELAY = 500;

function updateTrainingStatus(
  state: StoreState<AppState>,
  _ctx: Context,
  status: "in-progress",
): void {
  state.set("training", { ...state.training, status });
}

function addTrainingMoveSilently({ state, route }: MutationContext, move: EvalMove): void {
  moveFromEvalMove(state, route, move);
}

function selectTrainingMoveSilently(
  state: StoreState<AppState>,
  _ctx: Context,
  moveId: number,
): void {
  if (state.training.variation.moves[moveId] === undefined) return;
  state.set("selectedMoveId", moveId);
  state.set("preselectedVariation", null);
}

export function useVariationTrainingFlow(
  props: {
    repertoireHandle: string;
    chapterHandle: string;
    lineId: string;
  },
  options: {
    enabled?: Accessor<boolean>;
    repetitions?: number;
    boundaryDelayMs?: number | Accessor<number>;
    onLineComplete?: () => void;
    startMove?: Accessor<number>;
  } = {},
) {
  const state = useState();
  const ctx = useRouteContext();

  const currentFen = useSelector(selectFen);
  const nextMoveIds = useSelector(selectNextMoveIds);
  const chapterPgn = useSelector(getChapterPgn);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const training = useSelector(selectTraining);
  const reviews = useSelector((state) => state.training.reviews);
  const selectedMoveId = useSelector(selectSelectedMoveId);
  const currentMove = useSelector(selectCurrentMove);
  const replayMoveIds = useSelector((state) => state.training.session?.replayMoveIds ?? null);
  const trainingSessionStats = useSelector(selectTrainingSessionStats);
  const [boardIntroComplete, setBoardIntroComplete] = createSignal(false);
  const [phase, setPhase] = createSignal<VariationTrainingPhase>(initialVariationTrainingPhase);
  let currentPhase = initialVariationTrainingPhase;
  const [completedRepetitions, setCompletedRepetitions] = createSignal(0);
  const [initializedScopeKey, setInitializedScopeKey] = createSignal<string | null>(null);
  const pacingTimer = createPacingTimer();
  const isEnabled = () => options.enabled?.() ?? true;
  const repetitions = () => Math.max(1, options.repetitions ?? 1);
  const boundaryDelayMs = () =>
    Math.max(
      0,
      typeof options.boundaryDelayMs === "function"
        ? options.boundaryDelayMs()
        : (options.boundaryDelayMs ?? 0),
    );

  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMoveFromEvalMove = useMutation(moveFromEvalMove);
  const onAutoMoveFromEvalMove = useMutation(addTrainingMoveSilently, { context: true });
  const onDeleteMove = useMutation(deleteMove);
  const onSelectTrainingMoveSilently = useMutation(selectTrainingMoveSilently);
  const onUpdateTrainingStatus = useMutation(updateTrainingStatus);
  const onStartTrainingLine = useMutation(startTrainingLine);
  const onDiscardTrainingLine = useMutation(discardTrainingLine);
  const onMarkTrainingCorrectMove = useMutation(markTrainingCorrectMove);
  const onMarkTrainingMistake = useMutation(markTrainingMistake);
  const onPrepareTrainingReplayMove = useMutation(prepareTrainingReplayMove);
  const onRevealCompletedTrainingLine = useMutation(revealCompletedTrainingLine);
  const onCompleteTrainingLine = useMutation(completeTrainingLine, { context: true });
  const onCompleteTrainingReplayMove = useMutation(completeTrainingReplayMove, {
    context: true,
  });

  const lines = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn === null) return [];
    const scheduledPaths = Object.entries(reviews())
      .filter(([key, review]) => key === trainingLineScheduleKey(state, ctx(), review.uciPath))
      .map(([, review]) => review.uciPath);
    const requestedPath = trainingLineUciPathFromId(props.lineId);
    if (requestedPath !== null) scheduledPaths.push(requestedPath);
    const sourceLines = getTrainingLinesWithScheduledPaths(pgn, orientation(), scheduledPaths);
    return prioritizeDueTrainingLines(
      sourceLines,
      Object.fromEntries(
        sourceLines.map((line) => {
          const key = trainingLineScheduleKey(state, ctx(), line.uciPath);
          return [line.id, key === null ? undefined : reviews()[key]];
        }),
      ),
      Date.now(),
    );
  });
  const activeLineIndex = createMemo(() => lines().findIndex((line) => line.id === props.lineId));
  const activeLine = createMemo(() => lines()[activeLineIndex()]);
  const variation = createMemo(() => {
    const pgn = chapterPgn();
    const line = activeLine();
    return pgn === null || line === undefined ? [] : getVariationMoveIds(pgn, line.terminalMoveId);
  });
  const effectiveStartMove = createMemo(() => {
    const requestedStartMove = options.startMove?.() ?? 1;
    return requestedStartMove >= 1 && requestedStartMove <= variation().length
      ? requestedStartMove
      : 1;
  });
  const precedingMoves = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn === null) return [];
    return variation()
      .slice(0, effectiveStartMove() - 1)
      .map((moveId) => pgn.moves[moveId])
      .filter((move) => move !== undefined)
      .map(moveToEvalMove);
  });
  const firstPendingMove = createMemo(() => {
    const pgn = chapterPgn();
    const moveId = variation()[effectiveStartMove() - 1];
    return moveId === undefined ? undefined : pgn?.moves[moveId];
  });
  const startsWithUserMove = createMemo(() => {
    const move = firstPendingMove();
    if (move === undefined) return false;
    const moveColor = move.halfMoveNumber % 2 === 0 ? "white" : "black";
    return moveColor === orientation();
  });
  const progress = createMemo(() => {
    const line = activeLine();
    return line === undefined || line.plyCount === 0
      ? 0
      : Object.keys(training().variation.moves).length / line.plyCount;
  });
  const chapterHasMoves = createMemo(() => {
    const pgn = chapterPgn();
    return pgn !== null && Object.keys(pgn.moves).length > 0;
  });
  const replayMoveId = createMemo(() => replayMoveIds()?.[0]);
  const scopeKey = () =>
    `${props.repertoireHandle}/${props.chapterHandle}/${props.lineId}/${orientation()}/${effectiveStartMove()}`;

  let startedScope: {
    key: string;
    repertoireHandle: string;
    chapterHandle: string;
    lineId: string;
  } | null = null;
  onCleanup(() => {
    pacingTimer.cancel();
    if (startedScope !== null) onDiscardTrainingLine(startedScope);
  });

  function dispatch(event: VariationTrainingEvent): boolean {
    const current = currentPhase;
    const next = reduceVariationTrainingFlow(current, event);
    if (next === current) return false;
    if (event.type === "RESET") pacingTimer.cancel();
    currentPhase = next;
    setPhase(next);
    return true;
  }

  function prepareReplayMove(targetMoveId: number): void {
    const pgn = chapterPgn();
    if (pgn === null) return;
    const replayMoveIndex = variation().indexOf(targetMoveId);
    if (replayMoveIndex < 0) return;
    const precedingMoves = variation()
      .slice(0, replayMoveIndex)
      .map((moveId) => pgn.moves[moveId])
      .filter((move) => move !== undefined)
      .map(moveToEvalMove);
    onPrepareTrainingReplayMove({ animateLastMove: true, precedingMoves });
  }

  function requestReplayOrBoundary(): void {
    const targetMoveId = state.training.session?.replayMoveIds[0];
    if (targetMoveId !== undefined) {
      startReplay(targetMoveId);
      return;
    }
    startLineBoundary();
  }

  function startReplay(targetMoveId: number): void {
    if (!dispatch({ type: "REPLAY_REQUIRED", targetMoveId })) return;
    pacingTimer.schedule(REPLAY_RESET_DELAY, () => {
      untrack(() => {
        const current = currentPhase;
        if (
          current.type !== "preparing-replay" ||
          current.targetMoveId !== targetMoveId ||
          !dispatch({ type: "REPLAY_DELAY_ELAPSED" })
        ) {
          return;
        }
        prepareReplayMove(targetMoveId);
        dispatch({
          type: "REPLAY_STARTED",
          animationId: selectAnimation(state, ctx())?.id ?? null,
        });
      });
    });
  }

  function startLineBoundary(): void {
    if (!dispatch({ type: "LINE_BOUNDARY_STARTED" })) return;
    const onElapsed = () => finishRepetition();
    const delayMs = boundaryDelayMs();
    if (delayMs === 0) {
      onElapsed();
    } else {
      pacingTimer.schedule(delayMs, onElapsed);
    }
  }

  function finishRepetition(): void {
    if (currentPhase.type !== "line-boundary") return;
    const completed = completedRepetitions() + 1;
    setCompletedRepetitions(completed);
    const finished = completed >= repetitions();
    if (!finished) {
      onPrepareTrainingReplayMove({ animateLastMove: false, precedingMoves: precedingMoves() });
    }
    dispatch({ type: "LINE_BOUNDARY_ELAPSED", finished, startsWithUserMove: startsWithUserMove() });
    if (finished) {
      onRevealCompletedTrainingLine(props.lineId);
      options.onLineComplete?.();
    }
  }

  function completeLineAttempt(completedMoveId: number): void {
    const line = activeLine();
    if (line === undefined) {
      dispatch({ type: "RESET" });
      return;
    }
    const finishesLine = completedRepetitions() + 1 >= repetitions();
    onCompleteTrainingLine({
      lineId: props.lineId,
      uciPath: line.uciPath,
      completedMoveId,
      finishLine: finishesLine,
    });
    requestReplayOrBoundary();
  }

  createEffect(
    () => ({
      key: scopeKey(),
      line: activeLine(),
      lineIds: lines().map((line) => line.id),
      enabled: isEnabled(),
      orientation: orientation(),
      precedingMoves: precedingMoves(),
      startsWithUserMove: startsWithUserMove(),
      variationIndex: activeLineIndex(),
      repertoireHandle: props.repertoireHandle,
      chapterHandle: props.chapterHandle,
      lineId: props.lineId,
    }),
    ({
      key,
      line,
      lineIds,
      enabled,
      precedingMoves,
      startsWithUserMove,
      variationIndex,
      repertoireHandle,
      chapterHandle,
      lineId,
    }) => {
      if (!enabled || line === undefined || key === startedScope?.key) return;
      if (startedScope !== null) onDiscardTrainingLine(startedScope);
      dispatch({ type: "RESET" });
      setCompletedRepetitions(0);
      onStartTrainingLine({ lineIds, lineId: line.id, precedingMoves, variationIndex });
      startedScope = {
        key,
        repertoireHandle,
        chapterHandle,
        lineId,
      };
      setInitializedScopeKey(key);
      if (startsWithUserMove) dispatch({ type: "READY_FOR_LINE_MOVE" });
    },
  );

  createEffect(
    () => ({
      boardIntroComplete: boardIntroComplete(),
      enabled: isEnabled(),
      firstPendingMove: firstPendingMove(),
      phase: phase(),
      startsWithUserMove: startsWithUserMove(),
    }),
    ({ boardIntroComplete, enabled, firstPendingMove, phase, startsWithUserMove }) => {
      if (
        !enabled ||
        phase.type !== "initializing" ||
        !boardIntroComplete ||
        startsWithUserMove ||
        firstPendingMove === undefined
      ) {
        return;
      }
      untrack(() => {
        onAutoMoveFromEvalMove(moveToEvalMove(firstPendingMove));
        const animationId = selectAnimation(state, ctx())?.id ?? null;
        const completedMoveId =
          variation().at(-1) === firstPendingMove.id ? firstPendingMove.id : null;
        dispatch({
          type: "INTRO_MOVE_STARTED",
          animationId,
          completedMoveId,
        });
        if (animationId === null && completedMoveId !== null) {
          completeLineAttempt(completedMoveId);
        }
      });
    },
  );

  createEffect(
    () => ({
      enabled: isEnabled(),
      key: scopeKey(),
      queueKey: replayMoveIds()?.join(",") ?? "",
      targetMoveId: replayMoveId(),
    }),
    ({ enabled, queueKey, targetMoveId }) => {
      if (!enabled || queueKey === "") return;
      if (targetMoveId === undefined) return;
      untrack(() => startReplay(targetMoveId));
    },
  );

  function rejectPlayedMove(
    playedMoveId: number | null,
    expectedMoveId: number,
    feedback: TrainingMoveFeedback,
    square: string,
  ): void {
    if (
      !dispatch({
        type: "MOVE_REJECTED",
        feedback,
        square,
        playedMoveId,
        expectedMoveId,
      })
    ) {
      return;
    }
    pacingTimer.schedule(FEEDBACK_DELAY, () => {
      const current = currentPhase;
      if (current.type !== "showing-feedback") return;
      if (current.playedMoveId !== null) onDeleteMove(current.playedMoveId);
      if (current.feedback === "mistake") {
        onMarkTrainingMistake({ moveId: current.expectedMoveId });
      }
      dispatch({ type: "FEEDBACK_ELAPSED" });
    });
  }

  function handleResponseSettled(): void {
    const current = currentPhase;
    if (current.type !== "response-settled") return;
    if (current.finishesVariation) {
      completeLineAttempt(current.completedMoveId);
    } else {
      dispatch({ type: "RESPONSE_HANDLED" });
    }
  }

  const onPieceDrop = (
    sourceSquare: string,
    targetSquare: string,
    piece: string,
    animate: boolean,
  ) => {
    const activePhase = currentPhase;
    const pgn = chapterPgn();
    if (
      !acceptsTrainingMove(activePhase) ||
      pgn === null ||
      !isMoveValid(state, ctx(), sourceSquare, targetSquare, piece)
    ) {
      return;
    }

    const current = currentMove();
    const currentHalfMoveNumber = current?.halfMoveNumber ?? -1;
    const expectedMoveId =
      activePhase.type === "awaiting-replay-move"
        ? replayMoveId()
        : variation()[currentHalfMoveNumber + 1];
    const expectedMove = expectedMoveId === undefined ? undefined : pgn.moves[expectedMoveId];
    if (expectedMove === undefined) return;

    const origin = activePhase.type === "awaiting-replay-move" ? "replay" : "line";
    if (!dispatch({ type: "MOVE_SUBMITTED", origin })) return;
    onUpdateTrainingStatus("in-progress");
    onMoveFromChessboard(sourceSquare, targetSquare, piece, animate);
    const playedMoveId = selectSelectedMoveId(state, ctx());

    if (sourceSquare !== expectedMove.from || targetSquare !== expectedMove.to) {
      const feedback = isAlternativeTrainingMove(
        pgn,
        expectedMove.id,
        orientation(),
        sourceSquare,
        targetSquare,
      )
        ? "alternative"
        : "mistake";
      rejectPlayedMove(playedMoveId, expectedMove.id, feedback, targetSquare);
      return;
    }

    if (origin === "replay") {
      const finishesLine = completedRepetitions() + 1 >= repetitions();
      const line = activeLine();
      if (line === undefined) {
        dispatch({ type: "RESET" });
        return;
      }
      onCompleteTrainingReplayMove({
        lineId: props.lineId,
        uciPath: line.uciPath,
        finishLine: finishesLine,
      });
      requestReplayOrBoundary();
      return;
    }

    onMarkTrainingCorrectMove();
    const responseId = variation()[currentHalfMoveNumber + 2];
    const response = responseId === undefined ? undefined : pgn.moves[responseId];
    if (response === undefined) {
      completeLineAttempt(expectedMove.id);
      return;
    }

    const finishesVariation = variation()[currentHalfMoveNumber + 3] === undefined;
    if (
      !dispatch({
        type: "WAIT_FOR_RESPONSE",
        completedMoveId: expectedMove.id,
        finishesVariation,
        playedMoveId,
        responseMoveId: response.id,
      })
    ) {
      return;
    }
    pacingTimer.schedule(RESPONSE_DELAY, () => {
      untrack(() => {
        const current = currentPhase;
        if (current.type !== "waiting-for-response") return;
        if (!dispatch({ type: "RESPONSE_DELAY_ELAPSED" })) return;
        if (current.playedMoveId !== null && selectedMoveId() !== current.playedMoveId) {
          onSelectTrainingMoveSilently(current.playedMoveId);
        }
        const responseMove = chapterPgn()?.moves[current.responseMoveId];
        if (responseMove === undefined) {
          dispatch({ type: "RESET" });
          return;
        }
        onMoveFromEvalMove(responseMove);
        dispatch({
          type: "RESPONSE_STARTED",
          animationId: selectAnimation(state, ctx())?.id ?? null,
        });
        handleResponseSettled();
      });
    });
  };

  const nextUntrainedLine = createMemo(() => {
    const allLines = lines();
    const trained = new Set(training().session?.results.map((result) => result.lineId) ?? []);
    if (allLines.length === 0) return undefined;
    for (let offset = 1; offset <= allLines.length; offset++) {
      const line = allLines[(activeLineIndex() + offset) % allLines.length];
      if (line === undefined) continue;
      const key = trainingLineScheduleKey(state, ctx(), line.uciPath);
      const review = key === null ? undefined : reviews()[key];
      const needsTraining =
        review !== undefined ? isTrainingReviewDue(review, Date.now()) : !trained.has(line.id);
      if (needsTraining) {
        return line;
      }
    }
    return undefined;
  });
  const nextDueLine = () => {
    const allLines = lines();
    if (allLines.length === 0) return undefined;
    for (let offset = 1; offset <= allLines.length; offset++) {
      const line = allLines[(activeLineIndex() + offset) % allLines.length];
      if (line === undefined) continue;
      const key = trainingLineScheduleKey(state, ctx(), line.uciPath);
      const review = key === null ? undefined : state.training.reviews[key];
      if (isTrainingReviewDue(review, Date.now())) return line;
    }
    return undefined;
  };
  const canDrag = createMemo(() => acceptsTrainingMove(phase()) && nextMoveIds().length === 0);
  const instruction = createMemo(() =>
    trainingInstruction(phase(), orientation(), nextMoveIds().length > 0),
  );
  const annotations = createMemo<{ [square: string]: MoveAnnotationData[] }>(() => {
    const currentPhase = phase();
    if (currentPhase.type !== "showing-feedback") return {};
    const annotation: MoveAnnotationData = {
      type: currentPhase.feedback === "alternative" ? "alternativeMove" : "wrongMove",
    };
    return { [currentPhase.square]: [annotation] };
  });

  function onAnimationSettled(animationId: number): void {
    const completedIntroMoveId =
      currentPhase.type === "animating-intro" ? currentPhase.completedMoveId : null;
    if (!dispatch({ type: "ANIMATION_SETTLED", animationId })) return;
    if (completedIntroMoveId !== null) {
      completeLineAttempt(completedIntroMoveId);
      return;
    }
    handleResponseSettled();
  }

  return {
    activeLine,
    animation,
    annotations,
    canDrag,
    chapterHasMoves,
    chapterPgn,
    completedRepetitions,
    currentFen,
    instruction,
    isInitialized: () => initializedScopeKey() === scopeKey(),
    isLineComplete: () => phase().type === "line-complete",
    lines,
    nextDueLine,
    nextUntrainedLine,
    onAnimationSettled,
    onIntroComplete: () => setBoardIntroComplete(true),
    onPieceDrop,
    orientation,
    phase,
    progress,
    trainingSessionStats,
  };
}
