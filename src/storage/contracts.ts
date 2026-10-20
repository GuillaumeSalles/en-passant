import type {
  NewSerializedRepertoire,
  SerializedChapter,
  TrainingLineReview,
} from "@/lib/app-state/types";
export type LocalMetadata = { updatedAt: string; deletedAt: string | null };
export type StoredRepertoire = NewSerializedRepertoire & LocalMetadata;
export type StoredChapter = SerializedChapter & LocalMetadata;
export type StoredTrainingLineSchedule = TrainingLineReview & { updatedAt: string };
export type StoredPgn = { id: string; pgn: string; byteSize: number } & LocalMetadata;
