import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import {
  AppState,
  Arrows,
  HighlightKind,
  normalizePgn,
  selectAnimation,
  selectFen,
  selectOrientation,
} from "@/lib/AppState";
import { Button } from "@/components/ui/button";
import { HorizontalDashedDivider } from "@/components/ui/HorizontalDashedDivider";
import { Chessboard } from "@/components/Chessboard/Chessboard";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";
import { MovesTree, type MoveIndicator } from "@/components/MovesTree";
import { PgnExplorerToolbar } from "@/components/PgnExplorerToolbar";
import { useSquareHighlights } from "@/components/useSquareHighlights";
import { useStore } from "@/app/AppStateProvider";
import { StoreState } from "@/lib/createStore";
import { authStatus, currentAuthUser } from "@/lib/authSession";
import { loadLichessGame, type StoredLichessGame } from "@/lib/lichessGames";
import { APP_ROOT, repertoireMovePath } from "@/lib/routes";
import { useSelector } from "@/lib/useSelector";
import { useGlobalShortcuts } from "@/lib/useGlobalShortcuts";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; game: StoredLichessGame }
  | { status: "signed-out" }
  | { status: "not-found" }
  | { status: "error"; message: string };

type RepertoireCoverage = {
  description: string;
  href: string;
  moveLabel: string;
  ply: number;
};

function numberedSan(ply: number, san: string): string {
  const moveNumber = Math.ceil(ply / 2);
  return `${moveNumber}${ply % 2 === 1 ? "." : "..."} ${san}`;
}

function resetImportedGameState(state: StoreState<AppState>, game: StoredLichessGame): void {
  state.set("pgns", {
    ...state.pgns,
    [game.id]: { status: "success", data: normalizePgn(game.pgn) },
  });
  state.set("orientation", game.userColor);
  state.set("selectedMoveId", null);
  state.set("preselectedVariation", null);
  state.set("evaluations", []);
  state.set("animation", null);
  state.set("highlights", { squares: {}, arrows: {} });
}

function titleForGame(game: StoredLichessGame): string {
  return `${game.whiteName} vs ${game.blackName}`;
}

function errorMessage(reason: string): string {
  if (reason === "unauthorized") {
    return "Sign in to review this game.";
  }
  if (reason === "not-found") {
    return "This imported game was not found.";
  }
  return "This game is unavailable right now.";
}

function GameViewerTitle(props: { game: StoredLichessGame }) {
  return (
    <div class="min-w-0">
      <h1 class="truncate text-base font-medium">{titleForGame(props.game)}</h1>
      <div class="truncate text-xs text-muted-foreground">
        {props.game.result} · {props.game.speed} · {props.game.timeControl}
      </div>
    </div>
  );
}

function mainLineMoveIdAtPly(game: StoredLichessGame, ply: number): number | null {
  const pgn = normalizePgn(game.pgn);
  let moveId = pgn.rootMoveIds[0];
  for (let currentPly = 1; currentPly < ply && moveId !== undefined; currentPly++) {
    moveId = pgn.moves[moveId]?.next[0];
  }
  return moveId ?? null;
}

function GameViewerMessage(props: { title: string; action?: "signin" | "games" }) {
  function openAuthDialog(): void {
    document.dispatchEvent(new CustomEvent("en-passant:open-auth-dialog"));
  }

  return (
    <FullWidthLayout
      title={<h1 class="truncate text-base font-medium">Game</h1>}
      reserveRightSlot
      showMobileHeaderDivider={false}
    >
      <div class="p-4">
        <div class="max-w-md rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          <p>{props.title}</p>
          <Show when={props.action === "signin"}>
            <Button size="sm" class="mt-3" onClick={openAuthDialog}>
              Sign in
            </Button>
          </Show>
          <Show when={props.action === "games"}>
            <Button size="sm" class="mt-3" href={`${APP_ROOT}/games`}>
              Games
            </Button>
          </Show>
        </div>
      </div>
    </FullWidthLayout>
  );
}

