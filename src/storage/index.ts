import {
  NewSerializedRepertoire,
  SerializedChapter,
  trainingLineReviewKey,
  type TrainingLineReview,
} from "@/lib/AppState";
import type { PgnMutation } from "@/lib/AppState";
import { createDemoRepertoireSeed } from "@/lib/demoRepertoire";
import { limitRepertoireNameLength } from "@/lib/repertoireNames";

const DB_NAME = "en-passant";
const DB_VERSION = 4;

const REPERTOIRE_STORE_NAME = "repertoires";
const CHAPTERS_STORE_NAME = "chapters";
const PGNS_STORE_NAME = "pgns";
const TRAINING_LINE_SCHEDULES_STORE_NAME = "training-line-schedules";
const METADATA_STORE_NAME = "metadata";
const REQUIRED_STORE_NAMES = [
  REPERTOIRE_STORE_NAME,
  CHAPTERS_STORE_NAME,
  PGNS_STORE_NAME,
  TRAINING_LINE_SCHEDULES_STORE_NAME,
  METADATA_STORE_NAME,
] as const;
const LAST_SYNCED_AT_KEY = "en_passant_repertoire_last_synced_at";

type SyncMetadata = {
  updatedAt: string;
  deletedAt?: string | null;
};

type LocalSyncMetadata = SyncMetadata & {
  dirty: boolean;
};

export type SyncedRepertoire = NewSerializedRepertoire & SyncMetadata;
export type SyncedChapter = SerializedChapter & SyncMetadata;
export type SyncedPgn = {
  id: string;
  revision: string;
  byteSize: number;
} & SyncMetadata;
export type SyncedTrainingLineSchedule = TrainingLineReview & { updatedAt: string };

export type PgnMutationChange = {
  id: string;
  mutations: PgnMutation[];
} & SyncMetadata;

export type StoredRepertoire = NewSerializedRepertoire & LocalSyncMetadata;
export type StoredChapter = SerializedChapter & LocalSyncMetadata;
export type StoredTrainingLineSchedule = SyncedTrainingLineSchedule & { dirty: boolean };
type StoredPgnBase = {
  id: string;
  pgn?: string;
  revision: string | null;
  byteSize: number;
} & SyncMetadata;

export type StoredPgn = StoredPgnBase & {
  pendingMutations: PgnMutation[];
  metadataDirty: boolean;
};

export type RepertoireSyncChanges = {
  repertoires: SyncedRepertoire[];
  chapters: SyncedChapter[];
  pgns: SyncedPgn[];
  trainingLineSchedules: SyncedTrainingLineSchedule[];
};

export type RepertoireSyncRequest = {
  since: string | null;
  changes: {
    repertoires: SyncedRepertoire[];
    chapters: SyncedChapter[];
    pgns: PgnMutationChange[];
    trainingLineSchedules: SyncedTrainingLineSchedule[];
  };
};

