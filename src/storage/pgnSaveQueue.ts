import type { PgnMutation } from "@/lib/AppState";

type PgnWriter = (id: string, pgn: string, mutations: PgnMutation[]) => Promise<void>;

type AfterWrite = () => void;

type QueueEntry = {
  latestPgn: string;
  pendingMutations: PgnMutation[];
  isRunning: boolean;
  idle: Promise<void>;
  resolveIdle: () => void;
};

function createIdlePromise(): { idle: Promise<void>; resolveIdle: () => void } {
  let resolveIdle: () => void = () => {};
  const idle = new Promise<void>((resolve) => {
    resolveIdle = resolve;
  });
  return { idle, resolveIdle };
}

function createEntry(pgn: string, mutations: PgnMutation[]): QueueEntry {
  const { idle, resolveIdle } = createIdlePromise();
  return {
    latestPgn: pgn,
    pendingMutations: mutations,
    isRunning: false,
    idle,
    resolveIdle,
  };
}

export function createPgnMutationSaveQueue(writePgn: PgnWriter, afterWrite: AfterWrite) {
  const entries = new Map<string, QueueEntry>();

  async function drain(id: string, entry: QueueEntry): Promise<void> {
    entry.isRunning = true;

    while (entry.pendingMutations.length > 0) {
      const pgn = entry.latestPgn;
      const mutations = entry.pendingMutations;
      entry.pendingMutations = [];

      try {
        await writePgn(id, pgn, mutations);
        afterWrite();
      } catch {
        entry.pendingMutations = [...mutations, ...entry.pendingMutations];
        break;
      }
    }

    entry.isRunning = false;
    if (entry.pendingMutations.length === 0) {
      entries.delete(id);
    }
    entry.resolveIdle();
  }

  function savePgnMutations(id: string, pgn: string, mutations: PgnMutation[]): Promise<void> {
    if (mutations.length === 0) return Promise.resolve();

    const existing = entries.get(id);
    if (existing !== undefined) {
      existing.latestPgn = pgn;
      existing.pendingMutations.push(...mutations);
      if (!existing.isRunning) {
        const { idle, resolveIdle } = createIdlePromise();
        existing.idle = idle;
        existing.resolveIdle = resolveIdle;
        void drain(id, existing);
      }
      return existing.idle;
    }

    const entry = createEntry(pgn, mutations);
    entries.set(id, entry);
    void drain(id, entry);
    return entry.idle;
  }

  function savePgnMutation(id: string, pgn: string, mutation: PgnMutation): Promise<void> {
    return savePgnMutations(id, pgn, [mutation]);
  }

  return {
    savePgnMutation,
    savePgnMutations,
  };
}
