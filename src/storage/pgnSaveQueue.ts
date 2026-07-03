type PgnWriter = (id: string, pgn: string) => Promise<void>;

type AfterWrite = () => void;

type QueueEntry = {
  latestPgn: string;
  isRunning: boolean;
  hasPendingWrite: boolean;
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

function createEntry(pgn: string): QueueEntry {
  const { idle, resolveIdle } = createIdlePromise();
  return {
    latestPgn: pgn,
    isRunning: false,
    hasPendingWrite: true,
    idle,
    resolveIdle,
  };
}

export function createLatestPgnSaveQueue(writePgn: PgnWriter, afterWrite: AfterWrite) {
  const entries = new Map<string, QueueEntry>();

  async function drain(id: string, entry: QueueEntry): Promise<void> {
    entry.isRunning = true;

    while (entry.hasPendingWrite) {
      const pgn = entry.latestPgn;
      entry.hasPendingWrite = false;

      try {
        await writePgn(id, pgn);
        afterWrite();
      } catch {
        // Keep the optimistic UI state. A later write for this PGN can still persist and sync.
      }
    }

    entry.isRunning = false;
    entries.delete(id);
    entry.resolveIdle();
  }

  function saveLatestPgn(id: string, pgn: string): Promise<void> {
    const existing = entries.get(id);
    if (existing !== undefined) {
      existing.latestPgn = pgn;
      existing.hasPendingWrite = true;
      return existing.idle;
    }

    const entry = createEntry(pgn);
    entries.set(id, entry);
    void drain(id, entry);
    return entry.idle;
  }

  return {
    saveLatestPgn,
  };
}
