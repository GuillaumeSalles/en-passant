import { createSignal } from "solid-js";
import { record, records } from "@/storage";
import { localDatabase, updateDatabase } from "@/storage/localDatabase";
import type { StoredGame } from "./gameContracts";
import { lichessGameId, normalizeLichessUsername, streamLichessGames } from "./lichessGames";
import { notifyGamesChanged } from "./gameUpdates";

export type LichessImportSettings = {
  username: string;
  since: number | null;
  automatic: boolean;
};
export type LichessImportStatus = {
  phase: "idle" | "running" | "success" | "error";
  imported: number;
  message: string;
};
const SETTINGS_ID = "lichess";
const BATCH_SIZE = 50;
// Revisit the boundary for games that were not yet visible when the previous export started.
const OVERLAP_MS = 60_000;
const [lichessImportSettings, setLichessImportSettings] =
  createSignal<LichessImportSettings | null>(null);
const [lichessImportStatus, setLichessImportStatus] = createSignal<LichessImportStatus>({
  phase: "idle",
  imported: 0,
  message: "",
});
const [lichessImportReady, setLichessImportReady] = createSignal(false);
export { lichessImportSettings, lichessImportStatus, lichessImportReady };
let initialization: Promise<void> | undefined;
let running: Promise<void> | undefined;
let controller: AbortController | undefined;

async function readSettings(): Promise<LichessImportSettings | null> {
  return (
    records<LichessImportSettings>(
      await localDatabase().read([{ store: "game-imports", key: SETTINGS_ID }]),
      "game-imports",
    )[0] ?? null
  );
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to import from Lichess.";
  setLichessImportStatus((previous) => ({
    ...previous,
    phase: "error",
    message: `${message} Saved games are kept; retry here or reopen the site.`,
  }));
}

export function initializeLichessImport(): Promise<void> {
  initialization ??= (async () => {
    try {
      const settings = await readSettings();
      setLichessImportSettings(settings);
      setLichessImportReady(true);
      if (settings?.automatic) await syncLichessGames(settings.username);
    } catch (error) {
      failure(error);
    } finally {
      setLichessImportReady(true);
    }
  })();
  return initialization;
}

export async function setAutomaticLichessImport(automatic: boolean): Promise<void> {
  try {
    let saved: LichessImportSettings | null = null;
    await updateDatabase(
      (snapshot) => {
        const current = records<LichessImportSettings>(snapshot, "game-imports")[0];
        saved = current === undefined ? null : { ...current, automatic };
        return {
          expectedVersion: snapshot.version,
          put: saved === null ? [] : [record("game-imports", SETTINGS_ID, saved)],
          remove: [],
        };
      },
      [{ store: "game-imports", key: SETTINGS_ID }],
    );
    setLichessImportSettings(saved);
  } catch (error) {
    failure(error);
  }
}

export function cancelLichessImport(): void {
  controller?.abort();
}