export type RepertoireSyncResponse = {
  cursor: string;
  changes: RepertoireSyncChanges;
  acknowledgedPgn: {
    id: string;
    revision: string;
    byteSize: number;
    updatedAt: string;
    deletedAt?: string | null;
  } | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function isIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function getLastSyncedAt(): string | null {
  const value = window.localStorage.getItem(LAST_SYNCED_AT_KEY);
  return value !== null && isIsoDate(value) ? value : null;
}

function setLastSyncedAt(value: string): void {
  window.localStorage.setItem(LAST_SYNCED_AT_KEY, value);
}

function clearLastSyncedAt(): void {
  window.localStorage.removeItem(LAST_SYNCED_AT_KEY);
}

function withLocalChange<T extends object>(value: T, updatedAt = nowIso()): T & LocalSyncMetadata {
  return {
    ...value,
    updatedAt,
    deletedAt: null,
    dirty: true,
  };
}

function limitRepertoire(repertoire: NewSerializedRepertoire): NewSerializedRepertoire {
  return {
    ...repertoire,
    name: limitRepertoireNameLength(repertoire.name),
  };
}

function limitChapter(chapter: SerializedChapter): SerializedChapter {
  return {
    ...chapter,
    name: limitRepertoireNameLength(chapter.name),
  };
}

function cleanRepertoire(repertoire: SyncedRepertoire): StoredRepertoire {
  return {
    ...repertoire,
    name: limitRepertoireNameLength(repertoire.name),
    dirty: false,
  };
}

function cleanChapter(chapter: SyncedChapter): StoredChapter {
  return {
    ...chapter,
    name: limitRepertoireNameLength(chapter.name),
    dirty: false,
  };
}

function cleanPgn(pgn: SyncedPgn, cachedPgn?: string): StoredPgn {
  return {
    ...pgn,
    ...(cachedPgn === undefined ? {} : { pgn: cachedPgn }),
    pendingMutations: [],
    metadataDirty: false,
  };
}

function cleanTrainingLineSchedule(
  schedule: SyncedTrainingLineSchedule,
): StoredTrainingLineSchedule {
  return { ...schedule, dirty: false };
}

function toSyncedTrainingLineSchedule(
  schedule: StoredTrainingLineSchedule,
): SyncedTrainingLineSchedule {
  const { dirty: _dirty, ...synced } = schedule;
  return synced;
}

function trainingLineScheduleStorageKey(
  schedule: Pick<TrainingLineReview, "repertoireId" | "chapterId" | "uciPath">,
): string {
  return trainingLineReviewKey(schedule.repertoireId, schedule.chapterId, schedule.uciPath);
}

function toSyncedRepertoire(repertoire: StoredRepertoire): SyncedRepertoire {
  return {
    id: repertoire.id,
    handle: repertoire.handle,
    name: repertoire.name,
    orientation: repertoire.orientation,
    updatedAt: repertoire.updatedAt,
    deletedAt: repertoire.deletedAt ?? null,
  };
}

function toSyncedChapter(chapter: StoredChapter): SyncedChapter {
  return {
    id: chapter.id,
    repertoireId: chapter.repertoireId,
    handle: chapter.handle,
    name: chapter.name,
    pgnId: chapter.pgnId,
    updatedAt: chapter.updatedAt,
    deletedAt: chapter.deletedAt ?? null,
  };
}

function toPgnMutationChange(pgn: StoredPgn): PgnMutationChange {
  return {
    id: pgn.id,
    mutations: pgn.deletedAt == null ? pendingMutationsFor(pgn) : [],
    updatedAt: pgn.updatedAt,
    deletedAt: pgn.deletedAt ?? null,
  };
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
    transaction.onabort = () => {
      reject(transaction.error);
    };
  });
}

async function waitForTransaction<T>(
  transaction: IDBTransaction,
  requests: Promise<T>,
): Promise<T> {
  const done = transactionDone(transaction);
  try {
    const result = await requests;
    await done;
    return result;
  } catch (error) {
    await done.catch(() => undefined);
    throw error;
  }
}

/**
 * Initializes the IndexedDB database and ensures the object store exists
 * @param dbName - Optional database name (defaults to 'chess-app')
 * @param storeName - Optional object store name (defaults to 'data')
 * @returns Promise that resolves with the database instance
 */
async function deleteDatabaseForReset(): Promise<void> {
  clearLastSyncedAt();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => {
      reject(new Error(`Failed to reset IndexedDB: ${request.error?.message}`));
    };
    request.onblocked = () => {
      reject(new Error("Failed to reset IndexedDB: database deletion was blocked"));
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}

function hasRequiredStores(db: IDBDatabase): boolean {
  return REQUIRED_STORE_NAMES.every((storeName) => db.objectStoreNames.contains(storeName));
}

async function connect(
  onUpgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const db = request.result;
      if (!hasRequiredStores(db)) {
        db.close();
        deleteDatabaseForReset()
          .then(() => connect(onUpgrade))
          .then(resolve, reject);
        return;
      }
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      onUpgrade(db, event.oldVersion);
    };
  });
}

