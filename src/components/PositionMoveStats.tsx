import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { createChessPosition, positionKey } from "@/lib/chess";
import {
  loadPositionMoves,
  type GameColor,
  type PositionMoveStat,
  type PositionMoves,
  type RecentPositionGame,
} from "@/lib/games";
import { authStatus, currentAuthUser } from "@/lib/authSession";
import { importedGamePath } from "@/lib/routes";
import { EVAL_BAR_DARK_CLASS, EVAL_BAR_LIGHT_CLASS } from "./EvalBar";
import { formatTimeControl, TimeControl } from "./TimeControl";
import { HorizontalDashedDivider } from "./ui/HorizontalDashedDivider";
import { HorizontalResizeHandle } from "./ui/HorizontalResizeHandle";
import styles from "./PositionMoveStats.module.css";

const MIN_GAMES_PANEL_HEIGHT = 144;
const MIN_MOVES_PANEL_HEIGHT = 96;

type LoadState =
  | { status: "loading" }
  | { status: "success"; data: PositionMoves }
  | { status: "signed-out" }
  | { status: "error" };

function percentage(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function moveFrequency(games: number, totalGames: number): string {
  return percentage(totalGames === 0 ? 0 : games / totalGames);
}

function resultLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function playerName(player: RecentPositionGame["white"]): string {
  return player.rating === null ? player.name : `${player.name} (${player.rating})`;
}

function totalResults(positionMoves: PositionMoves) {
  const totals = positionMoves.moves.reduce(
    (result, move) => ({
      whiteWins: result.whiteWins + move.whiteWins,
      draws: result.draws + move.draws,
      blackWins: result.blackWins + move.blackWins,
    }),
    { whiteWins: 0, draws: 0, blackWins: 0 },
  );
  return {
    ...totals,
    whiteWinRate: positionMoves.games === 0 ? 0 : totals.whiteWins / positionMoves.games,
    drawRate: positionMoves.games === 0 ? 0 : totals.draws / positionMoves.games,
    blackWinRate: positionMoves.games === 0 ? 0 : totals.blackWins / positionMoves.games,
  };
}

function ResultBar(props: {
  san: string;
  whiteWins: number;
  draws: number;
  blackWins: number;
  whiteWinRate: number;
  drawRate: number;
  blackWinRate: number;
}) {
  const label = () =>
    `${props.san} results: ${resultLabel(props.whiteWins, "white win")} (${percentage(props.whiteWinRate)}), ` +
    `${resultLabel(props.draws, "draw")} (${percentage(props.drawRate)}), ` +
    `${resultLabel(props.blackWins, "black win")} (${percentage(props.blackWinRate)})`;

  return (
    <div
      role="img"
      aria-label={label()}
      class="flex h-5 w-full min-w-28 overflow-hidden rounded-sm border border-neutral-400/50"
    >
      <div
        aria-hidden="true"
        class={`flex items-center justify-center overflow-hidden whitespace-nowrap text-[0.6rem] font-semibold tabular-nums text-neutral-950 ${EVAL_BAR_LIGHT_CLASS}`}
        style={{ width: percentage(props.whiteWinRate) }}
        title={`White wins: ${props.whiteWins} (${percentage(props.whiteWinRate)})`}
      >
        {percentage(props.whiteWinRate)}
      </div>
      <div
        aria-hidden="true"
        class="flex items-center justify-center overflow-hidden whitespace-nowrap bg-neutral-400 text-[0.6rem] font-semibold tabular-nums text-neutral-950 dark:bg-neutral-500"
        style={{ width: percentage(props.drawRate) }}
        title={`Draw: ${props.draws} (${percentage(props.drawRate)})`}
      >
        {percentage(props.drawRate)}
      </div>
      <div
        aria-hidden="true"
        class={`flex items-center justify-center overflow-hidden whitespace-nowrap text-[0.6rem] font-semibold tabular-nums text-neutral-100 ${EVAL_BAR_DARK_CLASS}`}
        style={{ width: percentage(props.blackWinRate) }}
        title={`Black wins: ${props.blackWins} (${percentage(props.blackWinRate)})`}
      >
        {percentage(props.blackWinRate)}
      </div>
    </div>
  );
}

function TotalResultsRow(props: { positionMoves: PositionMoves }) {
  const totals = () => totalResults(props.positionMoves);
  return (
    <tr class="border-t border-border font-medium">
      <td class="px-2 py-1.5">Total</td>
      <td class="px-2 py-1.5 text-right tabular-nums">{props.positionMoves.games}</td>
      <td class="w-full px-2 py-1.5">
        <ResultBar
          san="Total"
          whiteWins={totals().whiteWins}
          draws={totals().draws}
          blackWins={totals().blackWins}
          whiteWinRate={totals().whiteWinRate}
          drawRate={totals().drawRate}
          blackWinRate={totals().blackWinRate}
        />
      </td>
    </tr>
  );
}

function RecentGames(props: { games: RecentPositionGame[] }) {
  return (
    <Show when={props.games.length > 0}>
      <div class="mt-1 border-t border-border pt-1" aria-label="Recent games">
        <For each={props.games}>
          {(game) => (
            <A
              href={importedGamePath(game.id)}
              class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`${playerName(game.white)} versus ${playerName(game.black)}, ${formatTimeControl(game.timeControl)}, ${game.result}`}
              data-recent-position-game={game.id}
            >
              <span class="truncate font-medium">
                {playerName(game.white)} – {playerName(game.black)}
              </span>
              <TimeControl
                value={game.timeControl}
                class="whitespace-nowrap text-muted-foreground"
              />
              <span class="whitespace-nowrap font-mono">{game.result}</span>
            </A>
          )}
        </For>
      </div>
    </Show>
  );
}

