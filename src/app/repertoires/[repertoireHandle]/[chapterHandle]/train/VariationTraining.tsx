import { Chessboard } from "@/components/Chessboard/Chessboard";
import {
  deleteMove,
  getVariationMoveIds,
  isMoveValid,
  moveFromChessboard,
  moveFromEvalMove,
  selectCurrentMove,
  selectFen,
  selectNextMoveIds,
  selectVariationProgress,
  getVariationsEnds,
  AppState,
  Context,
  EvalMove,
  moveToEvalMove,
  getRepertoireName,
  getChapterName,
  getChapterPgn,
  Orientation,
  selectOrientation,
  selectAnimation,
  selectTraining,
  selectSelectedMoveId,
  selectTrainingSessionStats,
  selectTrainingVariationIsEmpty,
  TrainingState,
  TrainingSessionSummary,
} from "@/lib/AppState";
import { createEffect, createMemo, onCleanup, Show } from "solid-js";
import { Layout } from "@/components/Layout";
import { MovesTree } from "@/components/MovesTree";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { delay } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/button";
import { continueTraining } from "@/mutations/continueTraining";
import {
  completeTrainingLine,
  markTrainingMistake,
  resetTrainingSession,
  startTrainingSession,
} from "@/mutations/trainingSession";
import { useSelector } from "@/lib/useSelector";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useRouteContext } from "@/lib/useRouteContext";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { MutationContext, useMutation } from "@/lib/useMutation";
import { useState } from "@/app/AppStateProvider";
import { StoreState } from "@/lib/createStore";
import { repertoirePath } from "@/lib/routes";

const FAILURE_DELAY = 1000;
const RESPONSE_DELAY = 500;

function updateTrainingStatus(
  state: StoreState<AppState>,
  _ctx: Context,
  status: TrainingState,
): void {
  state.set("training", {
    ...state.training,
    status,
  });
}

function addTrainingMoveSilently({ state, route }: MutationContext, move: EvalMove): void {
  moveFromEvalMove(state, route, move);
}