function get<T>(store: IDBObjectStore, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => {
      reject(request.error);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => {
      reject(request.error);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function put<T>(store: IDBObjectStore, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.put(value, key);
    request.onerror = () => {
      reject(request.error);
    };
    request.onsuccess = () => {
      resolve();
    };
  });
}

export async function savePgnMutation(
  id: string,
  pgn: string,
  mutations: PgnMutation[],
): Promise<void> {
  if (mutations.length === 0) return;
  if (mutations.some((mutation) => mutation.type === "createPgn")) {
    throw new Error("PGN creation must use a chapter creation operation");
  }
  const db = await init();
  const readTransaction = db.transaction([PGNS_STORE_NAME], "readonly");
  const existing = await get<StoredPgn>(readTransaction.objectStore(PGNS_STORE_NAME), id);
  if (existing === undefined || existing.deletedAt != null) {
    throw new Error("Cannot mutate a missing PGN");
  }
  const transaction = db.transaction([PGNS_STORE_NAME], "readwrite");
  await waitForTransaction(
    transaction,
    put(transaction.objectStore(PGNS_STORE_NAME), id, {
      id,
      pgn,
      revision: existing.revision,
      byteSize: new TextEncoder().encode(pgn).byteLength,
      pendingMutations: [...pendingMutationsFor(existing), ...mutations],
      metadataDirty: isPgnMetadataDirty(existing),
      updatedAt: nowIso(),
      deletedAt: null,
    } satisfies StoredPgn),
  );
}

export async function createRepertoireAndChapter(
  repertoire: NewSerializedRepertoire,
  chapter: SerializedChapter,
  pgn: string,
): Promise<void> {
  const db = await init();

  const transaction = db.transaction(
    [REPERTOIRE_STORE_NAME, CHAPTERS_STORE_NAME, PGNS_STORE_NAME],
    "readwrite",
  );
  const repertoireStore = transaction.objectStore(REPERTOIRE_STORE_NAME);
  const chapterStore = transaction.objectStore(CHAPTERS_STORE_NAME);
  const pgnStore = transaction.objectStore(PGNS_STORE_NAME);
  const updatedAt = nowIso();

  await waitForTransaction(
    transaction,
    Promise.all([
      put(
        repertoireStore,
        repertoire.id,
        withLocalChange(
          {
            id: repertoire.id,
            handle: repertoire.handle,
            name: limitRepertoireNameLength(repertoire.name),
            orientation: repertoire.orientation,
          },
          updatedAt,
        ),
      ),
      put(
        chapterStore,
        chapter.id,
        withLocalChange(
          {
            id: chapter.id,
            repertoireId: chapter.repertoireId,
            handle: chapter.handle,
            name: limitRepertoireNameLength(chapter.name),
            pgnId: chapter.pgnId,
          },
          updatedAt,
        ),
      ),
      put(pgnStore, chapter.pgnId, {
        id: chapter.pgnId,
        pgn,
        revision: null,
        byteSize: new TextEncoder().encode(pgn).byteLength,
        pendingMutations: [{ type: "createPgn", pgn }],
        metadataDirty: true,
        updatedAt,
        deletedAt: null,
      } satisfies StoredPgn),
    ]),
  );
}

export async function getPgn(pgnId: string): Promise<string | undefined> {
  const db = await init();
  const transaction = db.transaction([PGNS_STORE_NAME], "readonly");
  const store = transaction.objectStore(PGNS_STORE_NAME);

  const value = await get<StoredPgn>(store, pgnId);
  return value?.deletedAt == null ? value?.pgn : undefined;
}

export async function cacheRemotePgn(pgnId: string, revision: string, pgn: string): Promise<void> {
  const db = await init();
  const readTransaction = db.transaction([PGNS_STORE_NAME], "readonly");
  const existing = await get<StoredPgn>(readTransaction.objectStore(PGNS_STORE_NAME), pgnId);
  if (
    existing === undefined ||
    existing.deletedAt != null ||
    existing.revision !== revision ||
    isPgnDirty(existing)
  ) {
    return;
  }

  const writeTransaction = db.transaction([PGNS_STORE_NAME], "readwrite");
  await waitForTransaction(
    writeTransaction,
    put(writeTransaction.objectStore(PGNS_STORE_NAME), pgnId, {
      ...existing,
      pgn,
    } satisfies StoredPgn),
  );
}

export async function deleteChapter(chapterId: string, pgnId: string): Promise<void> {
  const db = await init();
  const readTransaction = db.transaction([CHAPTERS_STORE_NAME, PGNS_STORE_NAME], "readonly");
  const [chapter, pgn] = await Promise.all([
    get<StoredChapter>(readTransaction.objectStore(CHAPTERS_STORE_NAME), chapterId),
    get<StoredPgn>(readTransaction.objectStore(PGNS_STORE_NAME), pgnId),
  ]);
  if (chapter === undefined && pgn === undefined) {
    return;
  }

  const writeTransaction = db.transaction([CHAPTERS_STORE_NAME, PGNS_STORE_NAME], "readwrite");
  const chapterStore = writeTransaction.objectStore(CHAPTERS_STORE_NAME);
  const pgnStore = writeTransaction.objectStore(PGNS_STORE_NAME);
  const deletedAt = nowIso();
  const requests: Promise<void>[] = [];
  if (chapter !== undefined) {
    requests.push(
      put(chapterStore, chapterId, {
        ...chapter,
        updatedAt: deletedAt,
        deletedAt,
        dirty: true,
      }),
    );
  }
  if (pgn !== undefined) {
    requests.push(
      put(pgnStore, pgnId, {
        ...pgn,
        updatedAt: deletedAt,
        deletedAt,
        metadataDirty: true,
      } satisfies StoredPgn),
    );
  }
  await waitForTransaction(writeTransaction, Promise.all(requests));
}

export async function deleteRepertoire(repertoireId: string): Promise<void> {
  const db = await init();
  const readTransaction = db.transaction([REPERTOIRE_STORE_NAME], "readonly");
  const repertoire = await get<StoredRepertoire>(
    readTransaction.objectStore(REPERTOIRE_STORE_NAME),
    repertoireId,
  );
  if (repertoire === undefined) {
    return;
  }

  const writeTransaction = db.transaction([REPERTOIRE_STORE_NAME], "readwrite");
  const store = writeTransaction.objectStore(REPERTOIRE_STORE_NAME);
  const deletedAt = nowIso();
  await waitForTransaction(
    writeTransaction,
    put(store, repertoireId, { ...repertoire, updatedAt: deletedAt, deletedAt, dirty: true }),
  );
}

export async function updateRepertoire(repertoire: NewSerializedRepertoire): Promise<void> {
  const db = await init();
  const transaction = db.transaction([REPERTOIRE_STORE_NAME], "readwrite");
  const store = transaction.objectStore(REPERTOIRE_STORE_NAME);
  await waitForTransaction(
    transaction,
    put(store, repertoire.id, withLocalChange(limitRepertoire(repertoire), nowIso())),
  );
}

export async function updateChapter(chapter: SerializedChapter): Promise<void> {
  const db = await init();
  const transaction = db.transaction([CHAPTERS_STORE_NAME], "readwrite");
  const store = transaction.objectStore(CHAPTERS_STORE_NAME);
  await waitForTransaction(
    transaction,
    put(store, chapter.id, withLocalChange(limitChapter(chapter), nowIso())),
  );
}

export async function saveTrainingLineSchedule(schedule: TrainingLineReview): Promise<void> {
  const db = await init();
  const transaction = db.transaction([TRAINING_LINE_SCHEDULES_STORE_NAME], "readwrite");
  const store = transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
  await waitForTransaction(
    transaction,
    put(store, trainingLineScheduleStorageKey(schedule), {
      ...schedule,
      updatedAt: nowIso(),
      dirty: true,
    } satisfies StoredTrainingLineSchedule),
  );
}

export async function getAllTrainingLineSchedules(): Promise<TrainingLineReview[]> {
  const db = await init();
  const transaction = db.transaction([TRAINING_LINE_SCHEDULES_STORE_NAME], "readonly");
  const values = await getAll<StoredTrainingLineSchedule>(
    transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME),
  );
  return values.map(({ dirty: _dirty, updatedAt: _updatedAt, ...value }) => value);
}

