import {
  NewSerializedRepertoire,
  SerializedChapter,
  trainingLineReviewKey,
  type TrainingLineReview,
} from "@/lib/AppState";
import type { PgnMutation } from "@/lib/AppState";
import { createDemoRepertoireSeed } from "@/lib/demoRepertoire";
import { limitRepertoireNameLength } from "@/lib/repertoireNames";
import {
  publishDatabaseClearFinished,
  publishDatabaseClearRequested,
  publishRecordChanges,
  subscribeToDatabaseClearRequests,
  subscribeToDatabaseClearResults,
  type StorageRecordRef,
} from "./recordChanges";
import {
  getAllRecords,
  getRecord,
  putRecord,
  runTransaction,
  waitForTransaction,
} from "./indexedDb";

const DB_NAME = "en-passant";
const DB_VERSION = 4;

const REPERTOIRE_STORE_NAME = "repertoires";
const CHAPTERS_STORE_NAME = "chapters";
const PGNS_STORE_NAME = "pgns";
const TRAINING_LINE_SCHEDULES_STORE_NAME = "training-line-schedules";
const METADATA_STORE_NAME = "metadata";
const AUTHENTICATED_USER_ID_METADATA_KEY = "authenticated-user-id";
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

/**
 * Initializes the IndexedDB database and ensures the object store exists
 * @param dbName - Optional database name (defaults to 'chess-app')
 * @param storeName - Optional object store name (defaults to 'data')
 * @returns Promise that resolves with the database instance
 */
