import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createChessPosition, positionKey } from "@/lib/chess";
import {
  loadPositionMoves,
  type GameColor,
  type PositionMoveStat,
  type PositionMoves,
  type RecentPositionGame,
} from "@/lib/games";
import { loadMastersPosition, type MasterGame, type MastersPosition } from "@/lib/openingExplorer";
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
  | { status: "success"; data: PositionExplorerData }
  | { status: "signed-out" }
  | { status: "error"; message: string };

type ExplorerSource = "masters" | "personal";
type PositionExplorerData =
  | { source: "masters"; data: MastersPosition }
  | { source: "personal"; data: PositionMoves };
type MoveData = Pick<PositionMoves, "games" | "moves">;

function percentage(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function visiblePercentage(rate: number): string {
  return rate >= 0.15 ? percentage(rate) : "";
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

function totalResults(positionMoves: MoveData) {
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
        {visiblePercentage(props.whiteWinRate)}
      </div>
      <div
        aria-hidden="true"
        class="flex items-center justify-center overflow-hidden whitespace-nowrap bg-neutral-600 text-[0.6rem] font-semibold tabular-nums text-white"
        style={{ width: percentage(props.drawRate) }}
        title={`Draw: ${props.draws} (${percentage(props.drawRate)})`}
      >
        {visiblePercentage(props.drawRate)}
      </div>
      <div
        aria-hidden="true"
        class={`flex items-center justify-center overflow-hidden whitespace-nowrap text-[0.6rem] font-semibold tabular-nums text-neutral-100 ${EVAL_BAR_DARK_CLASS}`}
        style={{ width: percentage(props.blackWinRate) }}
        title={`Black wins: ${props.blackWins} (${percentage(props.blackWinRate)})`}
      >
        {visiblePercentage(props.blackWinRate)}
      </div>
    </div>
  );
}

function TotalResultsRow(props: { positionMoves: MoveData }) {
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

function masterPlayerName(player: MasterGame["white"]): string {
  return `${player.name} (${player.rating})`;
}

function TopMasterGames(props: { games: MasterGame[] }) {
  return (
    <Show when={props.games.length > 0}>
      <div class="mt-1 border-t border-border pt-1" aria-label="Top master games">
        <div class="px-2 py-1 text-[0.7rem] font-medium text-muted-foreground">Top rated games</div>
        <For each={props.games}>
          {(game) => (
            <div
              class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm px-2 py-1.5 text-xs"
              aria-label={`${masterPlayerName(game.white)} versus ${masterPlayerName(game.black)}, ${game.result}`}
              data-master-game={game.id}
            >
              <span class="truncate font-medium">
                {masterPlayerName(game.white)} – {masterPlayerName(game.black)}
              </span>
              <span class="whitespace-nowrap font-mono">{game.result}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

function RecentGames(props: { games: RecentPositionGame[] }) {
  return (
    <Show when={props.games.length > 0}>
      <div class="mt-1 border-t border-border pt-1" aria-label="Recent games">
        <For each={props.games}>
          {(game) => (
            <a
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
            </a>
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
  const [source, setSource] = createSignal<ExplorerSource>("personal");
  const [since, setSince] = createSignal<number | null>(null);
  const [until, setUntil] = createSignal<number | null>(null);
  const [state, setState] = createSignal<LoadState>({ status: "loading" });
  const [panelHeight, setPanelHeight] = createSignal<number | null>(null);
  const data = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.data : null;
  });
  const moveData = createMemo(() => data()?.data ?? null);
  const personalData = createMemo(() => {
    const current = data();
    return current?.source === "personal" ? current.data : null;
  });
  const mastersData = createMemo(() => {
    const current = data();
    return current?.source === "masters" ? current.data : null;
  });
  const errorMessage = createMemo(() => {
    const current = state();
    return current.status === "error" ? current.message : null;
  });
  const availableYears = Array.from(
    { length: new Date().getUTCFullYear() - 1952 + 1 },
    (_, index) => new Date().getUTCFullYear() - index,
  );
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
      since: since(),
      source: source(),
      until: until(),
      userId: currentAuthUser()?.id ?? null,
    }),
    ({ authStatus: status, color, currentPositionKey, since, source, until, userId }) => {
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
      if (source === "personal") {
        loadPositionMoves(currentPositionKey, color).then((result) => {
          if (currentRequestId !== requestId) return;
          if (result.ok) {
            setState({
              status: "success",
              data: { source: "personal", data: result.data },
            });
          } else if (result.reason === "unauthorized") {
            setState({ status: "signed-out" });
          } else {
            setState({
              status: "error",
              message: "Move statistics are unavailable.",
            });
          }
        });
        return;
      }

      loadMastersPosition(currentPositionKey, {
        ...(since === null ? {} : { since }),
        ...(until === null ? {} : { until }),
      }).then((result) => {
        if (currentRequestId !== requestId) return;
        if (result.ok) {
          setState({
            status: "success",
            data: { source: "masters", data: result.data },
          });
        } else if (result.reason === "unauthorized") {
          setState({ status: "signed-out" });
        } else if (result.reason === "rate-limited") {
          setState({
            status: "error",
            message: "Lichess is receiving too many requests. Try again shortly.",
          });
        } else if (result.reason === "configuration") {
          setState({
            status: "error",
            message: "The Masters database is not configured yet.",
          });
        } else {
          setState({
            status: "error",
            message: "The Masters database is unavailable.",
          });
        }
      });
    },
  );

  return (
    <Show when={authStatus() !== "signed-out" && state().status !== "signed-out"}>
      <section
        ref={sectionRef}
        aria-label={source() === "masters" ? "Masters" : "Your games"}
        class={`${styles["PositionMoveStats"]} flex flex-col overflow-hidden`}
        data-resized={panelHeight() === null ? undefined : "true"}
        style={sectionStyle()}
      >
        <HorizontalDashedDivider class="xl:hidden" direction="right-to-left" />
        <HorizontalResizeHandle
          label={
            source() === "masters"
              ? "Resize moves and Masters panels"
              : "Resize moves and your games panels"
          }
          onResize={resizePanel}
        />
        <div class="min-h-0 overflow-y-auto">
          <div class="px-4 py-3">
            <h2 id="position-move-stats-title" class="text-sm font-medium">
              {source() === "masters" ? "Masters" : "Your games"}
            </h2>
            <div class="mt-2 flex gap-1" role="tablist" aria-label="Game source">
              <button
                type="button"
                role="tab"
                aria-selected={source() === "masters" ? "true" : "false"}
                class={`rounded-sm px-2 py-1 text-xs transition-colors ${source() === "masters" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setSource("masters")}
              >
                Masters
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source() === "personal" ? "true" : "false"}
                class={`rounded-sm px-2 py-1 text-xs transition-colors ${source() === "personal" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setSource("personal")}
              >
                Your games
              </button>
            </div>
            <Show when={source() === "masters"}>
              <div class="mt-2 flex items-center gap-2 text-xs">
                <label class="flex items-center gap-1 text-muted-foreground">
                  From
                  <select
                    aria-label="Masters from year"
                    class="rounded-sm border border-border bg-background px-1.5 py-1 text-foreground"
                    value={since() ?? ""}
                    onChange={(event) => {
                      const next =
                        event.currentTarget.value === "" ? null : Number(event.currentTarget.value);
                      setSince(next);
                      const currentUntil = until();
                      if (next !== null && currentUntil !== null && next > currentUntil) {
                        setUntil(next);
                      }
                    }}
                  >
                    <option value="">Any</option>
                    <For each={availableYears}>
                      {(year) => <option value={year}>{year}</option>}
                    </For>
                  </select>
                </label>
                <label class="flex items-center gap-1 text-muted-foreground">
                  To
                  <select
                    aria-label="Masters through year"
                    class="rounded-sm border border-border bg-background px-1.5 py-1 text-foreground"
                    value={until() ?? ""}
                    onChange={(event) => {
                      const next =
                        event.currentTarget.value === "" ? null : Number(event.currentTarget.value);
                      setUntil(next);
                      const currentSince = since();
                      if (next !== null && currentSince !== null && next < currentSince) {
                        setSince(next);
                      }
                    }}
                  >
                    <option value="">Any</option>
                    <For each={availableYears}>
                      {(year) => <option value={year}>{year}</option>}
                    </For>
                  </select>
                </label>
              </div>
            </Show>
          </div>
          <Show when={state().status === "loading"}>
            <p class="px-4 pb-3 text-xs text-muted-foreground">Loading moves...</p>
          </Show>
          <Show when={errorMessage()}>
            {(message) => <p class="px-4 pb-3 text-xs text-destructive">{message()}</p>}
          </Show>
          <Show when={moveData()}>
            {(positionMoves) => (
              <>
                <Show
                  when={positionMoves().moves.length > 0}
                  fallback={
                    <p class="px-4 pb-3 text-xs text-muted-foreground">
                      {source() === "masters"
                        ? "No master moves were played from this position."
                        : "You have no imported games in this position."}
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
                    <Show when={personalData()}>
                      {(personal) => <RecentGames games={personal().recentGames} />}
                    </Show>
                  </div>
                </Show>
                <Show when={mastersData()}>
                  {(masters) => <TopMasterGames games={masters().topGames} />}
                </Show>
              </>
            )}
          </Show>
        </div>
      </section>
    </Show>
  );
}