export async function createChapter(chapter: SerializedChapter, pgn: string): Promise<void> {
  const db = await init();
  const transaction = db.transaction([CHAPTERS_STORE_NAME, PGNS_STORE_NAME], "readwrite");
  const chapterStore = transaction.objectStore(CHAPTERS_STORE_NAME);
  const pgnStore = transaction.objectStore(PGNS_STORE_NAME);
  const updatedAt = nowIso();
  await waitForTransaction(
    transaction,
    Promise.all([
      put(chapterStore, chapter.id, withLocalChange(limitChapter(chapter), updatedAt)),
      put(pgnStore, chapter.pgnId, {
        id: chapter.pgnId,
        pgn,
        revision: null,
        byteSize: new TextEncoder().encode(pgn).byteLength,
        pendingMutations: [{ type: "createPgn", pgn }],
        metadataDirty: true,
        updatedAt,
        deletedAt: null,
      } satisfies StoredPgn),
    ]),
  );
}

export async function getAllRepertoires(): Promise<NewSerializedRepertoire[]> {
  const db = await init();
  const transaction = db.transaction([REPERTOIRE_STORE_NAME], "readonly");
  const store = transaction.objectStore(REPERTOIRE_STORE_NAME);
  const values = await getAll<StoredRepertoire>(store);
  return values.filter((value) => value.deletedAt == null).map(limitRepertoire);
}

