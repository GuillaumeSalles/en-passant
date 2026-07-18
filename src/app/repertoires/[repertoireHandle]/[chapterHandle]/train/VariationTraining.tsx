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
  getTrainingLines,
  isAlternativeTrainingMove,
  AppState,
  Context,
  EvalMove,
  getChapterPgn,
  moveToEvalMove,
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
import { createEffect, createMemo, createSignal, Show, untrack } from "solid-js";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { MovesTree } from "@/components/MovesTree";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { delay } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/button";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import {
  completeTrainingLine,
  completeTrainingReplayMove,
  markTrainingMistake,
  prepareTrainingReplayMove,
  startTrainingLine,
} from "@/mutations/trainingSession";
import { useSelector } from "@/lib/useSelector";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useRouteContext } from "@/lib/useRouteContext";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { MutationContext, useMutation } from "@/lib/useMutation";
import { useState } from "@/app/AppStateProvider";
import { StoreState } from "@/lib/createStore";
import { repertoirePath, trainingLinePath, trainingPath } from "@/lib/routes";
import { TrainingLines } from "./TrainingLines";

const FAILURE_DELAY = 1000;
const RESPONSE_DELAY = 500;
const REPLAY_RESET_DELAY = 500;

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

export function VariationTraining(props: {
  repertoireHandle: string;
  chapterHandle: string;
  lineId: string;
}) {
  useGlobalShortcuts();
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );

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
  const trainingStatus = useSelector((state) => state.training.status);
  const replayMoveIds = useSelector((state) => state.training.session?.replayMoveIds ?? null);
  const trainingVariationIsEmpty = useSelector(selectTrainingVariationIsEmpty);
  const trainingSessionStats = useSelector(selectTrainingSessionStats);
  const [boardIntroComplete, setBoardIntroComplete] = createSignal(false);

  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMoveFromEvalMove = useMutation(moveFromEvalMove);
  const onAutoMoveFromEvalMove = useMutation(addTrainingMoveSilently, { context: true });
  const onDeleteMove = useMutation(deleteMove);
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
    if (pgn == null) return [];
    return getTrainingLines(pgn, orientation());
  });

  const activeLineIndex = createMemo(() => lines().findIndex((line) => line.id === props.lineId));
  const activeLine = createMemo(() => lines()[activeLineIndex()]);
  const progress = createMemo(() => {
    const line = activeLine();
    if (line === undefined || line.plyCount === 0) return 0;
    return Object.keys(training().variation.moves).length / line.plyCount;
  });

  const variation = createMemo(() => {
    const pgn = chapterPgn();
    if (pgn == null) return [];
    const line = activeLine();
    return line === undefined ? [] : getVariationMoveIds(pgn, line.terminalMoveId);
  });

  const replayMoveId = createMemo(() => replayMoveIds()?.[0]);
  const isReplayingFailedMove = createMemo(() => replayMoveId() !== undefined);

  const chapterHasMoves = createMemo(() => {
    const pgn = chapterPgn();
    return pgn !== null && Object.keys(pgn.moves).length > 0;
  });

  const firstVariationMove = createMemo(() => {
    const pgn = chapterPgn();
    const firstMoveId = variation()[0];
    return firstMoveId === undefined ? undefined : pgn?.moves[firstMoveId];
  });

  const prepareReplayMove = (targetMoveId: number) => {
    const pgn = chapterPgn();
    if (pgn === null) return;
    const variationMoveIds = variation();
    const replayMoveIndex = variationMoveIds.indexOf(targetMoveId);
    if (replayMoveIndex < 0) return;
    const precedingMoves = variationMoveIds
      .slice(0, replayMoveIndex)
      .map((moveId) => pgn.moves[moveId])
      .filter((move) => move !== undefined)
      .map(moveToEvalMove);
    onPrepareTrainingReplayMove({ animateLastMove: true, precedingMoves });
  };

  let startedLineId: string | null = null;
  createEffect(
    () => ({
      line: activeLine(),
      lineIds: lines().map((line) => line.id),
      variationIndex: activeLineIndex(),
    }),
    ({ line, lineIds, variationIndex }) => {
      if (line === undefined || line.id === startedLineId) return;
      startedLineId = line.id;
      onStartTrainingLine({ lineIds, lineId: line.id, variationIndex });
    },
  );

  let replayPreparationRequest = 0;
  createEffect(
    () => {
      const queueKey = replayMoveIds()?.join(",") ?? "";
      const pgn = chapterPgn();
      const variationKey = variation().join(",");
      return pgn === null || queueKey === "" ? "" : `${queueKey}:${variationKey}`;
    },
    (replayPreparationKey) => {
      const requestId = ++replayPreparationRequest;
      if (replayPreparationKey === "") return;

      void delay(REPLAY_RESET_DELAY).then(() => {
        if (requestId !== replayPreparationRequest) return;
        const targetMoveId = untrack(replayMoveId);
        if (targetMoveId !== undefined) {
          untrack(() => prepareReplayMove(targetMoveId));
        }
      });
    },
  );

  createEffect(
    () => {
      const firstMove = firstVariationMove();
      const currentOrientation = orientation();
      return {
        currentMoveId: currentMove()?.id ?? null,
        firstHalfMoveNumber: firstMove?.halfMoveNumber ?? null,
        move: firstMove === undefined ? null : moveToEvalMove(firstMove),
        orientation: currentOrientation,
        boardIntroComplete: currentOrientation === "white" ? true : boardIntroComplete(),
        status: trainingStatus(),
        trainingVariationIsEmpty: trainingVariationIsEmpty(),
      };
    },
    ({
      currentMoveId,
      firstHalfMoveNumber,
      move,
      orientation,
      boardIntroComplete,
      status,
      trainingVariationIsEmpty,
    }) => {
      if (
        orientation !== "black" ||
        !boardIntroComplete ||
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
    const nextMoveId = replayMoveId() ?? variation()[currentHalfMoveNumber + 1];
    const nextMove = nextMoveId === undefined ? undefined : pgn.moves[nextMoveId];
    if (nextMove === undefined) {
      return;
    }

    onUpdateTrainingStatus("in-progress");
    onMoveFromChessboard(sourceSquare, targetSquare, piece);

    if (sourceSquare === nextMove.from && targetSquare === nextMove.to) {
      if (isReplayingFailedMove()) {
        onCompleteTrainingReplayMove({ lineId: props.lineId });
        return;
      }

      const responseId = variation()[currentHalfMoveNumber + 2];
      const response = responseId === undefined ? undefined : pgn.moves[responseId];

      if (response === undefined) {
        onCompleteTrainingLine({ lineId: props.lineId, completedMoveId: nextMove.id });
        return;
      }

      onUpdateTrainingStatus("in-progress");
      await delay(RESPONSE_DELAY);
      onMoveFromEvalMove(response);
      if (variation()[currentHalfMoveNumber + 3] === undefined) {
        onCompleteTrainingLine({ lineId: props.lineId, completedMoveId: nextMove.id });
      }
    } else if (
      isAlternativeTrainingMove(pgn, nextMove.id, orientation(), sourceSquare, targetSquare)
    ) {
      onUpdateTrainingStatus("alternative");
      await delay(FAILURE_DELAY);
      const moveId = selectedMoveId();
      if (moveId !== null) {
        onDeleteMove(moveId);
      }
    } else {
      await delay(FAILURE_DELAY);
      const moveId = selectedMoveId();
      if (moveId !== null) {
        onDeleteMove(moveId);
      }
      onMarkTrainingMistake({ moveId: nextMove.id });
    }
  };

  const moveFeedback = createMemo(() => {
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
    return {
      square: cm.to,
      type: trainingStatus() === "alternative" ? "alternativeMove" : "wrongMove",
    } as const;
  });

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

  return (
    <Show when={chapterPgn() !== null} fallback={null}>
      <Show
        when={activeLine()}
        fallback={
          <TrainingLines
            repertoireHandle={props.repertoireHandle}
            chapterHandle={props.chapterHandle}
            missingLine
          />
        }
      >
        <WorkspaceLayout
          title={<RepertoireBreadcrumb showTraining trainingLineId={props.lineId} />}
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
              onIntroComplete={() => setBoardIntroComplete(true)}
              annotations={(() => {
                const feedback = moveFeedback();
                return feedback === undefined
                  ? {}
                  : { [feedback.square]: [{ type: feedback.type }] };
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
                      replayingFailedMove: isReplayingFailedMove(),
                      trainingState: trainingStatus(),
                    })}
                  </span>
                  <Show when={trainingStatus() === "success"}>
                    <Show
                      when={nextUntrainedLine()}
                      fallback={
                        <Button
                          size="sm"
                          href={trainingPath(props.repertoireHandle, props.chapterHandle)}
                        >
                          Back to lines
                        </Button>
                      }
                    >
                      {(nextLine) => (
                        <Button
                          size="sm"
                          href={trainingLinePath(
                            props.repertoireHandle,
                            props.chapterHandle,
                            nextLine().id,
                          )}
                        >
                          Next line
                        </Button>
                      )}
                    </Show>
                  </Show>
                </Show>
              </div>
              <HorizontalDashedDivider
                animationKey="variation-training-moves"
                direction="right-to-left"
              />
              <MovesTree readOnly={false} />
              <PgnExplorerToolbar />
            </>
          }
        />
      </Show>
    </Show>
  );
}

function getInstruction({
  nextMoveIds,
  orientation,
  replayingFailedMove,
  trainingState,
}: {
  nextMoveIds: number[];
  orientation: Orientation;
  replayingFailedMove: boolean;
  trainingState: TrainingState;
}): string {
  if (nextMoveIds.length > 0) {
    return "Go to the end of the line to continue the drill.";
  } else if (trainingState === "in-progress") {
    return replayingFailedMove
      ? "Replay the failed move."
      : `${orientation === "black" ? "Black" : "White"} to play.`;
  } else if (trainingState === "alternative") {
    return "That move belongs to an alternative line. Find another one.";
  } else if (trainingState === "failure") {
    return "Try again.";
  } else if (trainingState === "success") {
    return "Good job!";
  } else if (trainingState === "complete") return "Session complete.";
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
