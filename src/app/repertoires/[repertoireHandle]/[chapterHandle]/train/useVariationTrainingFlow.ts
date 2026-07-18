import { useState } from "@/app/AppStateProvider";
import type { MoveAnnotationData } from "@/components/Chessboard/MoveAnnotation";
import {
  type AppState,
  type Context,
  deleteMove,
  getChapterPgn,
  getTrainingLines,
  getVariationMoveIds,
  isAlternativeTrainingMove,
  isMoveValid,
  moveFromChessboard,
  moveFromEvalMove,
  moveToEvalMove,
  selectAnimation,
  selectCurrentMove,
  selectFen,
  selectNextMoveIds,
  selectOrientation,
  selectSelectedMoveId,
  selectTraining,
  selectTrainingSessionStats,
  selectTrainingVariationIsEmpty,
  type EvalMove,
} from "@/lib/AppState";
import type { StoreState } from "@/lib/createStore";
import { delay } from "@/lib/utils";
import {
  completeTrainingLine,
  completeTrainingReplayMove,
  markTrainingMistake,
  prepareTrainingReplayMove,
  startTrainingLine,
} from "@/mutations/trainingSession";
import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { type MutationContext, useMutation } from "@/lib/useMutation";
import { useRouteContext } from "@/lib/useRouteContext";
import { useSelector } from "@/lib/useSelector";
import {
  acceptsTrainingMove,
  trainingInstruction,
  type TrainingMoveFeedback,
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

export function useVariationTrainingFlow(props: {
  repertoireHandle: string;
  chapterHandle: string;
  lineId: string;
}) {
  const state = useState();
  const ctx = useRouteContext();

  const currentFen = useSelector(selectFen);
  const nextMoveIds = useSelector(selectNextMoveIds);
  const chapterPgn = useSelector(getChapterPgn);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const training = useSelector(selectTraining);
  const selectedMoveId = useSelector(selectSelectedMoveId);
  const currentMove = useSelector(selectCurrentMove);
  const replayMoveIds = useSelector((state) => state.training.session?.replayMoveIds ?? null);
  const trainingVariationIsEmpty = useSelector(selectTrainingVariationIsEmpty);
  const trainingSessionStats = useSelector(selectTrainingSessionStats);
  const [boardIntroComplete, setBoardIntroComplete] = createSignal(false);
  const [phase, setPhase] = createSignal<VariationTrainingPhase>({ type: "initializing" });

  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMoveFromEvalMove = useMutation(moveFromEvalMove);
  const onAutoMoveFromEvalMove = useMutation(addTrainingMoveSilently, { context: true });
  const onDeleteMove = useMutation(deleteMove);
  const onSelectTrainingMoveSilently = useMutation(selectTrainingMoveSilently);
  const onUpdateTrainingStatus = useMutation(updateTrainingStatus);
  const onStartTrainingLine = useMutation(startTrainingLine);
  const onMarkTrainingMistake = useMutation(markTrainingMistake);
  const onPrepareTrainingReplayMove = useMutation(prepareTrainingReplayMove);
  const onCompleteTrainingLine = useMutation(completeTrainingLine, { context: true });
  const onCompleteTrainingReplayMove = useMutation(completeTrainingReplayMove, {
    context: true,
  });

  const lines = createMemo(() => {
    const pgn = chapterPgn();
    return pgn === null ? [] : getTrainingLines(pgn, orientation());
  });
  const activeLineIndex = createMemo(() => lines().findIndex((line) => line.id === props.lineId));
  const activeLine = createMemo(() => lines()[activeLineIndex()]);
  const variation = createMemo(() => {
    const pgn = chapterPgn();
    const line = activeLine();
    return pgn === null || line === undefined ? [] : getVariationMoveIds(pgn, line.terminalMoveId);
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
  const firstVariationMove = createMemo(() => {
    const pgn = chapterPgn();
    const firstMoveId = variation()[0];
    return firstMoveId === undefined ? undefined : pgn?.moves[firstMoveId];
  });
  const replayMoveId = createMemo(() => replayMoveIds()?.[0]);
  const scopeKey = () =>
    `${props.repertoireHandle}/${props.chapterHandle}/${props.lineId}/${orientation()}`;

  let flowVersion = 0;
  const beginFlowStep = () => ++flowVersion;
  const isCurrentFlowStep = (version: number, key: string) =>
    version === flowVersion && key === scopeKey();
  onCleanup(() => {
    flowVersion += 1;
  });

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

  function setPhaseAfterLineCompletion(): void {
    if ((state.training.session?.replayMoveIds.length ?? 0) > 0) {
      setPhase({ type: "preparing-replay" });
    } else {
      setPhase({ type: "line-complete" });
    }
  }

  let startedScopeKey = "";
  createEffect(
    () => ({
      key: scopeKey(),
      line: activeLine(),
      lineIds: lines().map((line) => line.id),
      orientation: orientation(),
      variationIndex: activeLineIndex(),
    }),
    ({ key, line, lineIds, orientation, variationIndex }) => {
      if (line === undefined || key === startedScopeKey) return;
      startedScopeKey = key;
      beginFlowStep();
      setPhase({ type: "initializing" });
      onStartTrainingLine({ lineIds, lineId: line.id, variationIndex });
      if (orientation === "white") setPhase({ type: "awaiting-line-move", notice: null });
    },
  );

  createEffect(
    () => ({
      boardIntroComplete: boardIntroComplete(),
      firstMove: firstVariationMove(),
      orientation: orientation(),
      phase: phase(),
      trainingVariationIsEmpty: trainingVariationIsEmpty(),
    }),
    ({ boardIntroComplete, firstMove, orientation, phase, trainingVariationIsEmpty }) => {
      if (
        phase.type !== "initializing" ||
        orientation !== "black" ||
        !boardIntroComplete ||
        !trainingVariationIsEmpty ||
        firstMove?.halfMoveNumber !== 0
      ) {
        return;
      }
      onAutoMoveFromEvalMove(moveToEvalMove(firstMove));
      setPhase({ type: "awaiting-line-move", notice: null });
    },
  );

  createEffect(
    () => ({
      key: scopeKey(),
      queueKey: replayMoveIds()?.join(",") ?? "",
      targetMoveId: replayMoveId(),
    }),
    ({ key, queueKey, targetMoveId }) => {
      if (queueKey === "") return;
      if (targetMoveId === undefined) return;
      const version = beginFlowStep();
      setPhase({ type: "preparing-replay" });
      void delay(REPLAY_RESET_DELAY).then(() =>
        untrack(() => {
          if (!isCurrentFlowStep(version, key)) return;
          prepareReplayMove(targetMoveId);
          setPhase({ type: "awaiting-replay-move" });
        }),
      );
    },
  );

  async function rejectPlayedMove(
    version: number,
    key: string,
    playedMoveId: number | null,
    expectedMoveId: number,
    feedback: TrainingMoveFeedback,
    square: string,
  ): Promise<void> {
    setPhase({ type: "showing-feedback", feedback, square });
    await delay(FEEDBACK_DELAY);
    if (!isCurrentFlowStep(version, key)) return;
    if (playedMoveId !== null) onDeleteMove(playedMoveId);
    if (feedback === "mistake") onMarkTrainingMistake({ moveId: expectedMoveId });
    setPhase({ type: "awaiting-line-move", notice: feedback });
  }

  const onPieceDrop = async (sourceSquare: string, targetSquare: string, piece: string) => {
    const activePhase = phase();
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

    const key = scopeKey();
    const version = beginFlowStep();
    setPhase({ type: "waiting-for-response" });
    onUpdateTrainingStatus("in-progress");
    onMoveFromChessboard(sourceSquare, targetSquare, piece);
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
      await rejectPlayedMove(version, key, playedMoveId, expectedMove.id, feedback, targetSquare);
      return;
    }

    if (activePhase.type === "awaiting-replay-move") {
      onCompleteTrainingReplayMove({ lineId: props.lineId });
      setPhaseAfterLineCompletion();
      return;
    }

    const responseId = variation()[currentHalfMoveNumber + 2];
    const response = responseId === undefined ? undefined : pgn.moves[responseId];
    if (response === undefined) {
      onCompleteTrainingLine({ lineId: props.lineId, completedMoveId: expectedMove.id });
      setPhaseAfterLineCompletion();
      return;
    }

    await delay(RESPONSE_DELAY);
    if (!isCurrentFlowStep(version, key)) return;
    if (playedMoveId !== null && selectedMoveId() !== playedMoveId) {
      onSelectTrainingMoveSilently(playedMoveId);
    }
    onMoveFromEvalMove(response);
    if (variation()[currentHalfMoveNumber + 3] === undefined) {
      onCompleteTrainingLine({ lineId: props.lineId, completedMoveId: expectedMove.id });
      setPhaseAfterLineCompletion();
    } else {
      setPhase({ type: "awaiting-line-move", notice: null });
    }
  };

  const nextUntrainedLine = createMemo(() => {
    const allLines = lines();
    const trained = new Set(training().session?.results.map((result) => result.lineId) ?? []);
    if (allLines.length === 0) return undefined;
    for (let offset = 1; offset <= allLines.length; offset++) {
      const line = allLines[(activeLineIndex() + offset) % allLines.length];
      if (line !== undefined && !trained.has(line.id)) return line;
    }
    return undefined;
  });
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

  return {
    activeLine,
    animation,
    annotations,
    canDrag,
    chapterHasMoves,
    chapterPgn,
    currentFen,
    instruction,
    isLineComplete: () => phase().type === "line-complete",
    lines,
    nextUntrainedLine,
    onIntroComplete: () => setBoardIntroComplete(true),
    onPieceDrop,
    orientation,
    progress,
    trainingSessionStats,
  };
}