export async function getAllChapters(): Promise<SerializedChapter[]> {
  const db = await init();

  const transaction = db.transaction([CHAPTERS_STORE_NAME], "readonly");
  const store = transaction.objectStore(CHAPTERS_STORE_NAME);
  const values = await getAll<StoredChapter>(store);
  return values.filter((value) => value.deletedAt == null).map(limitChapter);
}

export type InitialRepertoireLoad = {
  repertoires: NewSerializedRepertoire[];
  chapters: SerializedChapter[];
  trainingLineSchedules: TrainingLineReview[];
  createdDemo: boolean;
};

export async function getStoredRepertoiresAndChapters(): Promise<InitialRepertoireLoad> {
  const [repertoires, chapters, trainingLineSchedules] = await Promise.all([
    getAllRepertoires(),
    getAllChapters(),
    getAllTrainingLineSchedules(),
  ]);

  return { repertoires, chapters, trainingLineSchedules, createdDemo: false };
}

export async function createDemoInitialRepertoire(): Promise<InitialRepertoireLoad> {
  const demo = createDemoRepertoireSeed();
  await createRepertoireAndChapter(demo.repertoire, demo.chapter, demo.pgn);

  return {
    repertoires: [demo.repertoire],
    chapters: [demo.chapter],
    trainingLineSchedules: [],
    createdDemo: true,
  };
}

export async function getInitialRepertoiresAndChapters(): Promise<InitialRepertoireLoad> {
  const stored = await getStoredRepertoiresAndChapters();

  if (stored.repertoires.length > 0 || stored.chapters.length > 0) {
    return stored;
  }

  return await createDemoInitialRepertoire();
}

export async function getRepertoireSyncRequest(): Promise<RepertoireSyncRequest> {
  const db = await init();
  const transaction = db.transaction(
    [
      REPERTOIRE_STORE_NAME,
      CHAPTERS_STORE_NAME,
      PGNS_STORE_NAME,
      TRAINING_LINE_SCHEDULES_STORE_NAME,
    ],
    "readonly",
  );
  const repertoireStore = transaction.objectStore(REPERTOIRE_STORE_NAME);
  const chapterStore = transaction.objectStore(CHAPTERS_STORE_NAME);
  const pgnStore = transaction.objectStore(PGNS_STORE_NAME);
  const scheduleStore = transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
  const [rawRepertoires, rawChapters, rawPgns, rawTrainingLineSchedules] = await Promise.all([
    getAll<StoredRepertoire>(repertoireStore),
    getAll<StoredChapter>(chapterStore),
    getAll<StoredPgn>(pgnStore),
    getAll<StoredTrainingLineSchedule>(scheduleStore),
  ]);

  return {
    since: getLastSyncedAt(),
    changes: {
      repertoires: rawRepertoires.filter((repertoire) => repertoire.dirty).map(toSyncedRepertoire),
      chapters: rawChapters.filter((chapter) => chapter.dirty).map(toSyncedChapter),
      pgns: rawPgns.filter(isPgnDirty).slice(0, 1).map(toPgnMutationChange),
      trainingLineSchedules: rawTrainingLineSchedules
        .filter((schedule) => schedule.dirty)
        .map(toSyncedTrainingLineSchedule),
    },
  };
}

function isPgnDirty(pgn: StoredPgn): boolean {
  return isPgnMetadataDirty(pgn) || pendingMutationsFor(pgn).length > 0;
}

function isPgnMetadataDirty(pgn: StoredPgn): boolean {
  return pgn.metadataDirty;
}

function pendingMutationsFor(pgn: StoredPgn): PgnMutation[] {
  return pgn.pendingMutations;
}

function shouldApplySyncedChange<T extends { id: string; updatedAt: string }>(
  existing: (T & { dirty: boolean }) | undefined,
  sentChanges: Map<string, string>,
): boolean {
  return (
    existing === undefined || !existing.dirty || sentChanges.get(existing.id) === existing.updatedAt
  );
}

