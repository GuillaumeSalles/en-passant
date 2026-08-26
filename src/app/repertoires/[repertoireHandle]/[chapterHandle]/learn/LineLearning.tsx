import { Chessboard } from "@/components/Chessboard/Chessboard";
import { useState } from "@/app/AppStateProvider";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/button";
import { MovesTree } from "@/components/MovesTree";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { useSquareHighlights } from "@/components/useSquareHighlights";
import {
  getChapterPgn,
  getTrainingLines,
  getVariationMoveIds,
  findOpening,
  isMoveValid,
  moveFromChessboard,
  moveToEvalMove,
  selectAnimation,
  selectFen,
  selectHighlights,
  selectNagAnnotations,
  selectOrientation,
  selectSelectedMoveId,
  selectTraining,
  toggleArrowOnSelectedMove,
  toggleSquareOnSelectedMove,
} from "@/lib/AppState";
import { createPacingTimer } from "@/lib/createPacingTimer";
import { learningLinePath, trainingPath } from "@/lib/routes";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useMutation } from "@/lib/useMutation";
import { useOpeningIndex } from "@/lib/useOpeningIndex";
import { useRouteContext } from "@/lib/useRouteContext";
import { useSelector } from "@/lib/useSelector";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import {
  markLineLearned,
  playLearningMove,
  removeLearningPreview,
  startLearningLine,
  trainingLineScheduleKey,
} from "@/mutations/learningSession";
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js";
import { useParams } from "@solidjs/router";
import { useRedirectMissingRepertoireRoute } from "@/app/routeRedirects";
import { TrainingLines } from "../train/TrainingLines";
import { useVariationTrainingFlow } from "../train/useVariationTrainingFlow";
import {
  acceptsLearningMove,
  initialLearningFlowState,
  learningInstruction,
  reduceLearningFlow,
  type LearningFlowCommand,
  type LearningFlowEvent,
  type LearningPacingKind,
} from "./learningFlow";

const AFTER_CORRECT_MOVE_DELAY = 400;
const AFTER_OPPONENT_MOVE_DELAY = 180;
const DEMONSTRATION_HOLD_DELAY = 480;
const WRONG_MOVE_DELAY = 700;
const LEARNING_BOUNDARY_DELAY = 1000;

