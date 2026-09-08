import * as chess from "@/lib/AppState";
import { createChessPosition, isMoveLegal } from "@/lib/chess";
import { DEMO_REPERTOIRE_PGN } from "@/lib/demoRepertoire";
import { handleFromName, uniqueHandle } from "@/lib/handles";
import { formatRepertoireName } from "@/lib/repertoireNames";
import { MAX_CHAPTERS_PER_REPERTOIRE, MAX_REPERTOIRES } from "@/lib/repertoireLimits";
import type { StoreState } from "@/lib/storeTypes";
import type { MutationResult } from "@/lib/mutationEffects";
import type {
  StoredRepertoire,
  StoredChapter,
  StoredPgn,
  StoredTrainingLineSchedule,
  RepertoireSyncRequest,
  RepertoireSyncResponse,
} from "@/storage/contracts";

export type NativeData = {
  version: 1;
  owner: string | null;
  cursor: string | null;
  repertoires: StoredRepertoire[];
  chapters: StoredChapter[];
  pgns: StoredPgn[];
  schedules: StoredTrainingLineSchedule[];
};
export type Persistence = { read(): Promise<string | null>; write(value: string): Promise<void> };
export type TrainingAttempt = {
  line: chess.TrainingLine;
  moves: chess.Move[];
  index: number;
  mistakes: number;
  failedIndices: number[];
  replay: number[];
  phase: "learn" | "recall" | "complete";
  feedback: string;
};
function emptyData(): NativeData {
  return {
    version: 1,
    owner: null,
    cursor: null,
    repertoires: [],
    chapters: [],
    pgns: [],
    schedules: [],
  };
}
function sameRecord(local: { dirty: boolean }, sent: object): boolean {
  const { dirty: _dirty, ...record } = local;
  return JSON.stringify(record) === JSON.stringify(sent);
}
function stamp() {
  return { updatedAt: new Date().toISOString(), deletedAt: null, dirty: true };
}

