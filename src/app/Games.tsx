import { createEffect, createSignal, For, Show } from "solid-js";
import { LichessImport } from "@/components/LichessImport";
import { gamesVersion } from "@/lib/gameUpdates";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { Button } from "@/components/ui/button";
import { importGames, loadGames, type StoredGame, type GameColor } from "@/lib/games";
import { importedGamePath } from "@/lib/routes";
export default function Games() {
  const [games, setGames] = createSignal<StoredGame[]>([]);
  const [player, setPlayer] = createSignal("");
  const [color, setColor] = createSignal<GameColor>("white");
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  let requestId = 0;
  async function reload() {
    const current = ++requestId;
    const result = await loadGames();
    if (current !== requestId) return;
    if (result.ok) setGames(result.games);
    else setMessage("Unable to read games from this device.");
  }
  createEffect(gamesVersion, () => {
    void reload();
  });
  async function upload(file: File | undefined) {
    if (file === undefined) return;
    setBusy(true);
    try {
      const count = await importGames(await file.text(), player(), color());
      setMessage(`Imported ${count} games.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <FullWidthLayout title={<h1>Games</h1>} reserveRightSlot showMobileHeaderDivider={false}>
      <div class="space-y-4 p-4">
        <LichessImport />
        <p class="text-sm text-muted-foreground">
          Import a PGN file to review games saved on this device.
        </p>
        <div class="flex flex-wrap items-end gap-3">
          <label>
            Your player name (optional)
            <input
              class="block rounded border bg-background p-2"
              value={player()}
              onInput={(e) => setPlayer(e.currentTarget.value)}
            />
          </label>
          <label>
            Default color
            <select
              class="block rounded border bg-background p-2"
              value={color()}
              onChange={(e) => setColor(e.currentTarget.value === "black" ? "black" : "white")}
            >
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <label>
            Import games
            <input
              aria-label="Import games"
              type="file"
              accept=".pgn,text/plain,application/x-chess-pgn"
              disabled={busy()}
              onChange={(e) => {
                void upload(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <p role="status">{message()}</p>
        <Show when={games().length > 0} fallback={<p>No games on this device yet.</p>}>
          <div class="space-y-2">
            <For each={games()}>
              {(game) => (
                <div class="flex items-center justify-between rounded border p-3">
                  <div>
                    {game.whiteName} — {game.blackName}
                    <p class="text-sm text-muted-foreground">
                      {game.result} · {game.speed} · {new Date(game.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button href={importedGamePath(game.id)}>View game</Button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </FullWidthLayout>
  );
}