async function runImport(username: string): Promise<void> {
  controller = new AbortController();
  const signal = controller.signal;
  const until = Date.now();
  let count = 0;
  setLichessImportStatus({
    phase: "running",
    imported: 0,
    message: `Importing games from ${username}…`,
  });
  try {
    let settings: LichessImportSettings = { username, since: null, automatic: true };
    await updateDatabase(
      (snapshot) => {
        const existing = records<LichessImportSettings>(snapshot, "game-imports")[0];
        settings =
          existing?.username === username ? existing : { username, since: null, automatic: true };
        return {
          expectedVersion: snapshot.version,
          put: [record("game-imports", SETTINGS_ID, settings)],
          remove: [],
        };
      },
      [{ store: "game-imports", key: SETTINGS_ID }],
    );
    setLichessImportSettings(settings);
    // Include games previously imported from PGN, whose local ids predate this importer.
    const existingIds = new Map(
      records<StoredGame>(await localDatabase().read([{ store: "games" }]), "games").flatMap(
        (game) => {
          const id = lichessGameId(game);
          return id === null ? [] : [[id, game.id] as const];
        },
      ),
    );
    let batch: StoredGame[] = [];
    let seen = 0;
    let lastCreatedAt = settings.since ?? 0;
    let earliestOngoing = Infinity;
    async function save(checkpoint: number) {
      signal.throwIfAborted();
      const candidates = batch.map((game) => ({
        ...game,
        id: existingIds.get(game.sourceGameId) ?? game.id,
      }));
      let added: StoredGame[] = [];
      let saved: LichessImportSettings = settings;
      await updateDatabase(
        (snapshot) => {
          const current = records<LichessImportSettings>(snapshot, "game-imports")[0];
          if (current?.username !== username)
            throw new Error("The Lichess username changed in another window.");
          const known = new Set(records<StoredGame>(snapshot, "games").map((game) => game.id));
          added = candidates.filter((game) => {
            if (known.has(game.id)) return false;
            known.add(game.id);
            return true;
          });
          saved = {
            ...current,
            since: Math.max(
              current.since ?? 0,
              Math.max(0, Math.min(checkpoint, earliestOngoing) - OVERLAP_MS),
            ),
          };
          return {
            expectedVersion: snapshot.version,
            put: [
              ...added.map((game) => record("games", game.id, game)),
              record("game-imports", SETTINGS_ID, saved),
            ],
            remove: [],
          };
        },
        [
          { store: "game-imports", key: SETTINGS_ID },
          ...candidates.map((game) => ({ store: "games" as const, key: game.id })),
        ],
      );
      for (const game of candidates) existingIds.set(game.sourceGameId, game.id);
      count += added.length;
      batch = [];
      seen = 0;
      setLichessImportSettings(saved);
      setLichessImportStatus({
        phase: "running",
        imported: count,
        message: `Importing from ${username}… ${count} new games saved.`,
      });
    }
    for await (const entry of streamLichessGames(username, settings.since, until, signal)) {
      // Checkpointing requires ascending creation dates; never skip data after an invalid stream.
      if (entry.createdAt < lastCreatedAt || entry.createdAt > until)
        throw new Error("Lichess returned games out of order. Please retry the import.");
      lastCreatedAt = entry.createdAt;
      if (entry.ongoing) earliestOngoing = Math.min(earliestOngoing, entry.createdAt);
      if (entry.game !== null) batch.push(entry.game);
      seen++;
      if (seen >= BATCH_SIZE) await save(lastCreatedAt);
    }
    await save(until);
    setLichessImportStatus({
      phase: "success",
      imported: count,
      message: `Lichess is up to date. Imported ${count} new games.`,
    });
  } catch (error) {
    if (signal.aborted) {
      setLichessImportStatus({
        phase: "idle",
        imported: count,
        message: `Import stopped. ${count} new games saved. You can resume the import.`,
      });
    } else failure(error);
  } finally {
    controller = undefined;
    // Reload game views once per run, avoiding repeated full-library analysis during large imports.
    if (count > 0) notifyGamesChanged();
  }
}

export function syncLichessGames(input: string): Promise<void> {
  if (running !== undefined) return running;
  let username: string;
  try {
    username = normalizeLichessUsername(input);
  } catch (error) {
    failure(error);
    return Promise.resolve();
  }
  const run = async () => {
    // Serialize exports across tabs to respect Lichess limits. Revision checks still protect writes.
    if (typeof navigator.locks?.request === "function") {
      await navigator.locks.request(
        "en-passant-local-v1:lichess-import",
        { ifAvailable: true },
        async (lock) => {
          if (lock === null) {
            setLichessImportStatus({
              phase: "idle",
              imported: 0,
              message: "A Lichess import is already running in another tab.",
            });
            return;
          }
          await runImport(username);
        },
      );
    } else await runImport(username);
  };
  running = run()
    .catch(failure)
    .finally(() => {
      running = undefined;
    });
  return running;
}
