import type {
  AppState,
  NewSerializedRepertoire,
  SerializedChapter,
  TrainingLineReview,
} from "@/lib/AppState";
import { normalizePgn, trainingLineReviewKey } from "@/lib/AppState";
import type { Store, StoreState } from "@/lib/createStore";
import { getAllChapters, getAllRepertoires, getAllTrainingLineSchedules, getPgn } from "@/storage";
import { subscribeToRecordChanges, type StorageRecordRef } from "@/storage/recordChanges";

type RecordChangeReads = {
  getAllRepertoires: () => Promise<NewSerializedRepertoire[]>;
  getAllChapters: () => Promise<SerializedChapter[]>;
  getAllTrainingLineSchedules: () => Promise<TrainingLineReview[]>;
  getPgn: (id: string) => Promise<string | undefined>;
};

const storageReads: RecordChangeReads = {
  getAllRepertoires,
  getAllChapters,
  getAllTrainingLineSchedules,
  getPgn,
};

function recordRefKey(record: StorageRecordRef): string {
  return `${record.kind}:${record.id}`;
}

export async function applyRecordChangesToState(
  state: StoreState<AppState>,
  records: StorageRecordRef[],
  reads: RecordChangeReads = storageReads,
): Promise<void> {
  const kinds = new Set(records.map((record) => record.kind));
  const loadedPgnIds = [
    ...new Set(
      records
        .filter((record) => record.kind === "pgn" && state.pgns[record.id] !== undefined)
        .map((record) => record.id),
    ),
  ];

  const [repertoires, chapters, trainingLineSchedules, pgns] = await Promise.all([
    kinds.has("repertoire") ? reads.getAllRepertoires() : null,
    kinds.has("chapter") ? reads.getAllChapters() : null,
    kinds.has("training-line-schedule") ? reads.getAllTrainingLineSchedules() : null,
    Promise.all(
      loadedPgnIds.map(async (id) => ({
        id,
        pgn: await reads.getPgn(id),
      })),
    ),
  ]);

  if (repertoires !== null && state.repertoires.status === "success") {
    state.set("repertoires", {
      status: "success",
      data: Object.fromEntries(repertoires.map((repertoire) => [repertoire.id, repertoire])),
    });
  }

  if (chapters !== null && state.chapters.status === "success") {
    state.set("chapters", {
      status: "success",
      data: Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter])),
    });
  }

  if (trainingLineSchedules !== null) {
    state.set("training", {
      ...state.training,
      reviews: Object.fromEntries(
        trainingLineSchedules.map((schedule) => [
          trainingLineReviewKey(schedule.repertoireId, schedule.chapterId, schedule.uciPath),
          schedule,
        ]),
      ),
    });
  }

  if (pgns.length > 0) {
    const nextPgns = { ...state.pgns };
    for (const { id, pgn } of pgns) {
      if (pgn === undefined) {
        delete nextPgns[id];
      } else {
        nextPgns[id] = { status: "success", data: normalizePgn(pgn) };
      }
    }
    state.set("pgns", nextPgns);
  }
}

export function startRecordChangeSync(store: Store<AppState>): () => void {
  const pendingRecords = new Map<string, StorageRecordRef>();
  let isApplying = false;
  let disposed = false;

  async function applyPendingRecords(): Promise<void> {
    isApplying = true;
    try {
      while (!disposed && pendingRecords.size > 0) {
        const records = [...pendingRecords.values()];
        pendingRecords.clear();
        await applyRecordChangesToState(store.state, records);
      }
    } catch {
      // IndexedDB remains the source of truth; the next change or page load retries the read.
    } finally {
      isApplying = false;
    }
  }

  const unsubscribe = subscribeToRecordChanges((records) => {
    for (const record of records) {
      pendingRecords.set(recordRefKey(record), record);
    }
    if (!isApplying) {
      void applyPendingRecords();
    }
  });

  return () => {
    disposed = true;
    pendingRecords.clear();
    unsubscribe();
  };
}
