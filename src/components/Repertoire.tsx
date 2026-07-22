import { createEffect, onCleanup, Show, untrack } from "solid-js";
import {
  addEvalMoves,
  AppState,
  ArrowKind,
  Arrows,
  Context,
  Eval,
  EvalMove,
  findMoveIdByPositionKey,
  getPgn,
  getNagGlyph,
  getNagMeaning,
  HighlightKind,
  moveFromChessboard,
  moveFromEvalMove,
  selectAnimation,
  selectFen,
  selectNextMoveIds,
  selectOrientation,
  selectMove,
  selectedMove,
  updateEvaluation,
} from "@/lib/AppState";
import { MovesTree } from "./MovesTree";
import { EvalBar } from "./EvalBar";
import { Engine } from "@/lib/engine";
import { ComputerEvaluation } from "./ComputerEvaluation";
import { Chessboard } from "./Chessboard/Chessboard";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { PgnExplorerToolbar } from "./PgnExplorerToolbar";
import { useSquareHighlights } from "./useSquareHighlights";
import { VariationSelector } from "./VariationSelector";
import { useSelector } from "@/lib/useSelector";
import { useLoadPgn } from "@/lib/useLoadPgn";
import { MutationContext, useMutation } from "@/lib/useMutation";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";
import { RepertoireHeader } from "./RepertoireHeader";
import { StoreState } from "@/lib/createStore";
import { PositionMoveStats } from "./PositionMoveStats";

function positionStatMove(uci: string, san: string): EvalMove | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || null,
    san,
  };
}

function getBestMoveArrow(evaluations: Eval[]): { [fromTo: string]: ArrowKind } {
  const evaluation = evaluations[0];
  const bestMove = evaluation?.moves[0];
  if (bestMove === undefined) return {};
  return { [bestMove.from + bestMove.to]: "best-move" };
}

function getArrows(
  arrows: Arrows,
  evaluations: Eval[],
  isEngineEnabled: boolean,
  showBestMoveArrow: boolean,
): { [fromTo: string]: ArrowKind } {
  if (!isEngineEnabled || !showBestMoveArrow) return arrows;
  return { ...arrows, ...getBestMoveArrow(evaluations) };
}

function drawArrow(
  state: StoreState<AppState>,
  _ctx: Context,
  from: string,
  to: string,
  type: HighlightKind,
): void {
  const newArrows = { ...state.highlights.arrows };
  const existingArrow = newArrows[from + to];
  if (existingArrow === type) {
    delete newArrows[from + to];
  } else {
    newArrows[from + to] = type;
  }
  state.set("highlights", { ...state.highlights, arrows: newArrows });
}

function highlightSquare(
  state: StoreState<AppState>,
  _ctx: Context,
  square: string,
  highlight: HighlightKind,
): void {
  const newSquares = { ...state.highlights.squares };
  const existingHighlight = newSquares[square];
  if (existingHighlight === highlight) {
    delete newSquares[square];
  } else {
    newSquares[square] = highlight;
  }
  state.set("highlights", { ...state.highlights, squares: newSquares });
}

function updateNumberOfLines({ store }: MutationContext, numberOfLines: number) {
  store.state.set("engineSettings", {
    ...store.state.engineSettings,
    numberOfLines,
  });
}

function selectEngineDepth(state: AppState, _ctx: Context): number {
  return state.engineSettings.depth;
}

function selectIsEngineEnabled(state: AppState, _ctx: Context): boolean {
  return state.engineSettings.isEnabled;
}

function selectEvaluations(state: AppState, _ctx: Context): Eval[] {
  return state.evaluations;
}

function selectIsEvalBarVisible(state: AppState, _ctx: Context): boolean {
  return state.engineSettings.isEnabled && state.engineSettings.showEvalBar;
}

function selectNagAnnotations(
  state: AppState,
  ctx: Context,
): { [square: string]: { type: "nag"; glyph: string; meaning: string }[] } {
  const move = selectedMove(state, ctx);
  if (move === null || move.nags.length === 0) return {};
  return {
    [move.to]: move.nags.slice(0, 2).map((nag) => ({
      type: "nag",
      glyph: getNagGlyph(nag),
      meaning: getNagMeaning(nag),
    })),
  };
}

