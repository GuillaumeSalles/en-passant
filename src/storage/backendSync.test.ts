import { describe, expect, test, vi } from "vitest";
import { createRepertoireSyncQueue } from "./backendSync";
import type { RepertoireSyncRequest } from "@/storage";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function syncRequest(label: string): RepertoireSyncRequest {
  return {
    since: null,
    changes: {
      repertoires: [
        {
          id: `repertoire-${label}`,
          handle: `repertoire-${label}`,
          name: `Repertoire ${label}`,
          orientation: "white",
          updatedAt: label,
          deletedAt: null,
        },
      ],
      chapters: [],
      pgns: [],
      trainingLineSchedules: [],
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("createRepertoireSyncQueue", () => {
  test("runs one sync at a time and coalesces pending syncs into the latest request", async () => {
    const firstPush = deferred<void>();
    const syncRequests = [syncRequest("1"), syncRequest("2")];
    const getSyncRequest = vi.fn(() => Promise.resolve(syncRequests.shift() ?? syncRequest("99")));
    const pushSyncRequest = vi.fn((value: RepertoireSyncRequest) =>
      value.changes.repertoires[0]?.updatedAt === "1" ? firstPush.promise : Promise.resolve(),
    );
    const queue = createRepertoireSyncQueue({
      isSignedIn: () => true,
      getSyncRequest,
      pushSyncRequest,
    });

    const idle = queue.queue();
    await flushMicrotasks();

    queue.queue();
    queue.queue();

    expect(getSyncRequest).toHaveBeenCalledTimes(1);
    expect(pushSyncRequest).toHaveBeenCalledTimes(1);
    expect(pushSyncRequest).toHaveBeenNthCalledWith(1, syncRequest("1"));

    firstPush.resolve();
    await idle;

    expect(getSyncRequest).toHaveBeenCalledTimes(2);
    expect(pushSyncRequest).toHaveBeenCalledTimes(2);
    expect(pushSyncRequest).toHaveBeenNthCalledWith(2, syncRequest("2"));
  });

  test("does not read or push sync requests while signed out", async () => {
    const getSyncRequest = vi.fn(() => Promise.resolve(syncRequest("1")));
    const pushSyncRequest = vi.fn(() => Promise.resolve());
    const queue = createRepertoireSyncQueue({
      isSignedIn: () => false,
      getSyncRequest,
      pushSyncRequest,
    });

    await queue.queue();

    expect(getSyncRequest).not.toHaveBeenCalled();
    expect(pushSyncRequest).not.toHaveBeenCalled();
  });
});
