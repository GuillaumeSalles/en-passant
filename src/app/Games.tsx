import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import { A } from "@solidjs/router";
import { FullWidthLayout } from "@/components/FullWidthLayout";
import { TimeControl } from "@/components/TimeControl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authStatus, currentAuthUser } from "@/lib/authSession";
import {
  importRecentLichessGames,
  loadGames,
  type GameColor,
  type GameSort,
  type StoredGame,
} from "@/lib/games";
import { importedGamePath } from "@/lib/routes";
import { Repeat2, Upload } from "@/components/Icons";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; games: StoredGame[]; imported?: number }
  | { status: "signed-out" }
  | { status: "error"; message: string };

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
  if (reason === "not-found") {
    return "That Lichess handle was not found.";
  }
  if (reason === "lichess-auth-required") {
    return "The Lichess token is not configured.";
  }
  return "Lichess games are unavailable right now.";
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
  const [handle, setHandle] = createSignal("");
  const [timeControl, setTimeControl] = createSignal("all");
  const [color, setColor] = createSignal<ColorFilter>("all");
  const [sort, setSort] = createSignal<GameSort>("desc");
  const [refreshVersion, setRefreshVersion] = createSignal(0);
  let requestId = 0;

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
        return;
      }

      setState({ status: "loading" });
      loadGames().then((result) => {
        if (currentRequestId !== requestId) {
          return;
        }

        if (result.ok) {
          setState({ status: "success", games: result.games });
        } else {
          setState({ status: "error", message: errorMessage(result.reason) });
        }
      });
    },
  );

  const allGames = createMemo(() => {
    const current = state();
    return current.status === "success" ? current.games : [];
  });
  const importCount = createMemo(() => {
    const current = state();
    return current.status === "success" ? (current.imported ?? null) : null;
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

  async function importGames(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmedHandle = handle().trim();
    if (trimmedHandle === "") {
      return;
    }

    requestId += 1;
    const currentRequestId = requestId;
    setState({ status: "loading" });
    const result = await importRecentLichessGames(trimmedHandle);
    if (currentRequestId !== requestId) {
      return;
    }

    if (result.ok) {
      if (result.imported === undefined) {
        setState({ status: "success", games: result.games });
      } else {
        setState({ status: "success", games: result.games, imported: result.imported });
      }
    } else {
      setState({ status: "error", message: errorMessage(result.reason) });
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
          <Button type="submit" disabled={state().status === "loading" || handle().trim() === ""}>
            <Upload />
            Import
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
          <div class="flex flex-none items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>
              {visibleGames().length} of {allGames().length} games
            </span>
            <Show when={importCount() !== null}>
              <span>{importCount()} imported</span>
            </Show>
          </div>
          <GamesTable games={visibleGames()} />
        </div>
      </Show>
    </FullWidthLayout>
  );
}

export default Games;
