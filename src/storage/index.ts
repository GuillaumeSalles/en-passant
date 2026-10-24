import {
  getLineMoveTargets,
  normalizePgn,
  nextTrainingMoveReview,
  trainingMoveReviewKey,
  type TrainingMoveReview,
  type TrainingMoveIdentity,
  type TrainingMoveOutcome,
} from "@/lib/AppState";
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
  trainingMoveSchedules: TrainingMoveReview[];
  createdDemo: boolean;
};
export async function getInitialRepertoiresAndChapters(): Promise<InitialRepertoireLoad> {
  const s = await localDatabase().read([
    { store: "repertoires" },
    { store: "chapters" },
    { store: "training-line-schedules" },
    { store: "training-move-schedules" },
  ]);
  return {
    repertoires: active(records<StoredRepertoire>(s, "repertoires")),
    chapters: active(records<StoredChapter>(s, "chapters")),
    trainingLineSchedules: records<StoredTrainingLineSchedule>(s, "training-line-schedules"),
    trainingMoveSchedules: records<TrainingMoveReview>(s, "training-move-schedules"),
    createdDemo: false,
  };
}
export const getStoredRepertoiresAndChapters = getInitialRepertoiresAndChapters;
export async function getAllTrainingMoveSchedules(): Promise<TrainingMoveReview[]> {
  return records<TrainingMoveReview>(
    await localDatabase().read([{ store: "training-move-schedules" }]),
    "training-move-schedules",
  );
}

export type TrainingMoveAttempt = {
  identity: TrainingMoveIdentity;
  chapterId: string;
  uciPath: string;
  outcome: TrainingMoveOutcome;
  now: number;
};

// Recompute against the current stored review on each revision conflict; never overwrite a concurrent result.
export async function recordTrainingMoveAttempts(
  attempts: readonly TrainingMoveAttempt[],
): Promise<TrainingMoveReview[]> {
  if (attempts.length === 0) return [];
  const chapterIds = [...new Set(attempts.map((attempt) => attempt.chapterId))];
  const chapters = records<StoredChapter>(
    await localDatabase().read(chapterIds.map((key) => ({ store: "chapters", key }))),
    "chapters",
  );
  const pgnIds = chapters
    .filter((chapter) => chapterIds.includes(chapter.id))
    .map((chapter) => chapter.pgnId);
  let saved: TrainingMoveReview[] = [];
  await change(
    (snapshot) => {
      const current = new Map(
        records<TrainingMoveReview>(snapshot, "training-move-schedules").map((review) => [
          trainingMoveReviewKey(review),
          review,
        ]),
      );
      const updates = new Map<string, TrainingMoveReview>();
      const activeChapters = active(records<StoredChapter>(snapshot, "chapters"));
      const repertoires = active(records<StoredRepertoire>(snapshot, "repertoires"));
      const pgns = active(records<StoredPgn>(snapshot, "pgns"));
      for (const attempt of attempts) {
        const chapter = activeChapters.find(
          (entry) =>
            entry.id === attempt.chapterId && entry.repertoireId === attempt.identity.repertoireId,
        );
        const repertoire = repertoires.find((entry) => entry.id === attempt.identity.repertoireId);
        const source = pgns.find((entry) => entry.id === chapter?.pgnId);
        if (chapter === undefined || repertoire === undefined || source === undefined)
          throw new Error("The training chapter changed or was removed. Progress was not saved.");
        const target = getLineMoveTargets(
          repertoire.id,
          normalizePgn(source.pgn),
          repertoire.orientation,
          attempt.uciPath,
        ).find((entry) => entry.uciPath === attempt.uciPath);
        const key = trainingMoveReviewKey(attempt.identity);
        if (target?.key !== key)
          throw new Error("The training move changed or was removed. Progress was not saved.");
        if (updates.has(key)) continue;
        updates.set(
          key,
          nextTrainingMoveReview(attempt.identity, current.get(key), attempt.outcome, attempt.now),
        );
      }
      saved = [...updates.values()];
      return put(
        snapshot,
        saved
          .filter((review) => review !== current.get(trainingMoveReviewKey(review)))
          .map((review) =>
            record("training-move-schedules", trainingMoveReviewKey(review), {
              ...review,
              updatedAt: new Date().toISOString(),
            }),
          ),
      );
    },
    attempts.map((attempt) => ({
      kind: "training-move-schedule",
      id: trainingMoveReviewKey(attempt.identity),
    })),
    [
      ...chapterIds.map((key) => ({ store: "chapters" as const, key })),
      ...pgnIds.map((key) => ({ store: "pgns" as const, key })),
      ...[...new Set(attempts.map((attempt) => attempt.identity.repertoireId))].map((key) => ({
        store: "repertoires" as const,
        key,
      })),
      ...attempts.map((attempt) => ({
        store: "training-move-schedules" as const,
        key: trainingMoveReviewKey(attempt.identity),
      })),
    ],
  );
  return saved;
}

export const storage = {
  getAllTrainingMoveSchedules,
  recordTrainingMoveAttempts,
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