async function deleteDatabaseForReset(): Promise<void> {
  clearLastSyncedAt();
  const requestId = beginCoordinatedDatabaseClear();
  let succeeded = false;
  try {
    await requestDatabaseDeletion("reset");
    succeeded = true;
  } finally {
    finishCoordinatedDatabaseClear(requestId, succeeded);
  }
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
  await runTransaction(db, PGNS_STORE_NAME, "readwrite", async (transaction) => {
    const store = transaction.objectStore(PGNS_STORE_NAME);
    const existing = await getRecord<StoredPgn>(store, id);
    if (existing === undefined || existing.deletedAt != null) {
      throw new Error("Cannot mutate a missing PGN");
    }
    await putRecord(store, id, {
      id,
      pgn,
      revision: existing.revision,
      byteSize: new TextEncoder().encode(pgn).byteLength,
      pendingMutations: [...pendingMutationsFor(existing), ...mutations],
      metadataDirty: isPgnMetadataDirty(existing),
      updatedAt: nowIso(),
      deletedAt: null,
    } satisfies StoredPgn);
  });
  publishRecordChanges([{ kind: "pgn", id }]);
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
      putRecord(
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
      putRecord(
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
      putRecord(pgnStore, chapter.pgnId, {
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
  publishRecordChanges([
    { kind: "repertoire", id: repertoire.id },
    { kind: "chapter", id: chapter.id },
    { kind: "pgn", id: chapter.pgnId },
  ]);
}

export async function getPgn(pgnId: string): Promise<string | undefined> {
  const db = await init();
  const transaction = db.transaction([PGNS_STORE_NAME], "readonly");
  const store = transaction.objectStore(PGNS_STORE_NAME);

  const value = await getRecord<StoredPgn>(store, pgnId);
  return value?.deletedAt == null ? value?.pgn : undefined;
}

export async function cacheRemotePgn(pgnId: string, revision: string, pgn: string): Promise<void> {
  const db = await init();
  const cached = await runTransaction(db, PGNS_STORE_NAME, "readwrite", async (transaction) => {
    const store = transaction.objectStore(PGNS_STORE_NAME);
    const existing = await getRecord<StoredPgn>(store, pgnId);
    if (
      existing === undefined ||
      existing.deletedAt != null ||
      existing.revision !== revision ||
      isPgnDirty(existing)
    ) {
      return false;
    }

    await putRecord(store, pgnId, {
      ...existing,
      pgn,
    } satisfies StoredPgn);
    return true;
  });
  if (cached) publishRecordChanges([{ kind: "pgn", id: pgnId }]);
}

export async function deleteChapter(chapterId: string, pgnId: string): Promise<void> {
  const db = await init();
  const changedRecords = await runTransaction(
    db,
    [CHAPTERS_STORE_NAME, PGNS_STORE_NAME],
    "readwrite",
    async (transaction): Promise<StorageRecordRef[]> => {
      const chapterStore = transaction.objectStore(CHAPTERS_STORE_NAME);
      const pgnStore = transaction.objectStore(PGNS_STORE_NAME);
      const [chapter, pgn] = await Promise.all([
        getRecord<StoredChapter>(chapterStore, chapterId),
        getRecord<StoredPgn>(pgnStore, pgnId),
      ]);
      const deletedAt = nowIso();
      const requests: Promise<void>[] = [];
      if (chapter !== undefined) {
        requests.push(
          putRecord(chapterStore, chapterId, {
            ...chapter,
            updatedAt: deletedAt,
            deletedAt,
            dirty: true,
          }),
        );
      }
      if (pgn !== undefined) {
        requests.push(
          putRecord(pgnStore, pgnId, {
            ...pgn,
            updatedAt: deletedAt,
            deletedAt,
            metadataDirty: true,
          } satisfies StoredPgn),
        );
      }
      await Promise.all(requests);
      return [
        ...(chapter === undefined ? [] : [{ kind: "chapter", id: chapterId } as const]),
        ...(pgn === undefined ? [] : [{ kind: "pgn", id: pgnId } as const]),
      ];
    },
  );
  publishRecordChanges(changedRecords);
}

export async function deleteRepertoire(repertoireId: string): Promise<void> {
  const db = await init();
  const deleted = await runTransaction(
    db,
    REPERTOIRE_STORE_NAME,
    "readwrite",
    async (transaction) => {
      const store = transaction.objectStore(REPERTOIRE_STORE_NAME);
      const repertoire = await getRecord<StoredRepertoire>(store, repertoireId);
      if (repertoire === undefined) return false;

      const deletedAt = nowIso();
      await putRecord(store, repertoireId, {
        ...repertoire,
        updatedAt: deletedAt,
        deletedAt,
        dirty: true,
      });
      return true;
    },
  );
  if (deleted) publishRecordChanges([{ kind: "repertoire", id: repertoireId }]);
}

export async function updateRepertoire(repertoire: NewSerializedRepertoire): Promise<void> {
  const db = await init();
  const transaction = db.transaction([REPERTOIRE_STORE_NAME], "readwrite");
  const store = transaction.objectStore(REPERTOIRE_STORE_NAME);
  await waitForTransaction(
    transaction,
    putRecord(store, repertoire.id, withLocalChange(limitRepertoire(repertoire), nowIso())),
  );
  publishRecordChanges([{ kind: "repertoire", id: repertoire.id }]);
}

export async function updateChapter(chapter: SerializedChapter): Promise<void> {
  const db = await init();
  const transaction = db.transaction([CHAPTERS_STORE_NAME], "readwrite");
  const store = transaction.objectStore(CHAPTERS_STORE_NAME);
  await waitForTransaction(
    transaction,
    putRecord(store, chapter.id, withLocalChange(limitChapter(chapter), nowIso())),
  );
  publishRecordChanges([{ kind: "chapter", id: chapter.id }]);
}

export async function saveTrainingLineSchedule(schedule: TrainingLineReview): Promise<void> {
  const db = await init();
  const transaction = db.transaction([TRAINING_LINE_SCHEDULES_STORE_NAME], "readwrite");
  const store = transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
  await waitForTransaction(
    transaction,
    putRecord(store, trainingLineScheduleStorageKey(schedule), {
      ...schedule,
      updatedAt: nowIso(),
      dirty: true,
    } satisfies StoredTrainingLineSchedule),
  );
  publishRecordChanges([
    { kind: "training-line-schedule", id: trainingLineScheduleStorageKey(schedule) },
  ]);
}

export async function getAllTrainingLineSchedules(): Promise<TrainingLineReview[]> {
  const db = await init();
  const transaction = db.transaction([TRAINING_LINE_SCHEDULES_STORE_NAME], "readonly");
  const values = await getAllRecords<StoredTrainingLineSchedule>(
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
      putRecord(chapterStore, chapter.id, withLocalChange(limitChapter(chapter), updatedAt)),
      putRecord(pgnStore, chapter.pgnId, {
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
  publishRecordChanges([
    { kind: "chapter", id: chapter.id },
    { kind: "pgn", id: chapter.pgnId },
  ]);
}

export async function getAllRepertoires(): Promise<NewSerializedRepertoire[]> {
  const db = await init();
  const transaction = db.transaction([REPERTOIRE_STORE_NAME], "readonly");
  const store = transaction.objectStore(REPERTOIRE_STORE_NAME);
  const values = await getAllRecords<StoredRepertoire>(store);
  return values.filter((value) => value.deletedAt == null).map(limitRepertoire);
}

export async function getAllChapters(): Promise<SerializedChapter[]> {
  const db = await init();

  const transaction = db.transaction([CHAPTERS_STORE_NAME], "readonly");
  const store = transaction.objectStore(CHAPTERS_STORE_NAME);
  const values = await getAllRecords<StoredChapter>(store);
  return values.filter((value) => value.deletedAt == null).map(limitChapter);
}

export type InitialRepertoireLoad = {
  repertoires: NewSerializedRepertoire[];
  chapters: SerializedChapter[];
  trainingLineSchedules: TrainingLineReview[];
  createdDemo: boolean;
};

export async function getStoredRepertoiresAndChapters(): Promise<InitialRepertoireLoad> {
  const db = await init();
  return await runTransaction(
    db,
    [REPERTOIRE_STORE_NAME, CHAPTERS_STORE_NAME, TRAINING_LINE_SCHEDULES_STORE_NAME],
    "readonly",
    async (transaction) => {
      const [storedRepertoires, storedChapters, storedTrainingLineSchedules] = await Promise.all([
        getAllRecords<StoredRepertoire>(transaction.objectStore(REPERTOIRE_STORE_NAME)),
        getAllRecords<StoredChapter>(transaction.objectStore(CHAPTERS_STORE_NAME)),
        getAllRecords<StoredTrainingLineSchedule>(
          transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME),
        ),
      ]);
      const repertoires = storedRepertoires
        .filter((value) => value.deletedAt == null)
        .map(limitRepertoire);
      const chapters = storedChapters.filter((value) => value.deletedAt == null).map(limitChapter);
      const trainingLineSchedules = storedTrainingLineSchedules.map(
        ({ dirty: _dirty, updatedAt: _updatedAt, ...value }) => value,
      );

      return { repertoires, chapters, trainingLineSchedules, createdDemo: false };
    },
  );
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
    getAllRecords<StoredRepertoire>(repertoireStore),
    getAllRecords<StoredChapter>(chapterStore),
    getAllRecords<StoredPgn>(pgnStore),
    getAllRecords<StoredTrainingLineSchedule>(scheduleStore),
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
  const appliedChanges = await runTransaction(
    db,
    [
      REPERTOIRE_STORE_NAME,
      CHAPTERS_STORE_NAME,
      PGNS_STORE_NAME,
      TRAINING_LINE_SCHEDULES_STORE_NAME,
    ],
    "readwrite",
    async (transaction): Promise<RepertoireSyncChanges> => {
      const repertoireStore = transaction.objectStore(REPERTOIRE_STORE_NAME);
      const chapterStore = transaction.objectStore(CHAPTERS_STORE_NAME);
      const pgnStore = transaction.objectStore(PGNS_STORE_NAME);
      const scheduleStore = transaction.objectStore(TRAINING_LINE_SCHEDULES_STORE_NAME);
      const [existingRepertoires, existingChapters, existingPgns, existingSchedules] =
        await Promise.all([
          getAllRecords<StoredRepertoire>(repertoireStore),
          getAllRecords<StoredChapter>(chapterStore),
          getAllRecords<StoredPgn>(pgnStore),
          getAllRecords<StoredTrainingLineSchedule>(scheduleStore),
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
      const changes: RepertoireSyncChanges = {
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
            sentScheduleUpdatedAt.get(trainingLineScheduleStorageKey(schedule)) ===
              existing.updatedAt
          );
        }),
      };

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
          putRecord(pgnStore, acknowledgment.id, {
            ...existing,
            revision: acknowledgment.revision,
            byteSize: acknowledgment.byteSize,
            pendingMutations: acknowledgedRemainingMutations,
            metadataDirty:
              existing.deletedAt === sent.deletedAt ? false : isPgnMetadataDirty(existing),
            updatedAt:
              acknowledgedRemainingMutations.length === 0
                ? acknowledgment.updatedAt
                : existing.updatedAt,
            deletedAt: acknowledgment.deletedAt ?? null,
          } satisfies StoredPgn),
        );
      }

      await Promise.all([
        ...changes.repertoires.map((repertoire) =>
          putRecord(repertoireStore, repertoire.id, cleanRepertoire(repertoire)),
        ),
        ...changes.chapters.map((chapter) =>
          putRecord(chapterStore, chapter.id, cleanChapter(chapter)),
        ),
        ...changes.pgns.map((pgn) => {
          const existing = pgnById.get(pgn.id);
          const sent = request.changes.pgns.find((change) => change.id === pgn.id);
          const sentCreation = sent?.mutations.some((mutation) => mutation.type === "createPgn");
          const cachedPgn =
            existing !== undefined && (existing.revision === pgn.revision || sentCreation === true)
              ? existing.pgn
              : undefined;
          return putRecord(pgnStore, pgn.id, cleanPgn(pgn, cachedPgn));
        }),
        ...changes.trainingLineSchedules.map((schedule) =>
          putRecord(
            scheduleStore,
            trainingLineScheduleStorageKey(schedule),
            cleanTrainingLineSchedule(schedule),
          ),
        ),
        ...acknowledgmentWrites,
      ]);
      return changes;
    },
  );
  setLastSyncedAt(response.cursor);

  const changedRecords: StorageRecordRef[] = [
    ...appliedChanges.repertoires.map((repertoire) => ({
      kind: "repertoire" as const,
      id: repertoire.id,
    })),
    ...appliedChanges.chapters.map((chapter) => ({ kind: "chapter" as const, id: chapter.id })),
    ...appliedChanges.pgns.map((pgn) => ({ kind: "pgn" as const, id: pgn.id })),
    ...appliedChanges.trainingLineSchedules.map((schedule) => ({
      kind: "training-line-schedule" as const,
      id: trainingLineScheduleStorageKey(schedule),
    })),
  ];
  if (
    response.acknowledgedPgn !== null &&
    !changedRecords.some(
      (record) => record.kind === "pgn" && record.id === response.acknowledgedPgn?.id,
    )
  ) {
    changedRecords.push({ kind: "pgn", id: response.acknowledgedPgn.id });
  }
  publishRecordChanges(changedRecords);

  return appliedChanges;
}

export async function deleteIndexedDbDatabase(): Promise<void> {
  clearLastSyncedAt();
  const requestId = beginCoordinatedDatabaseClear();
  let succeeded = false;
  try {
    await closeCurrentDatabaseConnection();
    await requestDatabaseDeletion("delete");
    succeeded = true;
  } finally {
    finishCoordinatedDatabaseClear(requestId, succeeded);
  }
}

function requestDatabaseDeletion(action: "delete" | "reset"): Promise<void> {
  const actionLabel = action === "delete" ? "delete" : "reset";
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    const blockedTimeout = window.setTimeout(() => {
      reject(new Error(`Failed to ${actionLabel} IndexedDB: database deletion was blocked`));
    }, 5_000);

    function finish(callback: () => void) {
      window.clearTimeout(blockedTimeout);
      callback();
    }

    request.onerror = () => {
      finish(() =>
        reject(new Error(`Failed to ${actionLabel} IndexedDB: ${request.error?.message}`)),
      );
    };

    request.onblocked = () => undefined;

    request.onsuccess = () => {
      finish(resolve);
    };
  });
}

function beginCoordinatedDatabaseClear(): string {
  const requestId = crypto.randomUUID();
  pendingDatabaseClearRequests.add(requestId);
  publishDatabaseClearRequested(requestId);
  return requestId;
}

function finishCoordinatedDatabaseClear(requestId: string, succeeded: boolean): void {
  pendingDatabaseClearRequests.delete(requestId);
  publishDatabaseClearFinished(requestId, succeeded);
}

async function closeCurrentDatabaseConnection(): Promise<void> {
  const currentDbPromise = dbPromise;
  dbPromise = null;
  if (currentDbPromise === null) return;

  try {
    const db = await currentDbPromise;
    db.close();
  } catch {
    // A failed open does not prevent a fresh database deletion attempt.
  }
}

export async function getIndexedDbAuthenticatedUserId(): Promise<string | null> {
  const db = await init();
  const transaction = db.transaction([METADATA_STORE_NAME], "readonly");
  const value = await waitForTransaction(
    transaction,
    getRecord<unknown>(
      transaction.objectStore(METADATA_STORE_NAME),
      AUTHENTICATED_USER_ID_METADATA_KEY,
    ),
  );
  return typeof value === "string" ? value : null;
}

export async function setIndexedDbAuthenticatedUserId(userId: string): Promise<void> {
  const db = await init();
  const transaction = db.transaction([METADATA_STORE_NAME], "readwrite");
  await waitForTransaction(
    transaction,
    putRecord(
      transaction.objectStore(METADATA_STORE_NAME),
      AUTHENTICATED_USER_ID_METADATA_KEY,
      userId,
    ),
  );
}

let dbPromise: Promise<IDBDatabase> | null = null;
const pendingDatabaseClearRequests = new Set<string>();

subscribeToDatabaseClearRequests((requestId) => {
  pendingDatabaseClearRequests.add(requestId);
  void closeCurrentDatabaseConnection();
});

subscribeToDatabaseClearResults(({ requestId, succeeded }) => {
  if (!pendingDatabaseClearRequests.delete(requestId)) return;
  if (succeeded) {
    window.location.reload();
  }
});

function init() {
  if (pendingDatabaseClearRequests.size > 0) {
    return Promise.reject(new Error("IndexedDB is being cleared in another tab"));
  }
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