export class NativeModel {
  data = emptyData();
  state: StoreState<chess.AppState>;
  chapterId: string | null = null;
  attempt: TrainingAttempt | null = null;
  error: string | null = null;
  ready = false;
  generation = 0;
  dataVersion = 0;
  private version = 0;
  private listeners = new Set<() => void>();
  private pendingWrite: Promise<void> = Promise.resolve();
  constructor(
    private persistence: Persistence,
    private id: () => string,
  ) {
    const state = chess.emptyState();
    this.state = Object.assign(state, {
      set: <K extends keyof chess.AppState>(
        key: K,
        value: chess.AppState[K] | ((current: chess.AppState[K]) => chess.AppState[K]),
      ) => {
        state[key] = typeof value === "function" ? value(state[key]) : value;
      },
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.version;
  notify(): void {
    this.version++;
    for (const listener of this.listeners) listener();
  }
  report(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
    this.notify();
  }
  get repertoires() {
    return this.data.repertoires.filter((r) => r.deletedAt == null);
  }
  get chapters() {
    return this.data.chapters.filter((c) => c.deletedAt == null);
  }
  get chapter() {
    return this.chapters.find((c) => c.id === this.chapterId) ?? null;
  }
  get repertoire() {
    return this.repertoires.find((r) => r.id === this.chapter?.repertoireId) ?? null;
  }
  get context(): chess.Context {
    return {
      type: "repertoire-builder",
      repertoireHandle: this.repertoire?.handle ?? "",
      chapterHandle: this.chapter?.handle ?? "",
    };
  }
  get pgn() {
    return chess.getPgn(this.state, this.context);
  }
  get selected() {
    return chess.selectedMove(this.state, this.context);
  }
  get fen() {
    const attempt = this.attempt;
    if (attempt !== null)
      return (
        attempt.moves[attempt.index - 1]?.fen ??
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      );
    return chess.selectFen(this.state, this.context);
  }
  get lines() {
    return this.pgn === null
      ? []
      : chess.getTrainingLines(this.pgn, this.repertoire?.orientation ?? "white");
  }
  review(line: chess.TrainingLine) {
    return this.data.schedules.find(
      (s) => s.chapterId === this.chapterId && s.uciPath === line.uciPath,
    );
  }
  async initialize(): Promise<void> {
    const saved = await this.persistence.read();
    if (saved !== null) {
      const parsed = JSON.parse(saved) as NativeData;
      if (parsed.version !== 1)
        throw new Error("This library needs a newer version of En Passant.");
      this.data = parsed;
    }
    this.hydrate();
    if (saved === null)
      this.createRepertoire("Demo repertoire", "white", DEMO_REPERTOIRE_PGN, "London system");
    this.ready = true;
    this.notify();
  }
  hydrate(): void {
    chess.onRepertoireAndChapterLoad(
      this.state,
      this.context,
      this.repertoires,
      this.chapters,
      this.data.schedules,
    );
    this.state.set(
      "pgns",
      Object.fromEntries(
        this.data.pgns
          .filter((p) => p.deletedAt == null && p.pgn !== undefined)
          .map((p) => [
            p.id,
            { status: "success" as const, data: chess.normalizePgn(p.pgn ?? "") },
          ]),
      ),
    );
    if (!this.chapters.some((c) => c.id === this.chapterId))
      this.chapterId = this.chapters[0]?.id ?? null;
    this.attempt = null;
    this.state.set("orientation", this.repertoire?.orientation ?? "white");
  }
  save(): void {
    this.dataVersion++;
    const serialized = JSON.stringify(this.data);
    this.pendingWrite = this.pendingWrite
      .catch(() => {})
      .then(() => this.persistence.write(serialized));
    void this.pendingWrite.catch((error: unknown) => this.report(error));
    this.notify();
  }
  async flush(): Promise<void> {
    await this.pendingWrite;
  }
  async setOwner(owner: string | null): Promise<void> {
    if (this.data.owner !== null && this.data.owner !== owner) {
      this.generation++;
      this.data = emptyData();
      this.chapterId = null;
      this.state.set("chapterSelections", {});
      this.hydrate();
    }
    this.data.owner = owner;
    this.save();
    await this.flush();
  }
  openChapter(id: string): void {
    if (!this.chapters.some((c) => c.id === id)) return;
    this.chapterId = id;
    this.attempt = null;
    this.state.set("orientation", this.repertoire?.orientation ?? "white");
    this.notify();
  }
  createRepertoire(
    name: string,
    orientation: chess.Orientation,
    pgn = "",
    chapterName = "Chapter 1",
  ): void {
    if (this.repertoires.length >= MAX_REPERTOIRES)
      throw new Error(`You can create up to ${MAX_REPERTOIRES} repertoires.`);
    chess.normalizePgn(pgn);
    const cleanName = formatRepertoireName(name, "Untitled Repertoire");
    const repertoire: StoredRepertoire = {
      id: this.id(),
      handle: uniqueHandle(
        handleFromName(cleanName, "repertoire"),
        this.repertoires.map((r) => r.handle),
      ),
      name: cleanName,
      orientation,
      ...stamp(),
    };
    this.data.repertoires.push(repertoire);
    this.createChapter(repertoire.id, chapterName, pgn);
  }
  createChapter(repertoireId: string, name: string, pgn = ""): void {
    if (!this.repertoires.some((r) => r.id === repertoireId)) return;
    const chapters = this.chapters.filter((c) => c.repertoireId === repertoireId);
    if (chapters.length >= MAX_CHAPTERS_PER_REPERTOIRE)
      throw new Error(`A repertoire can have up to ${MAX_CHAPTERS_PER_REPERTOIRE} chapters.`);
    const normalized = chess.normalizePgn(pgn);
    const cleanName = formatRepertoireName(name, `Chapter ${chapters.length + 1}`);
    const chapter: StoredChapter = {
      id: this.id(),
      repertoireId,
      name: cleanName,
      handle: uniqueHandle(
        handleFromName(cleanName, "chapter"),
        chapters.map((c) => c.handle),
      ),
      pgnId: this.id(),
      ...stamp(),
    };
    const serialized = chess.toPgn(normalized);
    this.data.chapters.push(chapter);
    this.data.pgns.push({
      id: chapter.pgnId,
      pgn: serialized,
      revision: null,
      byteSize: serialized.length,
      pendingMutations: [{ type: "createPgn", pgn: serialized }],
      metadataDirty: true,
      updatedAt: stamp().updatedAt,
      deletedAt: null,
    });
    this.hydrate();
    this.openChapter(chapter.id);
    this.save();
  }
  rename(kind: "repertoire" | "chapter", id: string, name: string): void {
    const record =
      kind === "repertoire"
        ? this.repertoires.find((r) => r.id === id)
        : this.chapters.find((c) => c.id === id);
    if (record === undefined) return;
    Object.assign(record, { name: formatRepertoireName(name, record.name), ...stamp() });
    this.hydrate();
    this.save();
  }
  delete(kind: "repertoire" | "chapter", id: string): void {
    const deletedAt = new Date().toISOString();
    const chapterIds =
      kind === "repertoire"
        ? this.chapters.filter((c) => c.repertoireId === id).map((c) => c.id)
        : [id];
    for (const chapter of this.data.chapters.filter((c) => chapterIds.includes(c.id))) {
      Object.assign(chapter, stamp(), { deletedAt });
      const pgn = this.data.pgns.find((p) => p.id === chapter.pgnId);
      if (pgn !== undefined)
        Object.assign(pgn, { deletedAt, updatedAt: deletedAt, metadataDirty: true });
    }
    if (kind === "repertoire") {
      const repertoire = this.data.repertoires.find((r) => r.id === id);
      if (repertoire !== undefined) Object.assign(repertoire, stamp(), { deletedAt });
    }
    this.data.schedules = this.data.schedules.filter((s) => !chapterIds.includes(s.chapterId));
    this.hydrate();
    this.save();
  }
  command(
    operation: (state: StoreState<chess.AppState>, context: chess.Context) => MutationResult,
  ): void {
    if (this.chapter === null) return;
    this.attempt = null;
    const result = operation(this.state, this.context);
    let changed = false;
    for (const effect of result === undefined ? [] : Array.isArray(result) ? result : [result]) {
      if (effect.type === "persist-pgn-mutation" || effect.type === "persist-pgn-mutations") {
        const record = this.data.pgns.find((p) => p.id === effect.pgnId);
        if (record === undefined) continue;
        changed = true;
        record.pgn = effect.pgn;
        record.updatedAt = stamp().updatedAt;
        record.pendingMutations.push(
          ...(effect.type === "persist-pgn-mutation" ? [effect.mutation] : effect.mutations),
        );
      }
    }
    if (changed) this.save();
    else this.notify();
  }
  play(from: string, to: string, promotion = "q"): void {
    if (!isMoveLegal(createChessPosition(this.fen), { from, to, promotion })) return;
    if (this.attempt !== null) {
      this.playTraining(from, to, promotion);
      return;
    }
    this.command((state, ctx) =>
      chess.moveFromChessboard(
        state,
        ctx,
        from,
        to,
        `${createChessPosition(this.fen).turn}${promotion}`,
      ),
    );
  }
  importPgn(pgn: string): void {
    this.command((state, ctx) => chess.mergeChapterPgn(state, ctx, pgn));
  }
  exportPgn(): string {
    return this.pgn === null ? "" : chess.toPgn(this.pgn);
  }
  startTraining(line: chess.TrainingLine, learn: boolean): void {
    if (this.pgn === null) return;
    const linePgn = chess.getTrainingLinePgn(this.pgn, line.id);
    if (linePgn === null) return;
    const moves = chess
      .getVariationMoveIds(linePgn, line.terminalMoveId)
      .map((id) => linePgn.moves[id])
      .filter((move) => move !== undefined);
    this.attempt = {
      line,
      moves,
      index: 0,
      mistakes: 0,
      failedIndices: [],
      replay: [],
      phase: learn ? "learn" : "recall",
      feedback: "Your turn",
    };
    this.advanceOpponent();
    this.notify();
  }
  stopTraining(): void {
    this.attempt = null;
    this.notify();
  }
  private advanceOpponent(): void {
    const attempt = this.attempt;
    if (attempt === null) return;
    const white = this.repertoire?.orientation !== "black";
    while (attempt.index < attempt.moves.length && (attempt.index % 2 === 0) !== white)
      attempt.index++;
    if (attempt.index >= attempt.moves.length) this.finishTraining();
  }
  private playTraining(from: string, to: string, promotion: string): void {
    const attempt = this.attempt;
    if (attempt === null || attempt.phase === "complete") return;
    const expected = attempt.moves[attempt.index];
    if (expected === undefined) return;
    if (
      expected.from !== from ||
      expected.to !== to ||
      (expected.promotion !== null && expected.promotion !== promotion)
    ) {
      attempt.mistakes++;
      if (!attempt.failedIndices.includes(attempt.index)) attempt.failedIndices.push(attempt.index);
      attempt.feedback = `Try again. Expected ${expected.san}.`;
    } else {
      attempt.feedback = "Correct";
      if (attempt.replay.length > 0) {
        attempt.replay.shift();
        const next = attempt.replay[0];
        if (next === undefined) this.finishTraining();
        else attempt.index = next;
      } else {
        attempt.index++;
        this.advanceOpponent();
      }
    }
    this.notify();
  }
  private finishTraining(): void {
    const attempt = this.attempt;
    const chapter = this.chapter;
    if (attempt === null || chapter === null) return;
    if (attempt.failedIndices.length > 0 && attempt.replay.length === 0) {
      attempt.replay = Array.from({ length: 3 }, () => attempt.failedIndices).flat();
      attempt.failedIndices = [];
      attempt.index = attempt.replay[0] ?? 0;
      attempt.feedback = "Practice the missed moves three times.";
      return;
    }
    const identity = {
      repertoireId: chapter.repertoireId,
      chapterId: chapter.id,
      uciPath: attempt.line.uciPath,
    };
    const previous = this.review(attempt.line);
    const review =
      previous === undefined || attempt.phase === "learn"
        ? chess.initialTrainingReview(identity, Date.now())
        : chess.nextTrainingReview(previous, attempt.mistakes === 0, Date.now());
    this.data.schedules = this.data.schedules.filter(
      (s) => s.chapterId !== chapter.id || s.uciPath !== attempt.line.uciPath,
    );
    this.data.schedules.push({ ...review, dirty: true, updatedAt: stamp().updatedAt });
    attempt.phase = "complete";
    attempt.index = attempt.moves.length;
    attempt.feedback = `Line complete · ${attempt.mistakes} mistake${attempt.mistakes === 1 ? "" : "s"}`;
    this.save();
  }
  syncRequest(): RepertoireSyncRequest {
    const pgn = this.data.pgns.find((p) => p.pendingMutations.length > 0 || p.metadataDirty);
    return {
      since: this.data.cursor,
      changes: {
        repertoires: this.data.repertoires
          .filter((r) => r.dirty)
          .map(({ dirty: _dirty, ...r }) => r),
        chapters: this.data.chapters.filter((c) => c.dirty).map(({ dirty: _dirty, ...c }) => c),
        pgns:
          pgn === undefined
            ? []
            : [
                {
                  id: pgn.id,
                  mutations: [...pgn.pendingMutations],
                  updatedAt: pgn.updatedAt,
                  deletedAt: pgn.deletedAt,
                },
              ],
        trainingLineSchedules: this.data.schedules
          .filter((s) => s.dirty)
          .map(({ dirty: _dirty, ...s }) => s),
      },
    };
  }
  applySync(response: RepertoireSyncResponse, request: RepertoireSyncRequest): void {
    for (const [local, sent, remote] of [
      [this.data.repertoires, request.changes.repertoires, response.changes.repertoires],
      [this.data.chapters, request.changes.chapters, response.changes.chapters],
    ] as const) {
      // Concrete record types are preserved in the separate assignments below.
      for (const record of local)
        if (sent.some((s) => s.id === record.id && sameRecord(record, s))) record.dirty = false;
      for (const record of remote) {
        if ("orientation" in record) {
          const old = this.data.repertoires.find((r) => r.id === record.id);
          if (old?.dirty === true) continue;
          this.data.repertoires = [
            ...this.data.repertoires.filter((r) => r.id !== record.id),
            { ...record, dirty: false },
          ];
        } else {
          const old = this.data.chapters.find((c) => c.id === record.id);
          if (old?.dirty === true) continue;
          this.data.chapters = [
            ...this.data.chapters.filter((c) => c.id !== record.id),
            { ...record, dirty: false },
          ];
        }
      }
    }
    for (const record of this.data.schedules)
      if (
        request.changes.trainingLineSchedules.some(
          (s) =>
            s.chapterId === record.chapterId &&
            s.uciPath === record.uciPath &&
            sameRecord(record, s),
        )
      )
        record.dirty = false;
    for (const schedule of response.changes.trainingLineSchedules) {
      const old = this.data.schedules.find(
        (s) => s.chapterId === schedule.chapterId && s.uciPath === schedule.uciPath,
      );
      if (old?.dirty === true) continue;
      this.data.schedules = [
        ...this.data.schedules.filter((s) => s !== old),
        { ...schedule, dirty: false },
      ];
    }
    const ack = response.acknowledgedPgn;
    if (ack !== null) {
      const pgn = this.data.pgns.find((p) => p.id === ack.id);
      const sent = request.changes.pgns.find((p) => p.id === ack.id);
      if (pgn !== undefined && sent !== undefined) {
        pgn.pendingMutations.splice(0, sent.mutations.length);
        if (pgn.updatedAt === sent.updatedAt) pgn.metadataDirty = false;
        pgn.revision = ack.revision;
      }
    }
    for (const remote of response.changes.pgns) {
      const old = this.data.pgns.find((p) => p.id === remote.id);
      if (old !== undefined && (old.pendingMutations.length > 0 || old.metadataDirty)) continue;
      const cached = old?.revision === remote.revision ? old?.pgn : undefined;
      this.data.pgns = [
        ...this.data.pgns.filter((p) => p.id !== remote.id),
        {
          ...remote,
          ...(cached === undefined ? {} : { pgn: cached }),
          pendingMutations: [],
          metadataDirty: false,
        },
      ];
    }
    this.data.cursor = response.cursor;
    this.hydrate();
    this.save();
  }
}