export function GameViewer(props: { gameId: string }) {
  useGlobalShortcuts({ allowEditing: false });
  const store = useStore();
  const [state, setState] = createSignal<LoadState>({ status: "idle" });
  const currentFen = useSelector(selectFen);
  const orientation = useSelector(selectOrientation);
  const animation = useSelector(selectAnimation);
  const squareHighlights = useSquareHighlights();
  const emptyArrows = createMemo<Arrows>(() => ({}));
  let requestId = 0;

  createEffect(
    () => ({
      authStatus: authStatus(),
      gameId: props.gameId,
      userId: currentAuthUser()?.id ?? null,
    }),
    ({ authStatus: status, gameId, userId }) => {
      requestId += 1;
      const currentRequestId = requestId;

      if (status === "loading") {
        setState({ status: "idle" });
        return;
      }
      if (userId === null) {
        setState({ status: "signed-out" });
        return;
      }

      setState({ status: "loading" });
      loadLichessGame(gameId).then((result) => {
        if (currentRequestId !== requestId) {
          return;
        }

        if (result.ok) {
          resetImportedGameState(store.state, result.game);
          setState({ status: "success", game: result.game });
        } else if (result.reason === "not-found") {
          setState({ status: "not-found" });
        } else {
          setState({ status: "error", message: errorMessage(result.reason) });
        }
      });
    },
  );

  const game = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.game : null;
  });
  const repertoireCoverage = createMemo<RepertoireCoverage | null>(() => {
    const match = game()?.latestRepertoireMove;
    if (match === null || match === undefined) return null;

    return {
      description: `${match.repertoire.name} / ${match.chapter.name}`,
      href: repertoireMovePath(match.repertoire.handle, match.chapter.handle, match.positionKey),
      moveLabel: numberedSan(match.ply, match.san),
      ply: match.ply,
    };
  });
  const moveIndicators = createMemo<Record<number, MoveIndicator>>(() => {
    const currentGame = game();
    const coverage = repertoireCoverage();
    if (currentGame === null || coverage === null) return {};

    const gameMoveId = mainLineMoveIdAtPly(currentGame, coverage.ply);
    if (gameMoveId === null) return {};

    return {
      [gameMoveId]: {
        label: "Latest position found in one of your repertoires",
      },
    };
  });
  const currentErrorMessage = createMemo(() => {
    const current = state();
    return current.status === "error" ? current.message : "This game is unavailable.";
  });

  const noOpMove = (_sourceSquare: string, _targetSquare: string, _piece: string): void => {};
  const noOpArrow = (_from: string, _to: string, _type: HighlightKind): void => {};
  const noOpHighlight = (_square: string, _highlight: HighlightKind): void => {};

  return (
    <Show
      when={game()}
      fallback={
        <Show
          when={state().status === "signed-out"}
          fallback={
            <Show
              when={state().status === "not-found"}
              fallback={
                <Show
                  when={state().status === "error"}
                  fallback={<GameViewerMessage title="Loading game..." />}
                >
                  <GameViewerMessage title={currentErrorMessage()} />
                </Show>
              }
            >
              <GameViewerMessage title="This imported game was not found." action="games" />
            </Show>
          }
        >
          <GameViewerMessage title="Sign in to review this game." action="signin" />
        </Show>
      }
    >
      {(currentGame) => (
        <WorkspaceLayout
          title={<GameViewerTitle game={currentGame()} />}
          chessboard={
            <Chessboard
              boardOrientation={orientation()}
              position={currentFen()}
              onPieceDrop={noOpMove}
              arrows={emptyArrows()}
              squareHighlights={squareHighlights()}
              onDrawArrow={noOpArrow}
              onHighlightSquare={noOpHighlight}
              canDrag={false}
              pieceToAnimate={animation()}
              annotations={{}}
            />
          }
          evalBar={null}
          panelChildren={
            <>
              <Show when={repertoireCoverage()}>
                {(coverage) => (
                  <>
                    <div
                      data-repertoire-coverage
                      class="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <span class="min-w-0 truncate">
                        Last repertoire move{" "}
                        <span class="font-semibold">{coverage().moveLabel}</span>
                      </span>
                      <A
                        href={coverage().href}
                        class="flex-none font-semibold text-blue-500 hover:underline"
                      >
                        {coverage().description}
                      </A>
                    </div>
                    <HorizontalDashedDivider animation="none" />
                  </>
                )}
              </Show>
              <MovesTree readOnly moveIndicators={moveIndicators()} />
              <PgnExplorerToolbar />
            </>
          }
        />
      )}
    </Show>
  );
}

export default function GameViewerRoute() {
  const params = useParams<{ gameId: string }>();
  return <GameViewer gameId={params.gameId} />;
}