function sentUpdatedAtById<T extends { id: string; updatedAt: string }>(
  values: T[],
): Map<string, string> {
  return new Map(values.map((value) => [value.id, value.updatedAt]));
}

export async function applyRepertoireSyncResponse(
  response: RepertoireSyncResponse,
  request: RepertoireSyncRequest,
): Promise<RepertoireSyncChanges> {
  const db = await init();
  const readTransaction = db.transaction(
    [
      REPERTOIRE_STORE_NAME,
      CHAPTERS_STORE_NAME,
      PGNS_STORE_NAME,
      TRAINING_LINE_SCHEDULES_STORE_NAME,
    ],
    "readonly",
  );
  const repertoireStore = readTransaction.objectStore(REPERTOIRE_STORE_NAME);
  const chapterStore = readTransaction.objectStore(CHAPTERS_STORE_NAME);
  const pgnStore = readTransaction.objectStore(PGNS_STORE_NAME);
  const scheduleStore = readTransaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
  const [existingRepertoires, existingChapters, existingPgns, existingSchedules] =
    await Promise.all([
      getAll<StoredRepertoire>(repertoireStore),
      getAll<StoredChapter>(chapterStore),
      getAll<StoredPgn>(pgnStore),
      getAll<StoredTrainingLineSchedule>(scheduleStore),
    ]);
  const repertoireById = new Map(
    existingRepertoires.map((repertoire) => [repertoire.id, repertoire]),
  );
  const chapterById = new Map(existingChapters.map((chapter) => [chapter.id, chapter]));
  const pgnById = new Map(existingPgns.map((pgn) => [pgn.id, pgn]));
  const scheduleByKey = new Map(
    existingSchedules.map((schedule) => [trainingLineScheduleStorageKey(schedule), schedule]),
  );
  const sentRepertoireUpdatedAt = sentUpdatedAtById(request.changes.repertoires);
  const sentChapterUpdatedAt = sentUpdatedAtById(request.changes.chapters);
  const sentPgnUpdatedAt = sentUpdatedAtById(request.changes.pgns);
  const sentScheduleUpdatedAt = new Map(
    request.changes.trainingLineSchedules.map((schedule) => [
      trainingLineScheduleStorageKey(schedule),
      schedule.updatedAt,
    ]),
  );
  const appliedChanges: RepertoireSyncChanges = {
    repertoires: response.changes.repertoires.filter((repertoire) =>
      shouldApplySyncedChange(repertoireById.get(repertoire.id), sentRepertoireUpdatedAt),
    ),
    chapters: response.changes.chapters.filter((chapter) =>
      shouldApplySyncedChange(chapterById.get(chapter.id), sentChapterUpdatedAt),
    ),
    pgns: response.changes.pgns.filter((pgn) => {
      const existing = pgnById.get(pgn.id);
      return (
        existing === undefined ||
        !isPgnDirty(existing) ||
        sentPgnUpdatedAt.get(pgn.id) === existing.updatedAt
      );
    }),
    trainingLineSchedules: (response.changes.trainingLineSchedules ?? []).filter((schedule) => {
      const existing = scheduleByKey.get(trainingLineScheduleStorageKey(schedule));
      return (
        existing === undefined ||
        !existing.dirty ||
        sentScheduleUpdatedAt.get(trainingLineScheduleStorageKey(schedule)) === existing.updatedAt
      );
    }),
  };

  const writeTransaction = db.transaction(
    [
      REPERTOIRE_STORE_NAME,
      CHAPTERS_STORE_NAME,
      PGNS_STORE_NAME,
      TRAINING_LINE_SCHEDULES_STORE_NAME,
    ],
    "readwrite",
  );
  const writeRepertoireStore = writeTransaction.objectStore(REPERTOIRE_STORE_NAME);
  const writeChapterStore = writeTransaction.objectStore(CHAPTERS_STORE_NAME);
  const writePgnStore = writeTransaction.objectStore(PGNS_STORE_NAME);
  const writeScheduleStore = writeTransaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
  const acknowledgmentWrites: Promise<void>[] = [];
  if (response.acknowledgedPgn != null) {
    const acknowledgment = response.acknowledgedPgn;
    const existing = pgnById.get(acknowledgment.id);
    const sent = request.changes.pgns.find((pgn) => pgn.id === acknowledgment.id);
    if (existing === undefined || sent === undefined) {
      throw new Error("The server acknowledged an unknown PGN mutation");
    }
    const existingMutations = pendingMutationsFor(existing);
    const sentPrefix = existingMutations.slice(0, sent.mutations.length);
    const prefixMatches = JSON.stringify(sentPrefix) === JSON.stringify(sent.mutations);
    const remainingMutations = prefixMatches
      ? existingMutations.slice(sent.mutations.length)
      : existingMutations;
    const acknowledgedRemainingMutations = sent.deletedAt == null ? remainingMutations : [];
    acknowledgmentWrites.push(
      put(writePgnStore, acknowledgment.id, {
        ...existing,
        revision: acknowledgment.revision,
        byteSize: acknowledgment.byteSize,
        pendingMutations: acknowledgedRemainingMutations,
        metadataDirty: existing.deletedAt === sent.deletedAt ? false : isPgnMetadataDirty(existing),
        updatedAt:
          acknowledgedRemainingMutations.length === 0
            ? acknowledgment.updatedAt
            : existing.updatedAt,
        deletedAt: acknowledgment.deletedAt ?? null,
      } satisfies StoredPgn),
    );
  }

  await waitForTransaction(
    writeTransaction,
    Promise.all([
      ...appliedChanges.repertoires.map((repertoire) =>
        put(writeRepertoireStore, repertoire.id, cleanRepertoire(repertoire)),
      ),
      ...appliedChanges.chapters.map((chapter) =>
        put(writeChapterStore, chapter.id, cleanChapter(chapter)),
      ),
      ...appliedChanges.pgns.map((pgn) => {
        const existing = pgnById.get(pgn.id);
        const sent = request.changes.pgns.find((change) => change.id === pgn.id);
        const sentCreation = sent?.mutations.some((mutation) => mutation.type === "createPgn");
        const cachedPgn =
          existing !== undefined && (existing.revision === pgn.revision || sentCreation === true)
            ? existing.pgn
            : undefined;
        return put(writePgnStore, pgn.id, cleanPgn(pgn, cachedPgn));
      }),
      ...appliedChanges.trainingLineSchedules.map((schedule) =>
        put(
          writeScheduleStore,
          trainingLineScheduleStorageKey(schedule),
          cleanTrainingLineSchedule(schedule),
        ),
      ),
      ...acknowledgmentWrites,
    ]),
  );
  setLastSyncedAt(response.cursor);

  return appliedChanges;
}