export function Repertoire(props: {
  repertoireHandle: string;
  chapterHandle: string;
  requestedPositionKey: string | null;
}) {
  useLoadPgn(
    () => props.repertoireHandle,
    () => props.chapterHandle,
  );

  const pgn = useSelector(getPgn);
  const currentFen = useSelector(selectFen);
  const engineDepth = useSelector(selectEngineDepth);
  const isEngineEnabled = useSelector(selectIsEngineEnabled);
  const orientation = useSelector(selectOrientation);
  const evaluations = useSelector(selectEvaluations);
  const animation = useSelector(selectAnimation);
  const isEvalBarVisible = useSelector(selectIsEvalBarVisible);
  const nagAnnotations = useSelector(selectNagAnnotations);

  const onUpdateEvaluation = useMutation(updateEvaluation);
  const onAddEvalMoves = useMutation(addEvalMoves);
  const onMoveFromChessboard = useMutation(moveFromChessboard);
  const onMoveFromStats = useMutation(moveFromEvalMove);
  const onSelectMove = useMutation(selectMove);
  const onDrawArrow = useMutation(drawArrow);
  const onHighlightSquare = useMutation(highlightSquare);
  const onUpdateNumberOfLines = useMutation(updateNumberOfLines, { context: true });

  useGlobalShortcuts();

  let appliedRequestedPositionKey: string | null = null;
  createEffect(
    () => {
      const loadedPgn = pgn();
      const requestedPositionKey = props.requestedPositionKey;
      const resolvedMoveId =
        loadedPgn === null || requestedPositionKey === null
          ? null
          : findMoveIdByPositionKey(loadedPgn, requestedPositionKey);
      return {
        pgnLoaded: loadedPgn !== null,
        requestKey:
          requestedPositionKey === null
            ? null
            : `${props.repertoireHandle}/${props.chapterHandle}/${requestedPositionKey}`,
        resolvedMoveId,
      };
    },
    ({ pgnLoaded, requestKey, resolvedMoveId }) => {
      if (requestKey === null) {
        appliedRequestedPositionKey = null;
        return;
      }
      if (!pgnLoaded || appliedRequestedPositionKey === requestKey) return;

      appliedRequestedPositionKey = requestKey;
      if (resolvedMoveId !== null) {
        untrack(() => onSelectMove(resolvedMoveId));
      }
    },
  );

  const engine = new Engine();
  engine.onEvaluation(onUpdateEvaluation);

  onCleanup(() => {
    engine.terminate();
  });

  // Evaluate when fen/engine changes
  createEffect(
    () => ({
      fen: currentFen(),
      depth: engineDepth(),
      enabled: isEngineEnabled(),
    }),
    ({ fen, depth, enabled }) => {
      if (enabled) {
        engine.evaluate(fen, depth);
      }
    },
  );

  const nextMoveIds = useSelector(selectNextMoveIds);

  const arrows = useSelector((state) =>
    getArrows(
      state.highlights.arrows,
      state.evaluations,
      state.engineSettings.isEnabled,
      state.engineSettings.showBestMoveArrow,
    ),
  );

  const squareHighlights = useSquareHighlights();

  return (
    <WorkspaceLayout
      title={<RepertoireHeader />}
      chessboard={
        <Chessboard
          boardOrientation={orientation()}
          position={currentFen()}
          onPieceDrop={onMoveFromChessboard}
          arrows={arrows()}
          squareHighlights={squareHighlights()}
          onDrawArrow={onDrawArrow}
          onHighlightSquare={onHighlightSquare}
          canDrag={true}
          pieceToAnimate={animation()}
          annotations={nagAnnotations()}
        />
      }
      evalBar={
        isEvalBarVisible() ? (
          <EvalBar orientation={orientation()} evaluation={evaluations()[0]} />
        ) : null
      }
      panelChildren={
        <>
          <ComputerEvaluation
            evaluations={evaluations()}
            onAddEvalMoves={onAddEvalMoves}
            onNumberOfLinesChange={(numberOfLines) => {
              engine.setNumberOfLines(numberOfLines);
              onUpdateNumberOfLines(numberOfLines);
              if (isEngineEnabled()) {
                engine.evaluate(currentFen(), engineDepth());
              }
            }}
          />
          <MovesTree readOnly={false} />
          <Show when={nextMoveIds().length > 1}>
            <VariationSelector />
          </Show>
          <PositionMoveStats
            fen={currentFen()}
            color={orientation()}
            onMove={(move) => {
              const evalMove = positionStatMove(move.uci, move.san);
              if (evalMove !== null) onMoveFromStats(evalMove);
            }}
          />
          <PgnExplorerToolbar />
        </>
      }
    />
  );
}