export function PositionMoveStats(props: {
  fen: string;
  color: GameColor;
  onMove: (move: PositionMoveStat) => void;
}) {
  const [state, setState] = createSignal<LoadState>({ status: "loading" });
  const [panelHeight, setPanelHeight] = createSignal<number | null>(null);
  const data = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.data : null;
  });
  let requestId = 0;
  let sectionRef: HTMLElement | undefined;

  function resizePanel(delta: number) {
    if (sectionRef === undefined) return;

    const currentHeight = sectionRef.getBoundingClientRect().height;
    const movesTree = sectionRef.parentElement?.querySelector<HTMLElement>("[data-moves-tree]");
    const movesHeight = movesTree?.getBoundingClientRect().height ?? MIN_MOVES_PANEL_HEIGHT;
    const maximumHeight = currentHeight + Math.max(0, movesHeight - MIN_MOVES_PANEL_HEIGHT);
    const nextHeight = Math.min(
      maximumHeight,
      Math.max(MIN_GAMES_PANEL_HEIGHT, currentHeight + delta),
    );
    setPanelHeight(Math.round(nextHeight));
  }

  const sectionStyle = createMemo(() => {
    const height = panelHeight();
    return height === null ? {} : { "--position-move-stats-height": `${height}px` };
  });

  createEffect(
    () => ({
      authStatus: authStatus(),
      color: props.color,
      currentPositionKey: positionKey(createChessPosition(props.fen)),
      userId: currentAuthUser()?.id ?? null,
    }),
    ({ authStatus: status, color, currentPositionKey, userId }) => {
      requestId += 1;
      const currentRequestId = requestId;
      if (status === "loading") {
        setState({ status: "loading" });
        return;
      }
      if (userId === null) {
        setState({ status: "signed-out" });
        return;
      }
      setState({ status: "loading" });
      loadPositionMoves(currentPositionKey, color).then((result) => {
        if (currentRequestId !== requestId) return;
        if (result.ok) {
          setState({ status: "success", data: result.data });
        } else if (result.reason === "unauthorized") {
          setState({ status: "signed-out" });
        } else {
          setState({ status: "error" });
        }
      });
    },
  );

  return (
    <Show when={authStatus() !== "signed-out" && state().status !== "signed-out"}>
      <section
        ref={sectionRef}
        aria-labelledby="position-move-stats-title"
        class={`${styles["PositionMoveStats"]} flex flex-col overflow-hidden`}
        data-resized={panelHeight() === null ? undefined : "true"}
        style={sectionStyle()}
      >
        <HorizontalDashedDivider class="xl:hidden" direction="right-to-left" />
        <HorizontalResizeHandle onResize={resizePanel} />
        <div class="min-h-0 overflow-y-auto">
          <div class="px-4 py-3">
            <h2 id="position-move-stats-title" class="text-sm font-medium">
              Your games
            </h2>
          </div>
          <Show when={state().status === "loading"}>
            <p class="px-4 pb-3 text-xs text-muted-foreground">Loading moves...</p>
          </Show>
          <Show when={state().status === "error"}>
            <p class="px-4 pb-3 text-xs text-destructive">Move statistics are unavailable.</p>
          </Show>
          <Show when={data()}>
            {(positionMoves) => (
              <Show
                when={positionMoves().moves.length > 0}
                fallback={
                  <p class="px-4 pb-3 text-xs text-muted-foreground">
                    You have no imported games in this position.
                  </p>
                }
              >
                <div class="overflow-x-auto px-2 pb-2">
                  <table class="w-full border-collapse text-xs">
                    <thead class="text-muted-foreground">
                      <tr>
                        <th class="px-2 py-1 text-left font-medium">Move</th>
                        <th class="px-2 py-1 text-left font-medium">Games</th>
                        <th class="px-2 py-1 text-left font-medium">
                          <span class="sr-only">Results: white wins, draws, black wins</span>
                          <span aria-hidden="true" class="flex items-center justify-end gap-2">
                            <span class="flex items-center gap-1">
                              <span
                                class={`size-2 border border-neutral-400/50 ${EVAL_BAR_LIGHT_CLASS}`}
                              />
                              White
                            </span>
                            <span class="flex items-center gap-1">
                              <span class="size-2 bg-neutral-400 dark:bg-neutral-500" />
                              Draw
                            </span>
                            <span class="flex items-center gap-1">
                              <span class={`size-2 ${EVAL_BAR_DARK_CLASS}`} />
                              Black
                            </span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={positionMoves().moves}>
                        {(move) => (
                          <tr
                            class="cursor-pointer transition-colors focus-within:bg-muted/50 hover:bg-muted/50"
                            data-position-move={move.uci}
                            onClick={() => props.onMove(move)}
                          >
                            <td class="p-0 font-medium">
                              <button
                                type="button"
                                class="w-full px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                aria-label={`Play ${move.san}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  props.onMove(move);
                                }}
                              >
                                {move.san}
                              </button>
                            </td>
                            <td
                              class="px-2 py-1.5 tabular-nums"
                              aria-label={`${moveFrequency(move.games, positionMoves().games)} of games, ${move.games} games`}
                            >
                              <span class="flex items-baseline justify-end gap-2 whitespace-nowrap">
                                <span class="text-muted-foreground">
                                  {moveFrequency(move.games, positionMoves().games)}
                                </span>
                                <span>{move.games}</span>
                              </span>
                            </td>
                            <td class="w-full px-2 py-1.5">
                              <ResultBar
                                san={move.san}
                                whiteWins={move.whiteWins}
                                draws={move.draws}
                                blackWins={move.blackWins}
                                whiteWinRate={move.whiteWinRate}
                                drawRate={move.drawRate}
                                blackWinRate={move.blackWinRate}
                              />
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                    <Show when={positionMoves().moves.length > 1}>
                      <tfoot>
                        <TotalResultsRow positionMoves={positionMoves()} />
                      </tfoot>
                    </Show>
                  </table>
                  <RecentGames games={positionMoves().recentGames} />
                </div>
              </Show>
            )}
          </Show>
        </div>
      </section>
    </Show>
  );
}
