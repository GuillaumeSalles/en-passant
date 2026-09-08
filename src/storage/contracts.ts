import type {
  NewSerializedRepertoire,
  SerializedChapter,
  TrainingLineReview,
  PgnMutation,
} from "@/lib/app-state/types";

type SyncMetadata = {
  updatedAt: string;
  deletedAt?: string | null;
};

export type LocalSyncMetadata = SyncMetadata & {
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
export type StoredPgnBase = {
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
