import { StoreState } from "@/lib/createStore";
import { AppState, trainingLineReviewKey, type Context } from "@/lib/AppState";
import {
  applyRepertoireSyncResponse,
  cacheRemotePgn,
  getPgn,
  getRepertoireSyncRequest,
  type RepertoireSyncChanges,
  type RepertoireSyncRequest,
  type RepertoireSyncResponse,
} from "@/storage";
import { isSignedIn, refreshAuthSession } from "@/lib/authSession";
import { limitRepertoireNameLength } from "@/lib/repertoireNames";

type ApiError = {
  error: string;
};

export function withoutInlinePgnCreation(
  syncRequest: RepertoireSyncRequest,
): RepertoireSyncRequest {
  const pgnChange = syncRequest.changes.pgns[0];
  if (
    pgnChange === undefined ||
    !pgnChange.mutations.some((mutation) => mutation.type === "createPgn")
  ) {
    return syncRequest;
  }
  return {
    ...syncRequest,
    changes: {
      ...syncRequest.changes,
      pgns: [
        {
          ...pgnChange,
          mutations: pgnChange.mutations.filter((mutation) => mutation.type !== "createPgn"),
        },
      ],
    },
  };
}

async function readJson<T>(response: Response): Promise<T | null> {
  if (response.status === 204 || response.status === 401) {
    return null;
  }
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function syncRemoteChanges(
  syncRequest: RepertoireSyncRequest,
): Promise<RepertoireSyncChanges | null> {
  const pgnChange = syncRequest.changes.pgns[0];
  const creation = pgnChange?.mutations.find((mutation) => mutation.type === "createPgn");
  let request = syncRequest;
  if (pgnChange !== undefined && creation !== undefined) {
    const uploadResponse = await fetch(`/api/pgns/${encodeURIComponent(pgnChange.id)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/x-chess-pgn" },
      body: creation.pgn,
    });
    if (!uploadResponse.ok) {
      throw new Error(await uploadResponse.text());
    }
    request = withoutInlinePgnCreation(syncRequest);
  }

  const response = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const syncResponse = await readJson<RepertoireSyncResponse | ApiError>(response);
  if (syncResponse === null || "error" in syncResponse) {
    return null;
  }
  return await applyRepertoireSyncResponse(syncResponse, syncRequest);
}

export async function loadPgn(pgnId: string): Promise<string | undefined> {
  const localPgn = await getPgn(pgnId);
  if (localPgn !== undefined) return localPgn;

  const response = await fetch(`/api/pgns/${encodeURIComponent(pgnId)}`, {
    credentials: "include",
  });
  if (response.status === 401 || response.status === 404) return undefined;
  if (!response.ok) throw new Error(await response.text());

  const revision = response.headers.get("x-pgn-revision");
  if (revision === null || revision === "") {
    throw new Error("PGN response is missing its revision");
  }
  const pgn = await response.text();
  await cacheRemotePgn(pgnId, revision, pgn);
  return pgn;
}

export async function pullRepertoireFromBackend(): Promise<RepertoireSyncChanges | null> {
  return await syncRemoteChanges({
    since: null,
    changes: {
      repertoires: [],
      chapters: [],
      pgns: [],
      trainingLineSchedules: [],
    },
  });
}

function applyChangesToState(
  state: StoreState<AppState>,
  _route: Context,
  changes: RepertoireSyncChanges,
): void {
  const repertoires = state.repertoires.status === "success" ? { ...state.repertoires.data } : {};
  for (const repertoire of changes.repertoires) {
    if (repertoire.deletedAt == null) {
      repertoires[repertoire.id] = {
        id: repertoire.id,
        handle: repertoire.handle,
        name: limitRepertoireNameLength(repertoire.name),
        orientation: repertoire.orientation,
      };
    } else {
      delete repertoires[repertoire.id];
    }
  }
  state.set("repertoires", { status: "success", data: repertoires });

  const chapters = state.chapters.status === "success" ? { ...state.chapters.data } : {};
  for (const chapter of changes.chapters) {
    if (chapter.deletedAt == null) {
      chapters[chapter.id] = {
        id: chapter.id,
        repertoireId: chapter.repertoireId,
        handle: chapter.handle,
        name: limitRepertoireNameLength(chapter.name),
        pgnId: chapter.pgnId,
      };
    } else {
      delete chapters[chapter.id];
    }
  }
  state.set("chapters", { status: "success", data: chapters });

  const pgns = { ...state.pgns };
  for (const pgn of changes.pgns) {
    if (pgn.deletedAt == null) {
      delete pgns[pgn.id];
    } else {
      delete pgns[pgn.id];
    }
  }
  state.set("pgns", pgns);

  if (changes.trainingLineSchedules.length > 0) {
    const reviews = { ...state.training.reviews };
    for (const schedule of changes.trainingLineSchedules) {
      reviews[trainingLineReviewKey(schedule.repertoireId, schedule.chapterId, schedule.uciPath)] =
        schedule;
    }
    state.set("training", { ...state.training, reviews });
  }
}

export async function syncRepertoireFromBackend(
  state: StoreState<AppState>,
  route: Context,
): Promise<void> {
  const user = isSignedIn() ? true : (await refreshAuthSession().catch(() => null)) !== null;
  if (!user) {
    return;
  }

  const syncRequest = await getRepertoireSyncRequest();
  const changes = await syncRemoteChanges(syncRequest);
  if (changes !== null) {
    applyChangesToState(state, route, changes);
  }
}

export function createRepertoireSyncQueue({
  isSignedIn,
  getSyncRequest,
  pushSyncRequest,
}: {
  isSignedIn: () => boolean;
  getSyncRequest: () => Promise<RepertoireSyncRequest>;
  pushSyncRequest: (syncRequest: RepertoireSyncRequest) => Promise<unknown>;
}) {
  let isRunning = false;
  let hasPendingSync = false;
  let idle: Promise<void> | null = null;
  let resolveIdle: (() => void) | null = null;

  function ensureIdlePromise(): Promise<void> {
    if (idle !== null) return idle;
    idle = new Promise((resolve) => {
      resolveIdle = resolve;
    });
    return idle;
  }

  async function drain(): Promise<void> {
    isRunning = true;

    while (hasPendingSync) {
      hasPendingSync = false;

      try {
        const syncRequest = await getSyncRequest();
        await pushSyncRequest(syncRequest);
      } catch {
        // Sync is retryable. The next local change or sign-in sync can push a fresh request.
      }
    }

    isRunning = false;
    resolveIdle?.();
    idle = null;
    resolveIdle = null;
  }

  function queue(): Promise<void> {
    if (!isSignedIn()) {
      return Promise.resolve();
    }

    hasPendingSync = true;
    const currentIdle = ensureIdlePromise();
    if (!isRunning) {
      void drain();
    }
    return currentIdle;
  }

  return {
    queue,
  };
}

const repertoireSyncQueue = createRepertoireSyncQueue({
  isSignedIn,
  getSyncRequest: getRepertoireSyncRequest,
  pushSyncRequest: async (syncRequest) => {
    await syncRemoteChanges(syncRequest);
    const remaining = await getRepertoireSyncRequest();
    if (
      remaining.changes.repertoires.length > 0 ||
      remaining.changes.chapters.length > 0 ||
      remaining.changes.pgns.length > 0 ||
      remaining.changes.trainingLineSchedules.length > 0
    ) {
      queueMicrotask(queueRepertoireSync);
    }
  },
});

export function queueRepertoireSync(): void {
  void repertoireSyncQueue.queue();
}
