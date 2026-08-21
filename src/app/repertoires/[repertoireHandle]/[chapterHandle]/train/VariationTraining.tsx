import { Chessboard } from "@/components/Chessboard/Chessboard";
import { MovesTree } from "@/components/MovesTree";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { useSquareHighlights } from "@/components/useSquareHighlights";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { Button } from "@/components/ui/button";
import type { TrainingSessionSummary } from "@/lib/AppState";
import {
  chapterTrainingLineReviewPath,
  repertoirePath,
  trainingLinePath,
  trainingPath,
  trainingQueueReviewPath,
} from "@/lib/routes";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useMutation } from "@/lib/useMutation";
import { createEffect, createMemo, Show } from "solid-js";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { useState } from "@/app/AppStateProvider";
import { useRedirectMissingRepertoireRoute } from "@/app/routeRedirects";
import { completeTrainingQueueReviewLine } from "@/mutations/trainingSession";
import { TrainingLines } from "./TrainingLines";
import { useVariationTrainingFlow } from "./useVariationTrainingFlow";

const REVIEW_LINE_BOUNDARY_DELAY = 1000;

export function VariationTraining(props: {
  repertoireHandle: string;
  chapterHandle: string;
  lineId: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useState();
  const onCompleteTrainingQueueReviewLine = useMutation(completeTrainingQueueReviewLine);
  useGlobalShortcuts();
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );
  const reviewMode = () => new URLSearchParams(location.search).get("review");
  const isReviewingQueue = () => reviewMode() === "due";
  const isReviewingChapter = () => reviewMode() === "chapter";

  createEffect(
    () => ({
      chapterHandle: props.chapterHandle,
      repertoireHandle: props.repertoireHandle,
      reviewMode: reviewMode(),
      reviewQueue: state.training.reviewQueue,
    }),
    ({ chapterHandle, repertoireHandle, reviewMode, reviewQueue }) => {
      if (reviewQueue !== null) return;
      if (reviewMode === "due") {
        navigate(trainingQueueReviewPath(), { replace: true });
      } else if (reviewMode === "chapter") {
        navigate(trainingPath(repertoireHandle, chapterHandle), { replace: true });
      }
    },
  );

  const flow = useVariationTrainingFlow(props, {
    boundaryDelayMs: () =>
      isReviewingQueue() || isReviewingChapter() ? REVIEW_LINE_BOUNDARY_DELAY : 0,
    onLineComplete: () => {
      if (isReviewingQueue()) {
        onCompleteTrainingQueueReviewLine();
        navigate(trainingQueueReviewPath(), { replace: true });
      } else if (isReviewingChapter()) {
        onCompleteTrainingQueueReviewLine();
        const nextLine = flow.nextDueLine();
        navigate(
          nextLine === undefined
            ? trainingPath(props.repertoireHandle, props.chapterHandle)
            : chapterTrainingLineReviewPath(
                props.repertoireHandle,
                props.chapterHandle,
                nextLine.id,
              ),
          { replace: true },
        );
      }
    },
  });
  const squareHighlights = useSquareHighlights();

  return (
    <Show when={flow.chapterPgn() !== null} fallback={null}>
      <Show
        when={flow.activeLine()}
        fallback={
          <TrainingLines
            repertoireHandle={props.repertoireHandle}
            chapterHandle={props.chapterHandle}
            missingLine
          />
        }
      >
        <Show when={flow.isInitialized()}>
          <WorkspaceLayout
            title={<RepertoireBreadcrumb showTraining trainingLineId={props.lineId} />}
            chessboard={
              <Chessboard
                boardOrientation={flow.orientation()}
                position={flow.currentFen()}
                canDrag={flow.canDrag()}
                onPieceDrop={flow.onPieceDrop}
                pieceToAnimate={flow.animation()}
                arrows={{}}
                squareHighlights={squareHighlights()}
                onHighlightSquare={() => {}}
                onDrawArrow={() => {}}
                onIntroComplete={flow.onIntroComplete}
                annotations={flow.annotations()}
              />
            }
            evalBar={null}
            panelChildren={
              <>
                <TrainingSessionStats
                  result={flow.trainingSessionStats()}
                  reviewQueue={state.training.reviewQueue}
                  isLineComplete={flow.isLineComplete()}
                />
                <ProgressBar progress={flow.progress()} />
                <Show when={flow.chapterHasMoves()}>
                  <HorizontalDashedDivider
                    animationKey="variation-training-instructions-top"
                    direction="right-to-left"
                  />
                </Show>
                <div class="flex items-center justify-between gap-2 px-4 py-2">
                  <Show
                    when={flow.chapterHasMoves()}
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
                    <span>{flow.instruction()}</span>
                    <Show when={flow.isLineComplete()}>
                      <Show
                        when={flow.nextUntrainedLine()}
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
    </Show>
  );
}

export default function VariationTrainingRoute() {
  const params = useParams<{
    repertoireHandle: string;
    chapterHandle: string;
    lineId: string;
  }>();
  useRedirectMissingRepertoireRoute({
    getRepertoireHandle: () => params.repertoireHandle,
    getChapterHandle: () => params.chapterHandle,
  });
  const scope = createMemo(() => ({
    repertoireHandle: params.repertoireHandle,
    chapterHandle: params.chapterHandle,
    lineId: params.lineId,
  }));
  return (
    <Show keyed when={scope()}>
      {(currentScope) => <VariationTraining {...currentScope} />}
    </Show>
  );
}

function TrainingSessionStats(props: {
  result: TrainingSessionSummary | null;
  reviewQueue: { reviewed: number; total: number } | null;
  isLineComplete: boolean;
}) {
  return (
    <Show when={props.result}>
      {(result) => (
        <div class="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] text-center text-sm">
          <StatCell
            label="Lines"
            value={
              props.reviewQueue === null
                ? lineCounter(result().tried, result().total, props.isLineComplete)
                : lineCounter(
                    props.reviewQueue.reviewed,
                    props.reviewQueue.total,
                    props.isLineComplete,
                  )
            }
          />
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

export function lineCounter(completed: number, total: number, isLineComplete: boolean): string {
  const current = Math.min(completed + (isLineComplete ? 0 : 1), total);
  return `${current}/${total}`;
}

function StatCell(props: { label: string; value: string }) {
  return (
    <div class="bg-background px-2 py-2">
      <div class="text-xs text-muted-foreground">{props.label}</div>
      <div class="font-medium">{props.value}</div>
    </div>
  );
}