export function VariationTraining(props: { repertoireHandle: string; chapterHandle: string }) {
  useGlobalShortcuts();
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );

  const state = useState();
  const ctx = useRouteContext();

  const currentFen = useSelector(selectFen);
  const nextMoveIds = useSelector(selectNextMoveIds);
  const repertoireName = useSelector(getRepertoireName);
  const chapterName = useSelector(getChapterName);
  const chapterPgn = useSelector(getChapterPgn);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const training = useSelector(selectTraining);
  const selectedMoveId = useSelector(selectSelectedMoveId);
  const currentMove = useSelector(selectCurrentMove);
  const trainingStatus = useSelector((state) => state.training.status);
  const trainingVariationIsEmpty = useSelector(selectTrainingVariationIsEmpty);
  const trainingSessionStats = useSelector(selectTrainingSessionStats);
  const progress = useSelector(selectVariationProgress);

  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMoveFromEvalMove = useMutation(moveFromEvalMove);
  const onAutoMoveFromEvalMove = useMutation(addTrainingMoveSilently, { context: true });
  const onDeleteMove = useMutation(deleteMove);
  const onUpdateTrainingStatus = useMutation(updateTrainingStatus);
  const onContinueTraining = useMutation(continueTraining);
  const onStartTrainingSession = useMutation(startTrainingSession);
  const onMarkTrainingMistake = useMutation(markTrainingMistake);
  const onCompleteTrainingLine = useMutation(completeTrainingLine, { context: true });
  const onResetTrainingSession = useMutation(resetTrainingSession);

  onCleanup(onResetTrainingSession);

  const variationEnds = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn == null) return [];
    return getVariationsEnds(pgn);
  });

  const variation = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn == null) return [];
    const variationEnd = variationEnds()[training().variationIndex];
    return variationEnd === undefined ? [] : getVariationMoveIds(pgn, variationEnd);
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

  createEffect(
    () => ({
      variationCount: variationEnds().length,
      status: training().status,
      session: training().session,
      repertoireHandle: props.repertoireHandle,
      chapterHandle: props.chapterHandle,
    }),
    ({ variationCount, status, session, repertoireHandle, chapterHandle }) => {
      if (variationCount === 0) return;
      if (
        session !== null &&
        (session.repertoireHandle !== repertoireHandle || session.chapterHandle !== chapterHandle)
      ) {
        onStartTrainingSession(variationCount);
        return;
      }
      if (session !== null || status === "complete") return;
      onStartTrainingSession(variationCount);
    },
  );

  createEffect(
    () => {
      const firstMove = firstVariationMove();
      return {
        currentMoveId: currentMove()?.id ?? null,
        firstHalfMoveNumber: firstMove?.halfMoveNumber ?? null,
        move: firstMove === undefined ? null : moveToEvalMove(firstMove),
        orientation: orientation(),
        status: trainingStatus(),
        trainingVariationIsEmpty: trainingVariationIsEmpty(),
      };
    },
    ({
      currentMoveId,
      firstHalfMoveNumber,
      move,
      orientation,
      status,
      trainingVariationIsEmpty,
    }) => {
      if (
        orientation !== "black" ||
        status !== "in-progress" ||
        currentMoveId !== null ||
        !trainingVariationIsEmpty ||
        firstHalfMoveNumber !== 0 ||
        move === null
      ) {
        return;
      }

      onAutoMoveFromEvalMove(move);
    },
  );

  const isAtEndOfLine = () => nextMoveIds().length === 0;

  const onPieceDrop = async (sourceSquare: string, targetSquare: string, piece: string) => {
    const pgn = chapterPgn();

    if (pgn == null || !isMoveValid(state, ctx(), sourceSquare, targetSquare, piece)) {
      return;
    }

    const cm = currentMove();
    const currentHalfMoveNumber = cm ? cm.halfMoveNumber : -1;
    const nextMoveId = variation()[currentHalfMoveNumber + 1];
    const nextMove = nextMoveId === undefined ? undefined : pgn.moves[nextMoveId];
    if (nextMove === undefined) {
      return;
    }

    onMoveFromChessboard(sourceSquare, targetSquare, piece);

    if (sourceSquare === nextMove.from && targetSquare === nextMove.to) {
      const responseId = variation()[currentHalfMoveNumber + 2];
      const response = responseId === undefined ? undefined : pgn.moves[responseId];

      if (response === undefined) {
        onCompleteTrainingLine({ variationIndex: training().variationIndex });
        return;
      }

      onUpdateTrainingStatus("in-progress");
      await delay(RESPONSE_DELAY);
      onMoveFromEvalMove(response);
      if (variation()[currentHalfMoveNumber + 3] === undefined) {
        onCompleteTrainingLine({ variationIndex: training().variationIndex });
      }
    } else {
      await delay(FAILURE_DELAY);
      const moveId = selectedMoveId();
      if (moveId !== null) {
        onDeleteMove(moveId);
      }
      onMarkTrainingMistake();
    }
  };

  const wrongMove = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn == null) return undefined;
    const cm = currentMove();
    if (cm === null) return undefined;
    const variationMoveId = variation()[cm.halfMoveNumber];
    const variationMove = variationMoveId === undefined ? undefined : pgn.moves[variationMoveId];
    if (variationMove === undefined) return undefined;
    if (variationMove.from === cm.from && variationMove.to === cm.to) {
      return undefined;
    }
    return cm.to;
  });

  return (
    <Show when={chapterPgn() !== undefined} fallback={null}>
      <Layout
        title={
          <div class="min-w-0 truncate text-base">
            {repertoireName()} · {chapterName()} · training
          </div>
        }
        chessboard={
          <Chessboard
            boardOrientation={orientation()}
            position={currentFen()}
            canDrag={isAtEndOfLine()}
            onPieceDrop={onPieceDrop}
            pieceToAnimate={animation()}
            arrows={{}}
            squareHighlights={{}}
            onHighlightSquare={() => {}}
            onDrawArrow={() => {}}
            annotations={(() => {
              const square = wrongMove();
              return square === undefined ? {} : { [square]: [{ type: "wrongMove" }] };
            })()}
          />
        }
        evalBar={null}
        panelChildren={
          <>
            <TrainingSessionStats result={trainingSessionStats()} />
            <ProgressBar progress={progress()} />
            <Show when={chapterHasMoves()}>
              <HorizontalDashedDivider
                animationKey="variation-training-instructions-top"
                direction="right-to-left"
              />
            </Show>
            <div class="flex items-center justify-between gap-2 px-4 py-2">
              <Show
                when={chapterHasMoves()}
                fallback={
                  <>
                    <span>Nothing to train</span>
                    <Button
                      size="sm"
                      href={repertoirePath(props.repertoireHandle, props.chapterHandle)}
                    >
                      Back to chapter
                    </Button>
                  </>
                }
              >
                <span>
                  {getInstruction({
                    nextMoveIds: nextMoveIds(),
                    orientation: orientation(),
                    trainingState: trainingStatus(),
                  })}
                </span>
                <Show when={trainingStatus() === "success"}>
                  <Button size="sm" onClick={() => onContinueTraining(variationEnds().length)}>
                    Continue
                  </Button>
                </Show>
                <Show when={trainingStatus() === "complete"}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartTrainingSession(variationEnds().length)}
                  >
                    New session
                  </Button>
                </Show>
              </Show>
            </div>
            <HorizontalDashedDivider
              animationKey="variation-training-moves"
              direction="right-to-left"
            />
            <MovesTree />
            <PgnExplorerToolbar />
          </>
        }
      />
    </Show>
  );
}

function getInstruction({
  nextMoveIds,
  orientation,
  trainingState,
}: {
  nextMoveIds: number[];
  orientation: Orientation;
  trainingState: TrainingState;
}): string {
  if (nextMoveIds.length > 0) {
    return "Go to the end of the line to continue the drill.";
  } else if (trainingState === "in-progress") {
    return `${orientation === "black" ? "Black" : "White"} to play.`;
  } else if (trainingState === "failure") {
    return "Try again.";
  } else if (trainingState === "success") {
    return "Good job!";
  } else if (trainingState === "complete") {
    return "Session complete.";
  }
  return "";
}

function TrainingSessionStats(props: { result: TrainingSessionSummary | null }) {
  return (
    <Show when={props.result}>
      {(result) => (
        <div class="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] text-center text-sm">
          <StatCell label="Lines" value={`${result().tried}/${result().total}`} />
          <VerticalDashedDivider />
          <StatCell label="Clean" value={result().clean.toString()} />
          <VerticalDashedDivider />
          <StatCell label="Mistakes" value={result().mistakes.toString()} />
          <VerticalDashedDivider />
          <StatCell
            label="Accuracy"
            value={
              result().tried === 0 ? "-" : `${Math.round((result().clean / result().tried) * 100)}%`
            }
          />
        </div>
      )}
    </Show>
  );
}

function StatCell(props: { label: string; value: string }) {
  return (
    <div class="bg-background px-2 py-2">
      <div class="text-xs text-muted-foreground">{props.label}</div>
      <div class="font-medium">{props.value}</div>
    </div>
  );
}
