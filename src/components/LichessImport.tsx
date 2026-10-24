import { createEffect, createSignal, Show } from "solid-js";
import { Button } from "./ui/button";
import {
  cancelLichessImport,
  lichessImportReady,
  lichessImportSettings,
  lichessImportStatus,
  setAutomaticLichessImport,
  syncLichessGames,
} from "@/lib/lichessImport";

export function LichessImport() {
  const [username, setUsername] = createSignal("");
  const busy = () => lichessImportStatus().phase === "running";
  createEffect(
    () => lichessImportSettings()?.username,
    (name) => {
      if (name !== undefined) setUsername(name);
    },
  );
  return (
    <section aria-label="Lichess import" class="space-y-3 rounded border p-4">
      <h2 class="font-medium">Import from Lichess</h2>
      <p class="text-sm text-muted-foreground">
        Import all completed standard chess games, at every time control. Games are saved on this
        device. After the first import, we check for new games whenever you reopen the site.
      </p>
      <form
        class="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void syncLichessGames(username());
        }}
      >
        <label>
          Lichess username
          <input
            class="block rounded border bg-background p-2"
            value={username()}
            required
            autocapitalize="none"
            spellcheck={false}
            disabled={busy() || !lichessImportReady()}
            onInput={(event) => setUsername(event.currentTarget.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={busy() || !lichessImportReady() || username().trim() === ""}
        >
          {lichessImportSettings()?.username === username().trim().toLowerCase()
            ? "Check for new games"
            : "Import all games"}
        </Button>
        <Show when={busy()}>
          <Button type="button" variant="outline" onClick={cancelLichessImport}>
            Stop import
          </Button>
        </Show>
      </form>
      <Show when={lichessImportSettings()}>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lichessImportSettings()?.automatic ?? false}
            onChange={(event) => {
              void setAutomaticLichessImport(event.currentTarget.checked);
            }}
          />
          Check for new games when this site opens
        </label>
      </Show>
      <p role="status" aria-live="polite" class="text-sm">
        {lichessImportStatus().message}
      </p>
    </section>
  );
}