export function LineLearning(props: {
  repertoireHandle: string;
  chapterHandle: string;
  lineId: string;
}) {
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );

  const state = useState();
  const ctx = useRouteContext();
  const chapterPgn = useSelector(getChapterPgn);
  const training = useSelector(selectTraining);
  const reviews = useSelector((state) => state.training.reviews);
  const currentFen = useSelector(selectFen);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const squareHighlights = useSquareHighlights();
  const [flow, setFlow] = createSignal(initialLearningFlowState);
  let currentFlow = initialLearningFlowState;
  const [boardIntroComplete, setBoardIntroComplete] = createSignal(false);
  const pacingTimer = createPacingTimer();
  const completedLineHighlights = useSelector(selectHighlights);
  const completedLineAnnotations = useSelector(selectNagAnnotations);
  const onDrawArrow = useMutation(toggleArrowOnSelectedMove);
  const onHighlightSquare = useMutation(toggleSquareOnSelectedMove);

  useGlobalShortcuts({
    allowEditing: true,
    enabled: () => flow().type === "complete",
  });

  const onStartLearningLine = useMutation(startLearningLine);
  const onPlayLearningMove = useMutation(playLearningMove);
  const onRemoveLearningPreview = useMutation(removeLearningPreview);
  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMarkLineLearned = useMutation(markLineLearned);
  const reinforcement = useVariationTrainingFlow(props, {
    enabled: () => flow().type === "reinforcement",
    repetitions: 2,
    boundaryDelayMs: LEARNING_BOUNDARY_DELAY,
    onLineComplete: () => {
      const line = activeLine();
      if (line !== undefined) onMarkLineLearned(line.uciPath);
      dispatch({ type: "REINFORCEMENT_COMPLETE" });
    },
  });

  const lines = createMemo(() => {
    const pgn = chapterPgn();
    return pgn === null ? [] : getTrainingLines(pgn, orientation());
  });
  const activeLine = createMemo(() => lines().find((line) => line.id === props.lineId));
  const openingIndex = useOpeningIndex();
  const activeOpeningName = createMemo(() => {
    const pgn = chapterPgn();
    const line = activeLine();
    const openings = openingIndex();
    if (pgn === null || line === undefined || openings.status === "loading") return null;
    return findOpening(pgn, line.terminalMoveId, openings.data)?.name ?? null;
  });
  const nextLineToLearn = createMemo(() => {
    const allLines = lines();
    const activeLineIndex = allLines.findIndex((line) => line.id === props.lineId);
    if (activeLineIndex < 0) return undefined;

    for (let offset = 1; offset <= allLines.length; offset++) {
      const line = allLines[(activeLineIndex + offset) % allLines.length];
      if (line === undefined) continue;
      const scheduleKey = trainingLineScheduleKey(state, ctx(), line.uciPath);
      if (scheduleKey === null || reviews()[scheduleKey] === undefined) return line;
    }
    return undefined;
  });
  const variation = createMemo(() => {
    const pgn = chapterPgn();
    const line = activeLine();
    return pgn === null || line === undefined ? [] : getVariationMoveIds(pgn, line.terminalMoveId);
  });
  const revealedPlyCount = createMemo(() => Object.keys(training().variation.moves).length);
  const progress = createMemo(() => {
    const line = activeLine();
    return line === undefined || line.plyCount === 0 ? 0 : revealedPlyCount() / line.plyCount;
  });
  const wrongSquare = createMemo(() => {
    const current = flow();
    return current.type === "recording-wrong" || current.type === "showing-wrong"
      ? current.square
      : null;
  });

  onCleanup(() => {
    pacingTimer.cancel();
  });

  function currentRevealedPlyCount(): number {
    return Object.keys(state.training.variation.moves).length;
  }

  function pacingDuration(kind: LearningPacingKind): number {
    switch (kind) {
      case "after-correct":
        return AFTER_CORRECT_MOVE_DELAY;
      case "after-opponent":
        return AFTER_OPPONENT_MOVE_DELAY;
      case "preview-hold":
        return DEMONSTRATION_HOLD_DELAY;
      case "wrong":
        return WRONG_MOVE_DELAY;
    }
  }

  function executeCommand(command: LearningFlowCommand): void {
    switch (command.type) {
      case "START_LINE":
        onStartLearningLine();
        return;
      case "ADVANCE": {
        const pgn = chapterPgn();
        const sourceMoveId = variation()[currentRevealedPlyCount()];
        if (pgn === null || sourceMoveId === undefined) {
          dispatch({ type: "NO_NEXT_MOVE" });
          return;
        }
        const sourceMove = pgn.moves[sourceMoveId];
        if (sourceMove === undefined) {
          dispatch({ type: "RESET" });
          return;
        }
        const moveColor = sourceMove.halfMoveNumber % 2 === 0 ? "white" : "black";
        dispatch({
          type: "NEXT_MOVE",
          role: moveColor === orientation() ? "preview" : "opponent",
          sourceMoveId,
        });
        return;
      }
      case "PLAY_ANIMATED_MOVE": {
        const sourceMove = chapterPgn()?.moves[command.sourceMoveId];
        if (sourceMove === undefined) {
          dispatch({ type: "RESET" });
          return;
        }
        onPlayLearningMove({
          sourceMove,
          input: moveToEvalMove(sourceMove),
          animate: true,
        });
        const renderedMoveId = selectSelectedMoveId(state, ctx());
        if (renderedMoveId === null) {
          dispatch({ type: "RESET" });
          return;
        }
        dispatch({
          type: "ANIMATION_STARTED",
          sourceMoveId: command.sourceMoveId,
          renderedMoveId,
          animationId: selectAnimation(state, ctx())?.id ?? null,
        });
        return;
      }
      case "PLAY_CORRECT_MOVE": {
        const sourceMove = chapterPgn()?.moves[command.sourceMoveId];
        if (sourceMove === undefined) {
          dispatch({ type: "RESET" });
          return;
        }
        onPlayLearningMove({ sourceMove, input: command.input, animate: false });
        return;
      }
      case "PLAY_WRONG_MOVE": {
        onMoveFromChessboard(command.input.from, command.input.to, command.input.piece);
        const moveId = selectSelectedMoveId(state, ctx());
        if (moveId === null) {
          dispatch({ type: "RESET" });
          return;
        }
        dispatch({ type: "WRONG_MOVE_RECORDED", moveId });
        return;
      }
      case "REMOVE_MOVE":
        onRemoveLearningPreview(command.moveId);
        return;
      case "SCHEDULE_PACING":
        pacingTimer.schedule(pacingDuration(command.kind), () => {
          dispatch({ type: "PACING_ELAPSED", kind: command.kind });
        });
        return;
    }
  }

  function dispatch(event: LearningFlowEvent): boolean {
    const current = currentFlow;
    const transition = reduceLearningFlow(current, event);
    if (transition.state === current && transition.commands.length === 0) return false;
    if (event.type === "RESET") pacingTimer.cancel();
    currentFlow = transition.state;
    setFlow(transition.state);
    for (const command of transition.commands) executeCommand(command);
    return true;
  }

  function readyLearningFlow() {
    const pgn = chapterPgn();
    if (pgn === null || activeLine() === undefined || !boardIntroComplete()) return;
    dispatch({ type: "READY" });
  }

  createEffect(
    () => {
      const currentOrientation = orientation();
      return {
        boardIntroComplete: boardIntroComplete(),
        line: activeLine(),
        lineId: props.lineId,
        orientation: currentOrientation,
      };
    },
    ({ boardIntroComplete, line }) => {
      if (line === undefined || !boardIntroComplete) return;
      untrack(readyLearningFlow);
    },
  );

  function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string) {
    if (!acceptsLearningMove(currentFlow)) return;

    const pgn = chapterPgn();
    const sourceMoveId = variation()[currentRevealedPlyCount()];
    const sourceMove = sourceMoveId === undefined ? undefined : pgn?.moves[sourceMoveId];
    if (sourceMove === undefined || !isMoveValid(state, ctx(), sourceSquare, targetSquare, piece)) {
      return;
    }

    if (sourceSquare === sourceMove.from && targetSquare === sourceMove.to) {
      dispatch({
        type: "CORRECT_MOVE",
        sourceMoveId: sourceMove.id,
        input: { from: sourceSquare, to: targetSquare, piece },
      });
      return;
    }

    dispatch({
      type: "WRONG_MOVE",
      input: { from: sourceSquare, to: targetSquare, piece },
    });
  }

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
          title={
            <RepertoireBreadcrumb
              showTraining={false}
              trainingLineId={null}
              learningLineId={props.lineId}
              lineName={activeOpeningName()}
              readLine={false}
            />
          }
          chessboard={
            <Chessboard
              boardOrientation={orientation()}
              position={currentFen()}
              canDrag={
                flow().type === "reinforcement"
                  ? reinforcement.canDrag()
                  : acceptsLearningMove(flow())
              }
              readOnly={false}
              animateIntro
              onPieceDrop={
                flow().type === "reinforcement" ? reinforcement.onPieceDrop : onPieceDrop
              }
              pieceToAnimate={animation()}
              arrows={flow().type === "complete" ? completedLineHighlights().arrows : {}}
              squareHighlights={squareHighlights()}
              onHighlightSquare={(square, highlight) => {
                if (flow().type === "complete") onHighlightSquare(square, highlight);
              }}
              onDrawArrow={(from, to, highlight) => {
                if (flow().type === "complete") onDrawArrow(from, to, highlight);
              }}
              onIntroComplete={() => {
                setBoardIntroComplete(true);
                reinforcement.onIntroComplete();
              }}
              onAnimationSettled={(animationId) => {
                dispatch({ type: "ANIMATION_SETTLED", animationId });
                reinforcement.onAnimationSettled(animationId);
              }}
              annotations={
                flow().type === "complete"
                  ? completedLineAnnotations()
                  : flow().type === "reinforcement"
                    ? reinforcement.annotations()
                    : wrongSquare() !== null
                      ? { [wrongSquare() ?? ""]: [{ type: "wrongMove" }] }
                      : {}
              }
            />
          }
          evalBar={null}
          panelChildren={
            <>
              <ProgressBar
                progress={flow().type === "reinforcement" ? reinforcement.progress() : progress()}
              />
              <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                <span
                  aria-live="polite"
                  data-learning-flow-state={flow().type}
                  data-training-flow-state={
                    flow().type === "reinforcement" ? reinforcement.phase().type : undefined
                  }
                >
                  {flow().type === "reinforcement"
                    ? `Practice ${reinforcement.completedRepetitions() + 1} of 2: ${reinforcement.instruction()}`
                    : learningInstruction(flow(), orientation())}
                </span>
                <Show when={flow().type === "complete"}>
                  <Show
                    when={nextLineToLearn()}
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
                        href={learningLinePath(
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
              </div>
              <HorizontalDashedDivider animation="none" />
              <Show
                when={flow().type === "complete"}
                fallback={<MovesTree readOnly canAnnotate={false} />}
              >
                <MovesTree readOnly canAnnotate={true} />
              </Show>
            </>
          }
        />
      </Show>
    </Show>
  );
}

export default function LineLearningRoute() {
  const params = useParams<{
    lineRepertoireHandle: string;
    lineChapterHandle: string;
    lineId: string;
  }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.lineRepertoireHandle,
    getChapterHandle: () => params.lineChapterHandle,
  });
  const scope = createMemo(() => ({
    repertoireHandle: params.lineRepertoireHandle,
    chapterHandle: params.lineChapterHandle,
    lineId: params.lineId,
  }));
  return (
    <Show keyed when={scope()}>
      {(currentScope) => <LineLearning {...currentScope} />}
    </Show>
  );
}
