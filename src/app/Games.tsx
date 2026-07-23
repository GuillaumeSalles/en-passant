import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { A } from "@solidjs/router";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { TimeControl } from "@/components/TimeControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { authStatus, currentAuthUser } from "@/lib/authSession";
import {
  loadGames,
  loadLichessImport,
  startLichessImport,
  type GameColor,
  type GameImportState,
  type GameSort,
  type StoredGame,
} from "@/lib/games";
import { importedGamePath } from "@/lib/routes";
import { Repeat2, Upload } from "@/components/Icons";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; games: StoredGame[]; total: number }
  | { status: "signed-out" }
  | { status: "error"; message: string };

type ImportLoadState =
  | { status: "idle"; import: null }
  | { status: "loading"; import: GameImportState | null }
  | { status: "ready"; import: GameImportState | null }
  | { status: "error"; import: GameImportState | null; message: string };

type ColorFilter = "all" | GameColor;

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRating(value: number | null): string {
  return value === null ? "-" : String(value);
}

function formatSpeed(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function errorMessage(reason: string): string {
  if (reason === "unauthorized") {
    return "Sign in to import games.";
  }
  return "Lichess games are unavailable right now.";
}

function importErrorMessage(error: GameImportState["error"]): string {
  if (error === "lichess-user-not-found") return "That Lichess handle was not found.";
  if (error === "invalid-lichess-response")
    return "Lichess returned game data that could not be imported.";
  if (error === "queue-delivery-failed")
    return "The import could not be scheduled. Please try again.";
  return "Lichess is unavailable right now. Please try again later.";
}

function openAuthDialog(): void {
  document.dispatchEvent(new CustomEvent("en-passant:open-auth-dialog"));
}

function Select(props: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  children: JSX.Element;
}) {
  return (
    <label class="grid gap-1 text-xs text-muted-foreground">
      <span>{props.label}</span>
      <select
        class="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      >
        {props.children}
      </select>
    </label>
  );
}

