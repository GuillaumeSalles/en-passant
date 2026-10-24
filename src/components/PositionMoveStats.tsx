import { createEffect, createSignal, For, Show } from "solid-js";
import { createChessPosition, positionKey } from "@/lib/chess";
import {
  loadPositionMoves,
  type GameColor,
  type PositionMoveStat,
  type PositionMoves,
} from "@/lib/games";
import { importedGamePath } from "@/lib/routes";
import { gamesVersion } from "@/lib/gameUpdates";
export function PositionMoveStats(props: {
  fen: string;
  color: GameColor;
  onMove: (move: PositionMoveStat) => void;
}) {
  const [data, setData] = createSignal<PositionMoves | null>(null);
  const [error, setError] = createSignal(false);
  let request = 0;
  createEffect(
    () => ({
      key: positionKey(createChessPosition(props.fen)),
      color: props.color,
      gamesVersion: gamesVersion(),
    }),
    ({ key, color }) => {
      const current = ++request;
      setData(null);
      setError(false);
      void loadPositionMoves(key, color).then((result) => {
        if (current !== request) return;
        if (result.ok) setData(result.data);
        else setError(true);
      });
    },
  );
  return (
    <section class="overflow-auto p-3 text-sm" aria-label="Position statistics">
      <h3 class="mb-2 font-medium">Games on this device</h3>
      <Show when={error()}>
        <p>Unable to read local games.</p>
      </Show>
      <Show when={data()}>
        {(position) => (
          <>
            <p class="mb-2 text-muted-foreground">{position().games} games in this position</p>
            <For each={position().moves}>
              {(move) => (
                <button
                  class="flex w-full justify-between rounded p-2 hover:bg-muted"
                  onClick={() => props.onMove(move)}
                >
                  <span>{move.san}</span>
                  <span>
                    {move.games} · White {Math.round(move.whiteWinRate * 100)}% · Draw{" "}
                    {Math.round(move.drawRate * 100)}% · Black {Math.round(move.blackWinRate * 100)}
                    %
                  </span>
                </button>
              )}
            </For>
            <For each={position().recentGames}>
              {(game) => (
                <a class="block p-2 underline" href={importedGamePath(game.id)}>
                  {game.white.name} — {game.black.name} · {game.result}
                </a>
              )}
            </For>
          </>
        )}
      </Show>
    </section>
  );
}
