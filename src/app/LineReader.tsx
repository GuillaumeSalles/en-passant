import { useParams } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import { useState } from "@/app/AppStateProvider";
import { Chessboard } from "@/components/Chessboard/Chessboard";
import { MovesTree } from "@/components/MovesTree";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { RepertoireBreadcrumb } from "@/components/RepertoireBreadcrumb";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { Button } from "@/components/ui/button";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import {
  getChapterScopeByHandles,
  getPgn,
  selectAnimation,
  selectFen,
  selectHighlights,
  selectNagAnnotations,
  selectOrientation,
} from "@/lib/AppState";
import { trainingPath } from "@/lib/routes";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { useSelector } from "@/lib/useSelector";
import { useSquareHighlights } from "@/components/useSquareHighlights";
import { useRedirectMissingRepertoireRoute } from "./routeRedirects";

type LineReaderProps = {
  repertoireHandle: string;
  chapterHandle: string;
  lineId: string;
};

function LineUnavailable(props: Pick<LineReaderProps, "repertoireHandle" | "chapterHandle">) {
  return (
    <FullWidthLayout
      title={<RepertoireBreadcrumb showTraining={false} trainingLineId={null} readLine />}
      reserveRightSlot
      showMobileHeaderDivider
    >
      <div class="p-4">
        <div class="max-w-md rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          <p>This line no longer exists in the chapter.</p>
          <Button
            class="mt-3"
            size="sm"
            href={trainingPath(props.repertoireHandle, props.chapterHandle)}
          >
            Back to lines
          </Button>
        </div>
      </div>
    </FullWidthLayout>
  );
}

export function LineReader(props: LineReaderProps) {
  const state = useState();
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );
  useGlobalShortcuts({ allowEditing: false });

  const linePgn = useSelector(getPgn);
  const currentFen = useSelector(selectFen);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const highlights = useSelector(selectHighlights);
  const annotations = useSelector(selectNagAnnotations);
  const squareHighlights = useSquareHighlights();
  const hasFinishedLoading = createMemo(() => {
    if (state.repertoires.status !== "success" || state.chapters.status !== "success") {
      return false;
    }
    const scope = getChapterScopeByHandles(state, props.repertoireHandle, props.chapterHandle);
    if (scope === null) return true;
    const pgn = state.pgns[scope.chapter.pgnId];
    return pgn?.status === "success" || pgn?.status === "error";
  });

  return (
    <Show
      when={linePgn()}
      fallback={
        <Show when={hasFinishedLoading()}>
          <LineUnavailable
            repertoireHandle={props.repertoireHandle}
            chapterHandle={props.chapterHandle}
          />
        </Show>
      }
    >
      <WorkspaceLayout
        title={<RepertoireBreadcrumb showTraining={false} trainingLineId={null} readLine />}
        chessboard={
          <Chessboard
            boardOrientation={orientation()}
            position={currentFen()}
            canDrag={false}
            onPieceDrop={() => {}}
            pieceToAnimate={animation()}
            arrows={highlights().arrows}
            squareHighlights={squareHighlights()}
            onHighlightSquare={() => {}}
            onDrawArrow={() => {}}
            annotations={annotations()}
          />
        }
        evalBar={null}
        panelChildren={
          <>
            <MovesTree readOnly />
            <PgnExplorerToolbar />
          </>
        }
      />
    </Show>
  );
}

export default function LineReaderRoute() {
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
      {(currentScope) => <LineReader {...currentScope} />}
    </Show>
  );
}