function GamesTable(props: { games: StoredGame[] }) {
  return (
    <div class="min-h-0 overflow-auto">
      <table class="w-full min-w-[720px] border-collapse text-sm">
        <thead class="sticky top-0 bg-background text-xs text-muted-foreground">
          <tr class="border-b border-border">
            <th class="px-3 py-2 text-left font-medium">Date</th>
            <th class="px-3 py-2 text-left font-medium">Color</th>
            <th class="px-3 py-2 text-left font-medium">Opponent</th>
            <th class="px-3 py-2 text-left font-medium">Result</th>
            <th class="px-3 py-2 text-left font-medium">Time</th>
            <th class="px-3 py-2 text-left font-medium">Opening</th>
            <th class="px-3 py-2 text-right font-medium">Game</th>
          </tr>
        </thead>
        <tbody>
          <For
            each={props.games}
            fallback={
              <tr>
                <td class="px-3 py-8 text-center text-muted-foreground" colspan={7}>
                  No games found.
                </td>
              </tr>
            }
          >
            {(game) => (
              <tr class="border-b border-border/70 last:border-b-0 hover:bg-muted/20">
                <td class="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {formatDate(game.createdAt)}
                </td>
                <td class="px-3 py-2 capitalize">{game.userColor}</td>
                <td class="px-3 py-2">
                  <div class="font-medium">{game.opponentName}</div>
                  <div class="text-xs text-muted-foreground">
                    {formatRating(game.opponentRating)}
                  </div>
                </td>
                <td class="px-3 py-2">
                  <span class="rounded-sm border border-border bg-muted/20 px-2 py-0.5 font-mono text-xs">
                    {game.result}
                  </span>
                </td>
                <td class="px-3 py-2">
                  <div>{formatSpeed(game.speed)}</div>
                  <TimeControl
                    value={game.timeControl}
                    class="block text-xs text-muted-foreground"
                  />
                </td>
                <td class="max-w-72 px-3 py-2">
                  <Show when={game.opening} fallback={<span class="text-muted-foreground">-</span>}>
                    {(opening) => (
                      <div class="truncate" title={`${opening().eco} ${opening().name}`}>
                        <span class="text-muted-foreground">{opening().eco}</span> {opening().name}
                      </div>
                    )}
                  </Show>
                </td>
                <td class="px-3 py-2 text-right">
                  <A
                    class="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    href={importedGamePath(game.id)}
                  >
                    Open
                  </A>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

export function Games() {
  const [state, setState] = createSignal<LoadState>({ status: "idle" });
  const [importState, setImportState] = createSignal<ImportLoadState>({
    status: "idle",
    import: null,
  });
  const [handle, setHandle] = createSignal("");
  const [timeControl, setTimeControl] = createSignal("all");
  const [color, setColor] = createSignal<ColorFilter>("all");
  const [sort, setSort] = createSignal<GameSort>("desc");
  const [refreshVersion, setRefreshVersion] = createSignal(0);
  let requestId = 0;
  let importRequestId = 0;

  createEffect(
    () => ({
      authStatus: authStatus(),
      refreshVersion: refreshVersion(),
      userId: currentAuthUser()?.id ?? null,
    }),
    ({ authStatus: status, userId }) => {
      requestId += 1;
      const currentRequestId = requestId;

      if (status === "loading") {
        setState({ status: "idle" });
        return;
      }
      if (userId === null) {
        setState({ status: "signed-out" });
        setImportState({ status: "idle", import: null });
        return;
      }

      setState({ status: "loading" });
      loadGames().then((result) => {
        if (currentRequestId !== requestId) {
          return;
        }

        if (result.ok) {
          setState({ status: "success", games: result.games, total: result.total });
        } else {
          setState({ status: "error", message: errorMessage(result.reason) });
        }
      });

      importRequestId += 1;
      const currentImportRequestId = importRequestId;
      setImportState({ status: "loading", import: untrack(importState).import });
      loadLichessImport().then((result) => {
        if (currentImportRequestId !== importRequestId) return;
        if (result.ok) {
          setImportState({ status: "ready", import: result.import });
          if (result.import !== null && untrack(handle).trim() === "") {
            setHandle(result.import.account);
          }
        } else {
          setImportState({
            status: "error",
            import: null,
            message: errorMessage(result.reason),
          });
        }
      });
    },
  );

  const allGames = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.games : [];
  });
  const totalGames = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.total : 0;
  });
  const currentErrorMessage = createMemo(() => {
    const current = state();
    return current.status === "error" ? current.message : null;
  });
  const timeControls = createMemo(() =>
    [...new Set(allGames().map((game) => game.speed))].sort((left, right) =>
      left.localeCompare(right),
    ),
  );
  const visibleGames = createMemo(() => {
    const selectedTimeControl = timeControl();
    const selectedColor = color();
    const direction = sort();
    return allGames()
      .filter((game) => selectedTimeControl === "all" || game.speed === selectedTimeControl)
      .filter((game) => selectedColor === "all" || game.userColor === selectedColor)
      .sort((left, right) =>
        direction === "desc" ? right.createdAt - left.createdAt : left.createdAt - right.createdAt,
      );
  });

  const currentImport = createMemo(() => importState().import);
  const currentImportLoadError = createMemo(() => {
    const current = importState();
    return current.status === "error" ? current.message : null;
  });
  const importIsActive = createMemo(() => {
    const gameImport = currentImport();
    return (
      importState().status === "loading" ||
      gameImport?.status === "queued" ||
      gameImport?.status === "running"
    );
  });
  const currentImportDisplayTotal = createMemo(() => {
    const gameImport = currentImport();
    if (gameImport === null || gameImport.totalGames === null) return null;
    return Math.max(gameImport.totalGames, gameImport.processedGames);
  });
  const currentImportProgress = createMemo(() => {
    const gameImport = currentImport();
    const totalGames = currentImportDisplayTotal();
    if (gameImport === null || totalGames === null || totalGames === 0) {
      return null;
    }
    return gameImport.processedGames / totalGames;
  });

  async function refreshGamesInBackground(): Promise<void> {
    requestId += 1;
    const currentRequestId = requestId;
    const result = await loadGames();
    if (currentRequestId !== requestId || !result.ok) return;
    setState({ status: "success", games: result.games, total: result.total });
  }

  createEffect(
    () => ({
      active: importIsActive(),
      importId: currentImport()?.id ?? null,
      userId: currentAuthUser()?.id ?? null,
    }),
    ({ active, importId, userId }) => {
      if (!active || importId === null || userId === null) return;

      let polling = false;
      const interval = window.setInterval(() => {
        if (polling) return;
        polling = true;
        const previous = untrack(currentImport);
        loadLichessImport()
          .then((result) => {
            if (!result.ok) return;
            setImportState({ status: "ready", import: result.import });
            if (
              result.import?.id === importId &&
              (result.import.processedGames !== previous?.processedGames ||
                (result.import.status === "completed" && previous?.status !== "completed"))
            ) {
              void refreshGamesInBackground();
            }
          })
          .finally(() => {
            polling = false;
          });
      }, 2500);
      return () => window.clearInterval(interval);
    },
  );

  async function importGames(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmedHandle = handle().trim();
    if (trimmedHandle === "") {
      return;
    }

    importRequestId += 1;
    const currentImportRequestId = importRequestId;
    setImportState({ status: "loading", import: currentImport() });
    const result = await startLichessImport(trimmedHandle);
    if (currentImportRequestId !== importRequestId) return;

    if (result.ok) {
      setImportState({ status: "ready", import: result.import });
    } else {
      setImportState({
        status: "error",
        import: currentImport(),
        message: errorMessage(result.reason),
      });
    }
  }

  return (
    <FullWidthLayout
      title={<h1 class="motion-page-title truncate text-base font-medium">Games</h1>}
      mainClass="flex flex-col overflow-hidden"
      reserveRightSlot
      showMobileHeaderDivider
    >
      <div class="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <form class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={importGames}>
          <label class="grid min-w-0 gap-1 text-xs text-muted-foreground sm:w-72">
            <span>Lichess handle</span>
            <Input
              value={handle()}
              placeholder="DrNykterstein"
              autocomplete="off"
              onInput={(event) => setHandle(event.currentTarget.value)}
            />
          </label>
          <Button type="submit" disabled={importIsActive() || handle().trim() === ""}>
            <Upload />
            {currentImport()?.status === "failed" ? "Retry" : "Import"}
          </Button>
        </form>
        <div class="grid grid-cols-3 gap-2 sm:flex sm:items-end">
          <Select
            label="Time control"
            value={timeControl()}
            onInput={(value) => setTimeControl(value)}
          >
            <option value="all">All</option>
            <For each={timeControls()}>
              {(control) => <option value={control}>{formatSpeed(control)}</option>}
            </For>
          </Select>
          <Select label="Color" value={color()} onInput={(value) => setColor(value as ColorFilter)}>
            <option value="all">All</option>
            <option value="white">White</option>
            <option value="black">Black</option>
          </Select>
          <Select
            label="Date"
            value={sort()}
            onInput={(value) => setSort(value === "asc" ? "asc" : "desc")}
          >
            <option value="desc">Newest</option>
            <option value="asc">Oldest</option>
          </Select>
        </div>
      </div>

      <Show when={state().status === "idle"}>
        <div class="p-4 text-sm text-muted-foreground">Checking session...</div>
      </Show>
      <Show when={state().status === "loading"}>
        <div class="space-y-2 p-4" aria-label="Loading games">
          <div class="h-9 animate-pulse rounded-sm bg-muted/50" />
          <div class="h-9 animate-pulse rounded-sm bg-muted/40" />
          <div class="h-9 animate-pulse rounded-sm bg-muted/30" />
        </div>
      </Show>
      <Show when={state().status === "signed-out"}>
        <div class="p-4">
          <div class="max-w-md rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <p>Sign in to import and view games.</p>
            <Button size="sm" class="mt-3" onClick={openAuthDialog}>
              Sign in
            </Button>
          </div>
        </div>
      </Show>
      <Show when={state().status === "error"}>
        <div class="p-4">
          <div class="max-w-md rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <p>{currentErrorMessage()}</p>
            <Button
              size="sm"
              variant="outline"
              class="mt-3"
              onClick={() => setRefreshVersion((version) => version + 1)}
            >
              <Repeat2 />
              Retry
            </Button>
          </div>
        </div>
      </Show>
      <Show when={state().status === "success"}>
        <div class="flex min-h-0 flex-1 flex-col">
          <Show when={currentImport()}>
            {(gameImport) => (
              <div
                class="mx-4 mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                aria-live="polite"
              >
                <Show when={gameImport().status === "queued"}>
                  <p>Waiting to import {gameImport().account}…</p>
                </Show>
                <Show when={gameImport().status === "running"}>
                  <>
                    <p>
                      Importing {gameImport().account} — {gameImport().processedGames}
                      <Show when={currentImportDisplayTotal()}>
                        {(totalGames) => <> of {totalGames()}</>}
                      </Show>{" "}
                      finished games processed. You can leave this page.
                    </p>
                    <Show when={currentImportProgress()}>
                      {(progress) => (
                        <div
                          class="mt-2 rounded-full bg-muted"
                          role="progressbar"
                          aria-label={`Importing ${gameImport().account}`}
                          aria-valuemin="0"
                          aria-valuemax={currentImportDisplayTotal() ?? undefined}
                          aria-valuenow={gameImport().processedGames}
                        >
                          <ProgressBar progress={progress()} />
                        </div>
                      )}
                    </Show>
                  </>
                </Show>
                <Show when={gameImport().status === "completed"}>
                  <p>Import complete — {gameImport().processedGames} finished games processed.</p>
                </Show>
                <Show when={gameImport().status === "failed"}>
                  <p class="text-destructive">{importErrorMessage(gameImport().error)}</p>
                </Show>
              </div>
            )}
          </Show>
          <Show when={currentImportLoadError()}>
            <div class="mx-4 mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-destructive">
              {currentImportLoadError()}
            </div>
          </Show>
          <div class="flex flex-none items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>
              Showing {visibleGames().length} of {totalGames()} games
            </span>
          </div>
          <GamesTable games={visibleGames()} />
        </div>
      </Show>
    </FullWidthLayout>
  );
}

export default Games;
