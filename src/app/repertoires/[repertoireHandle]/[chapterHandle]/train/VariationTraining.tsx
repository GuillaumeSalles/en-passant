import { Chessboard } from "@/components/Chessboard/Chessboard";
import { MovesTree } from "@/components/MovesTree";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { VerticalDashedDivider } from "@/components/ui/VerticalDashedDivider";
import { Button } from "@/components/ui/button";
import type { TrainingSessionSummary } from "@/lib/AppState";
import { repertoirePath, trainingLinePath, trainingPath } from "@/lib/routes";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { Show } from "solid-js";
import { useParams } from "@solidjs/router";
import { useRedirectMissingRepertoireRoute } from "@/app/routeRedirects";
import { TrainingLines } from "./TrainingLines";
import { useVariationTrainingFlow } from "./useVariationTrainingFlow";

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

  const flow = useVariationTrainingFlow(props);

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
              squareHighlights={{}}
              onHighlightSquare={() => {}}
              onDrawArrow={() => {}}
              onIntroComplete={flow.onIntroComplete}
              annotations={flow.annotations()}
            />
          }
          evalBar={null}
          panelChildren={
            <>
              <TrainingSessionStats result={flow.trainingSessionStats()} />
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
  return (
    <VariationTraining
      repertoireHandle={params.repertoireHandle}
      chapterHandle={params.chapterHandle}
      lineId={params.lineId}
    />
  );
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
