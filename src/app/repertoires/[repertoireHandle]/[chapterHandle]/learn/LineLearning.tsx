import { Chessboard } from "@/components/Chessboard/Chessboard";
import { useState } from "@/app/AppStateProvider";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/button";
import { MovesTree } from "@/components/MovesTree";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import {
  deleteMove,
  getChapterPgn,
  getTrainingLines,
  getVariationMoveIds,
  isMoveValid,
  moveFromChessboard,
  moveToEvalMove,
  selectAnimation,
  selectFen,
  selectOrientation,
  selectSelectedMoveId,
  selectTraining,
} from "@/lib/AppState";
import { trainingPath } from "@/lib/routes";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useMutation } from "@/lib/useMutation";
import { useRouteContext } from "@/lib/useRouteContext";
import { useSelector } from "@/lib/useSelector";
import { delay } from "@/lib/utils";
import {
  markLineLearned,
  playLearningMove,
  removeLearningPreview,
  startLearningLine,
} from "@/mutations/learningSession";
import { createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js";
import { TrainingLines } from "../train/TrainingLines";

const INITIAL_DEMONSTRATION_DELAY = 650;
const MOVE_RESPONSE_DELAY = 400;
const MOVE_DEMONSTRATION_DURATION = 700;
const WRONG_MOVE_DELAY = 700;

type LearningPhase = "starting" | "opponent" | "preview" | "repeat" | "wrong" | "complete";

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
  const currentFen = useSelector(selectFen);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const selectedMoveId = useSelector(selectSelectedMoveId);
  const [phase, setPhase] = createSignal<LearningPhase>("starting");
  const [wrongSquare, setWrongSquare] = createSignal<string | null>(null);
  const [boardIntroComplete, setBoardIntroComplete] = createSignal(false);

  const onStartLearningLine = useMutation(startLearningLine);
  const onPlayLearningMove = useMutation(playLearningMove);
  const onRemoveLearningPreview = useMutation(removeLearningPreview);
  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onDeleteMove = useMutation(deleteMove);
  const onMarkLineLearned = useMutation(markLineLearned);

  const lines = createMemo(() => {
    const pgn = chapterPgn();
    return pgn === null ? [] : getTrainingLines(pgn);
  });
  const activeLine = createMemo(() => lines().find((line) => line.id === props.lineId));
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

  let flowVersion = 0;
  onCleanup(() => {
    flowVersion += 1;
  });

  function isCurrentFlow(version: number, lineId: string): boolean {
    return version === flowVersion && props.lineId === lineId;
  }

  function currentRevealedPlyCount(): number {
    return Object.keys(state.training.variation.moves).length;
  }

  async function advanceLearning(version: number, lineId: string, delayBeforeMove: boolean) {
    const pgn = chapterPgn();
    const sourceMoveId = variation()[currentRevealedPlyCount()];
    const sourceMove = sourceMoveId === undefined ? undefined : pgn?.moves[sourceMoveId];

    if (sourceMove === undefined) {
      onMarkLineLearned(lineId);
      setPhase("complete");
      return;
    }

    const moveColor = sourceMove.halfMoveNumber % 2 === 0 ? "white" : "black";
    if (delayBeforeMove) {
      await delay(MOVE_RESPONSE_DELAY);
      if (!isCurrentFlow(version, lineId)) return;
    }

    if (moveColor !== orientation()) {
      setPhase("opponent");
      onPlayLearningMove({
        sourceMove,
        input: moveToEvalMove(sourceMove),
        animate: true,
      });
      await delay(MOVE_RESPONSE_DELAY);
      if (!isCurrentFlow(version, lineId)) return;
      await advanceLearning(version, lineId, false);
      return;
    }

    setPhase("preview");
    onPlayLearningMove({
      sourceMove,
      input: moveToEvalMove(sourceMove),
      animate: true,
    });
    await delay(MOVE_DEMONSTRATION_DURATION);
    if (!isCurrentFlow(version, lineId)) return;

    const previewMoveId = selectedMoveId();
    if (previewMoveId === null) return;
    onRemoveLearningPreview(previewMoveId);
    setPhase("repeat");
  }

  createEffect(
    () => {
      const currentOrientation = orientation();
      return {
        boardIntroComplete: currentOrientation === "white" ? true : boardIntroComplete(),
        line: activeLine(),
        lineId: props.lineId,
        orientation: currentOrientation,
      };
    },
    ({ boardIntroComplete, line, lineId, orientation }) => {
      flowVersion += 1;
      const version = flowVersion;
      setWrongSquare(null);
      setPhase("starting");
      if (line === undefined || (orientation === "black" && !boardIntroComplete)) return;

      untrack(() => {
        onStartLearningLine();
        void (async () => {
          if (orientation === "white") {
            await delay(INITIAL_DEMONSTRATION_DELAY);
            if (!isCurrentFlow(version, lineId)) return;
          }
          await advanceLearning(version, lineId, false);
        })();
      });
    },
  );

  async function onPieceDrop(sourceSquare: string, targetSquare: string, piece: string) {
    if (phase() !== "repeat") return;

    const pgn = chapterPgn();
    const sourceMoveId = variation()[currentRevealedPlyCount()];
    const sourceMove = sourceMoveId === undefined ? undefined : pgn?.moves[sourceMoveId];
    if (sourceMove === undefined || !isMoveValid(state, ctx(), sourceSquare, targetSquare, piece)) {
      return;
    }

    if (sourceSquare === sourceMove.from && targetSquare === sourceMove.to) {
      setPhase("starting");
      onPlayLearningMove({
        sourceMove,
        input: { from: sourceSquare, to: targetSquare, piece },
        animate: false,
      });
      await advanceLearning(flowVersion, props.lineId, true);
      return;
    }

    setPhase("wrong");
    setWrongSquare(targetSquare);
    onMoveFromChessboard(sourceSquare, targetSquare, piece);
    const version = flowVersion;
    const lineId = props.lineId;
    await delay(WRONG_MOVE_DELAY);
    if (!isCurrentFlow(version, lineId)) return;
    const wrongMoveId = selectedMoveId();
    if (wrongMoveId !== null) onDeleteMove(wrongMoveId);
    setWrongSquare(null);
    setPhase("repeat");
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
            />
          }
          chessboard={
            <Chessboard
              boardOrientation={orientation()}
              position={currentFen()}
              canDrag={phase() === "repeat"}
              onPieceDrop={onPieceDrop}
              pieceToAnimate={animation()}
              arrows={{}}
              squareHighlights={{}}
              onHighlightSquare={() => {}}
              onDrawArrow={() => {}}
              onIntroComplete={() => setBoardIntroComplete(true)}
              annotations={
                wrongSquare() === null ? {} : { [wrongSquare() ?? ""]: [{ type: "wrongMove" }] }
              }
            />
          }
          evalBar={null}
          panelChildren={
            <>
              <ProgressBar progress={progress()} />
              <div class="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                <span aria-live="polite">{learningInstruction(phase(), orientation())}</span>
                <Show when={phase() === "complete"}>
                  <Button
                    size="sm"
                    href={trainingPath(props.repertoireHandle, props.chapterHandle)}
                  >
                    Back to lines
                  </Button>
                </Show>
              </div>
              <HorizontalDashedDivider animation="none" />
              <MovesTree readOnly />
            </>
          }
        />
      </Show>
    </Show>
  );
}

function learningInstruction(phase: LearningPhase, orientation: "white" | "black"): string {
  if (phase === "preview") return "Watch this move.";
  if (phase === "repeat") return "Now repeat the move.";
  if (phase === "wrong") return "That’s not the move. Try again.";
  if (phase === "complete") return "Line learned.";
  if (phase === "opponent") return `${orientation === "white" ? "Black" : "White"} responds.`;
  return "Get ready…";
}