export async function deleteIndexedDbDatabase(): Promise<void> {
  const currentDbPromise = dbPromise;
  dbPromise = null;
  clearLastSyncedAt();

  if (currentDbPromise !== null) {
    const db = await currentDbPromise;
    db.close();
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    const blockedTimeout = window.setTimeout(() => {
      reject(new Error("Failed to delete IndexedDB: database deletion was blocked"));
    }, 5_000);

    function finish(callback: () => void) {
      window.clearTimeout(blockedTimeout);
      callback();
    }

    request.onerror = () => {
      finish(() => reject(new Error(`Failed to delete IndexedDB: ${request.error?.message}`)));
    };

    request.onblocked = () => undefined;

    request.onsuccess = () => {
      finish(resolve);
    };
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function init() {
  if (dbPromise !== null) {
    return dbPromise;
  }

  dbPromise = connect((db, oldVersion) => {
    if (oldVersion > 0 && oldVersion < 4) {
      for (const storeName of db.objectStoreNames) {
        db.deleteObjectStore(storeName);
      }
      clearLastSyncedAt();
    }
    for (const storeName of REQUIRED_STORE_NAMES) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    }
  });

  return dbPromise;
}

export type Storage = typeof storage;

export const storage = {
  createRepertoireAndChapter,
  createChapter,
  getInitialRepertoiresAndChapters,
  getPgn,
  savePgnMutation,
  deleteChapter,
  deleteRepertoire,
  updateChapter,
  updateRepertoire,
  saveTrainingLineSchedule,
  getAllTrainingLineSchedules,
  getAllChapters,
  getAllRepertoires,
  getRepertoireSyncRequest,
  applyRepertoireSyncResponse,
  deleteIndexedDbDatabase,
};
