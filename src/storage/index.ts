import type {
  NewSerializedRepertoire,
  SerializedChapter,
  TrainingLineReview,
  PgnMutation,
} from "@/lib/app-state/types";
import { trainingLineReviewKey } from "@/lib/AppState";
import { limitRepertoireNameLength } from "@/lib/repertoireNames";
import { localDatabase, updateDatabase } from "./localDatabase";
import type {
  SourceRecord,
  DatabaseSnapshot,
  StoreName,
  ReadStoreName,
  DatabaseQuery,
  DatabaseCommit,
} from "./databaseContract";
import { publishRecordChanges, type StorageRecordRef } from "./recordChanges";
import type {
  StoredRepertoire,
  StoredChapter,
  StoredPgn,
  StoredTrainingLineSchedule,
} from "./contracts";
export type {
  StoredRepertoire,
  StoredChapter,
  StoredPgn,
  StoredTrainingLineSchedule,
} from "./contracts";

const stamp = () => ({ updatedAt: new Date().toISOString(), deletedAt: null });
export function records<T>(snapshot: DatabaseSnapshot, store: ReadStoreName): T[] {
  return snapshot.records.filter((r) => r.store === store).map((r) => JSON.parse(r.value) as T);
}
export function record(store: StoreName, id: string, value: unknown): SourceRecord {
  return { store, id, value: JSON.stringify(value) };
}
function put(snapshot: DatabaseSnapshot, values: SourceRecord[]): DatabaseCommit {
  return { expectedVersion: snapshot.version, put: values, remove: [] };
}
function active<T extends { deletedAt?: string | null }>(values: T[]): T[] {
  return values.filter((v) => v.deletedAt == null);
}
function pgnRecord(id: string, pgn: string): SourceRecord {
  return record("pgns", id, {
    id,
    pgn,
    byteSize: new TextEncoder().encode(pgn).byteLength,
    ...stamp(),
  } satisfies StoredPgn);
}
async function change(
  edit: (snapshot: DatabaseSnapshot) => DatabaseCommit,
  refs: StorageRecordRef[],
  queries: readonly DatabaseQuery[],
) {
  await updateDatabase(edit, queries);
  publishRecordChanges(refs);
}
export async function createRepertoireAndChapter(
  repertoire: NewSerializedRepertoire,
  chapter: SerializedChapter,
  pgn: string,
) {
  await change(
    (s) => {
      if (
        s.records.some(
          (r) =>
            (r.store === "repertoires" && r.id === repertoire.id) ||
            (r.store === "chapters" && r.id === chapter.id) ||
            (r.store === "pgns" && r.id === chapter.pgnId),
        )
      )
        throw new Error("This repertoire already exists");
      if (chapter.repertoireId !== repertoire.id) throw new Error("Invalid chapter repertoire");
      return put(s, [
        record("repertoires", repertoire.id, {
          ...repertoire,
          name: limitRepertoireNameLength(repertoire.name),
          ...stamp(),
        }),
        record("chapters", chapter.id, {
          ...chapter,
          name: limitRepertoireNameLength(chapter.name),
          ...stamp(),
        }),
        pgnRecord(chapter.pgnId, pgn),
      ]);
    },
    [
      { kind: "repertoire", id: repertoire.id },
      { kind: "chapter", id: chapter.id },
      { kind: "pgn", id: chapter.pgnId },
    ],
    [
      { store: "repertoires", key: repertoire.id },
      { store: "chapters", key: chapter.id },
      { store: "pgns", key: chapter.pgnId },
    ],
  );
}
export async function createChapter(chapter: SerializedChapter, pgn: string) {
  await change(
    (s) => {
      if (
        !active(records<StoredRepertoire>(s, "repertoires")).some(
          (r) => r.id === chapter.repertoireId,
        )
      )
        throw new Error("Repertoire not found");
      if (
        s.records.some(
          (r) =>
            (r.store === "chapters" && r.id === chapter.id) ||
            (r.store === "pgns" && r.id === chapter.pgnId),
        )
      )
        throw new Error("Chapter already exists");
      return put(s, [
        record("chapters", chapter.id, {
          ...chapter,
          name: limitRepertoireNameLength(chapter.name),
          ...stamp(),
        }),
        pgnRecord(chapter.pgnId, pgn),
      ]);
    },
    [
      { kind: "chapter", id: chapter.id },
      { kind: "pgn", id: chapter.pgnId },
    ],
    [
      { store: "repertoires", key: chapter.repertoireId },
      { store: "chapters", key: chapter.id },
      { store: "pgns", key: chapter.pgnId },
    ],
  );
}
export async function getPgn(id: string): Promise<string | undefined> {
  return active(
    records<StoredPgn>(await localDatabase().read([{ store: "pgns", key: id }]), "pgns"),
  ).find((p) => p.id === id)?.pgn;
}
export async function savePgnMutation(id: string, pgn: string, mutations: PgnMutation[]) {
  if (mutations.length === 0) return;
  await change(
    (s) => {
      if (!active(records<StoredPgn>(s, "pgns")).some((p) => p.id === id))
        throw new Error("Cannot save a missing chapter");
      return put(s, [pgnRecord(id, pgn)]);
    },
    [{ kind: "pgn", id }],
    [{ store: "pgns", key: id }],
  );
}
export async function updateRepertoire(value: NewSerializedRepertoire) {
  await change(
    (s) =>
      put(
        s,
        active(records<StoredRepertoire>(s, "repertoires")).some((r) => r.id === value.id)
          ? [
              record("repertoires", value.id, {
                ...value,
                name: limitRepertoireNameLength(value.name),
                ...stamp(),
              }),
            ]
          : [],
      ),
    [{ kind: "repertoire", id: value.id }],
    [{ store: "repertoires", key: value.id }],
  );
}
export async function updateChapter(value: SerializedChapter) {
  await change(
    (s) =>
      put(
        s,
        active(records<StoredChapter>(s, "chapters")).some((r) => r.id === value.id)
          ? [
              record("chapters", value.id, {
                ...value,
                name: limitRepertoireNameLength(value.name),
                ...stamp(),
              }),
            ]
          : [],
      ),
    [{ kind: "chapter", id: value.id }],
    [{ store: "chapters", key: value.id }],
  );
}
function deletion(
  s: DatabaseSnapshot,
  chapterIds: string[],
  repertoireId?: string,
): DatabaseCommit {
  const deletedAt = new Date().toISOString();
  const chapters = records<StoredChapter>(s, "chapters").filter((c) => chapterIds.includes(c.id));
  const pgnIds = new Set(chapters.map((c) => c.pgnId));
  const values = [
    ...chapters.map((c) => record("chapters", c.id, { ...c, updatedAt: deletedAt, deletedAt })),
    ...records<StoredPgn>(s, "pgns")
      .filter((p) => pgnIds.has(p.id))
      .map((p) => record("pgns", p.id, { ...p, updatedAt: deletedAt, deletedAt })),
    ...records<StoredRepertoire>(s, "repertoires")
      .filter((r) => r.id === repertoireId)
      .map((r) => record("repertoires", r.id, { ...r, updatedAt: deletedAt, deletedAt })),
  ];
  return {
    ...put(s, values),
    remove: records<StoredTrainingLineSchedule>(s, "training-line-schedules")
      .filter((t) => chapterIds.includes(t.chapterId))
      .map((t) => ({
        store: "training-line-schedules" as const,
        id: trainingLineReviewKey(t.repertoireId, t.chapterId, t.uciPath),
      })),
  };
}
export async function deleteChapter(chapterId: string, _pgnId: string) {
  await change(
    (s) => deletion(s, [chapterId]),
    [{ kind: "chapter", id: chapterId }],
    [
      { store: "chapters", key: chapterId },
      { store: "pgns" },
      { store: "training-line-schedules" },
    ],
  );
}
export async function deleteRepertoire(id: string) {
  await change(
    (s) =>
      deletion(
        s,
        records<StoredChapter>(s, "chapters")
          .filter((c) => c.repertoireId === id)
          .map((c) => c.id),
        id,
      ),
    [{ kind: "repertoire", id }],
    [
      { store: "repertoires", key: id },
      { store: "chapters", index: "by-repertoire", key: id },
      { store: "pgns" },
      { store: "training-line-schedules" },
    ],
  );
}
export async function saveTrainingLineSchedule(schedule: TrainingLineReview) {
  const id = trainingLineReviewKey(schedule.repertoireId, schedule.chapterId, schedule.uciPath);
  await change(
    (s) => {
      if (
        !active(records<StoredChapter>(s, "chapters")).some(
          (c) => c.id === schedule.chapterId && c.repertoireId === schedule.repertoireId,
        )
      )
        throw new Error("Training chapter not found");
      return put(s, [
        record("training-line-schedules", id, { ...schedule, updatedAt: new Date().toISOString() }),
      ]);
    },
    [{ kind: "training-line-schedule", id }],
    [{ store: "chapters", key: schedule.chapterId }],
  );
}
export async function getAllRepertoires() {
  return active(
    records<StoredRepertoire>(
      await localDatabase().read([{ store: "repertoires" }]),
      "repertoires",
    ),
  );
}
export async function getAllChapters() {
  return active(
    records<StoredChapter>(await localDatabase().read([{ store: "chapters" }]), "chapters"),
  );
}
export async function getAllTrainingLineSchedules(): Promise<TrainingLineReview[]> {
  return records<StoredTrainingLineSchedule>(
    await localDatabase().read([{ store: "training-line-schedules" }]),
    "training-line-schedules",
  );
}
export type InitialRepertoireLoad = {
  repertoires: NewSerializedRepertoire[];
  chapters: SerializedChapter[];
  trainingLineSchedules: TrainingLineReview[];
  createdDemo: boolean;
};
export async function getInitialRepertoiresAndChapters(): Promise<InitialRepertoireLoad> {
  const s = await localDatabase().read([
    { store: "repertoires" },
    { store: "chapters" },
    { store: "training-line-schedules" },
  ]);
  return {
    repertoires: active(records<StoredRepertoire>(s, "repertoires")),
    chapters: active(records<StoredChapter>(s, "chapters")),
    trainingLineSchedules: records<StoredTrainingLineSchedule>(s, "training-line-schedules"),
    createdDemo: false,
  };
}
export const getStoredRepertoiresAndChapters = getInitialRepertoiresAndChapters;
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
};
export type Storage = typeof storage;
